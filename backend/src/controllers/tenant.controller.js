const db = require('../config/db');
const { logAudit } = require('../services/audit.service');

async function getOrganizations(req, res) {
  try {
    let sql = 'SELECT * FROM organizations';
    let params = [];

    // If non-super admin, limit list to their organization
    if (!req.user.is_super_admin) {
      sql += ' WHERE id = ?';
      params.push(req.user.organization_id);
    }

    sql += ' ORDER BY id ASC';
    const orgs = await db.query(sql, params);
    return res.json({ success: true, organizations: orgs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createOrganization(req, res) {
  try {
    const { name, code } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Company / Tenant name is required.' });
    }

    const trimmedName = name.trim();

    // Auto-generate unique uppercase code if not provided
    let uppercaseCode = code ? code.trim().toUpperCase() : '';
    if (!uppercaseCode) {
      // Create a clean acronym or slug from the company name
      const words = trimmedName.split(/\s+/).filter(Boolean);
      let baseCode = '';
      if (words.length > 1) {
        baseCode = words.map(w => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
      }
      if (baseCode.length < 3) {
        baseCode = trimmedName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
      }
      if (!baseCode) baseCode = 'ORG';

      let candidate = baseCode;
      let suffix = 1;
      while (true) {
        const existing = await db.query('SELECT id FROM organizations WHERE UPPER(code) = ?', [candidate]);
        if (!existing || existing.length === 0) {
          uppercaseCode = candidate;
          break;
        }
        candidate = `${baseCode.substring(0, 6)}_${suffix++}`;
      }
    } else {
      const existing = await db.query('SELECT id FROM organizations WHERE UPPER(code) = ?', [uppercaseCode]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: `Organization code '${uppercaseCode}' already exists.` });
      }
    }

    const result = await db.query(
      'INSERT INTO organizations (name, code, status) VALUES (?, ?, ?)',
      [trimmedName, uppercaseCode, 'ACTIVE']
    );
    const newOrgId = result.insertId || result.id;

    // Automatically create corresponding organization branch folder under Bikramshila directory
    try {
      const bksRows = await db.query("SELECT id FROM folders WHERE UPPER(name) IN ('BIKRAMSHILA', 'BKS') AND parent_id IS NULL LIMIT 1");
      const bksId = bksRows.length > 0 ? bksRows[0].id : null;
      
      const existingFolder = await db.query("SELECT id FROM folders WHERE UPPER(name) = UPPER(?)", [trimmedName]);
      if (!existingFolder || existingFolder.length === 0) {
        await db.query(
          'INSERT INTO folders (organization_id, name, description, created_by, parent_id, is_operational) VALUES (?, ?, ?, ?, ?, ?)',
          [newOrgId, trimmedName, `${trimmedName} Branch Directory`, req.user.id, bksId, 0]
        );
      }
    } catch (folderErr) {
      console.warn('Auto-folder creation for tenant warning:', folderErr.message);
    }

    await logAudit({
      organization_id: newOrgId,
      user_id: req.user.id,
      user_email: req.user.email,
      user_name: req.user.name,
      action: 'ORGANIZATION_CREATED',
      comment: `New tenant organization '${trimmedName}' (${uppercaseCode}) created by ${req.user.name || 'Admin'}.`,
      req
    });

    return res.status(201).json({
      success: true,
      message: `Organization '${trimmedName}' created successfully.`,
      organization: { id: newOrgId, name: trimmedName, code: uppercaseCode, status: 'ACTIVE' }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateOrganizationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be ACTIVE or INACTIVE.' });
    }

    await db.query('UPDATE organizations SET status = ? WHERE id = ?', [status, id]);

    await logAudit({
      organization_id: id,
      action: 'ORGANIZATION_UPDATED',
      comment: `Organization ID ${id} status set to ${status}.`,
      req
    });

    return res.json({ success: true, message: `Organization status updated to ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getOrganizations,
  createOrganization,
  updateOrganizationStatus
};
