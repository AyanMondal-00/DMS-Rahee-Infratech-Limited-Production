const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { logAudit } = require('../services/audit.service');
const { sendNotification } = require('../services/notification.service');
const { MULTI_TENANT_ISOLATION_ENABLED } = require('../config/workflow.config');

async function getUsers(req, res) {
  try {
    let sql = `
      SELECT u.id, u.organization_id, u.name, u.email, u.status, u.role_id, u.designation, u.document_capability, u.created_at,
             r.name as role_name, r.description as role_description,
             o.name as organization_name, o.code as organization_code
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN organizations o ON u.organization_id = o.id
    `;
    let params = [];

    // Tenant filter: Normal users only see their organization if tenant isolation is enabled
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin) {
      sql += ' WHERE u.organization_id = ?';
      params.push(req.user.organization_id);
    } else if (req.query.organization_id) {
      sql += ' WHERE u.organization_id = ?';
      params.push(req.query.organization_id);
    }

    sql += ' ORDER BY u.id ASC';

    const users = await db.query(sql, params);
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, password, role_id, organization_id, designation, document_capability } = req.body;

    // STRICT RULE: The Super-Admin holds complete executive authority and is strictly responsible for creating users for both companies in the system.
    if (!req.user.is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: User account creation is strictly restricted to the Global Super Admin ONLY.'
      });
    }

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, message: 'Name, Email, Password, and Role are required.' });
    }

    const targetOrgId = organization_id ? parseInt(organization_id) : (req.user.organization_id || 1);

    // Check duplicate email
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: `User with email '${email.trim()}' already exists.` });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role_id, designation, document_capability, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [targetOrgId, name.trim(), email.trim().toLowerCase(), password_hash, parseInt(role_id), designation || 'Manager', document_capability || 'Viewer']
    );

    const newUserId = result.insertId;

    // Send Welcome Account Created Notification & Email
    await sendNotification({
      recipientId: newUserId,
      senderId: req.user.id,
      organizationId: targetOrgId,
      title: '🎉 Welcome to Enterprise DMS',
      message: `Your account (${email.trim().toLowerCase()}) has been created successfully. You can now log into the Enterprise DMS portal.`,
      type: 'USER_ACCOUNT_CREATED',
      emailDetails: {
        documentTitle: 'Account Welcome & Setup',
        documentVersion: 'V1.0'
      }
    });

    await logAudit({
      organization_id: targetOrgId,
      action: 'USER_CREATED',
      comment: `New user account created: '${name.trim()}' (${email.trim()}).`,
      req
    });

    return res.status(201).json({
      success: true,
      message: 'User account created successfully.',
      user: {
        id: result.insertId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role_id: parseInt(role_id),
        organization_id: targetOrgId,
        status: 'ACTIVE'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'DISABLED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be ACTIVE or DISABLED.' });
    }

    // Check if target user belongs to caller's org
    const targetUsers = await db.query('SELECT organization_id, name, email FROM users WHERE id = ?', [id]);
    const targetUser = targetUsers[0];
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!req.user.is_super_admin) {
      return res.status(403).json({ success: false, message: 'Forbidden: User account status management is strictly restricted to the Global Super Admin ONLY.' });
    }

    await db.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);

    const auditAction = status === 'DISABLED' ? 'USER_DISABLED' : 'USER_UPDATED';
    await logAudit({
      organization_id: targetUser.organization_id,
      action: auditAction,
      comment: `User account '${targetUser.email}' status changed to ${status}.`,
      req
    });

    return res.json({ success: true, message: `User status set to ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getRoles(req, res) {
  try {
    const roles = await db.query('SELECT * FROM roles ORDER BY id ASC');
    const permissions = await db.query('SELECT * FROM permissions ORDER BY id ASC');
    const rolePermissions = await db.query(
      `SELECT rp.role_id, p.id as permission_id, p.code, p.description
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id`
    );
    return res.json({ success: true, roles, permissions, rolePermissions });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const targetId = parseInt(id);

    if (targetId === 1) {
      return res.status(400).json({ success: false, message: 'Security Constraint: Primary Super Administrator account cannot be deleted.' });
    }

    if (targetId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own active user account.' });
    }

    const targetUsers = await db.query('SELECT id, name, email, organization_id FROM users WHERE id = ?', [targetId]);
    const targetUser = targetUsers[0];
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    if (!req.user.is_super_admin) {
      return res.status(403).json({ success: false, message: 'Forbidden: User account deletion is strictly restricted to the Global Super Admin ONLY.' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [targetId]);

    await logAudit({
      organization_id: targetUser.organization_id,
      action: 'USER_DELETED',
      comment: `User account '${targetUser.email}' (${targetUser.name}) was deleted from the system.`,
      req
    });

    return res.json({ success: true, message: `User account '${targetUser.name}' deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const targetId = parseInt(id);

    // Strict Rule: Password reset is exclusively restricted to Super Admin (Rajib Ghosh)
    if (!req.user.is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: User password reset is strictly restricted to the Global Super Admin ONLY.'
      });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const targetUsers = await db.query('SELECT id, name, email, organization_id FROM users WHERE id = ?', [targetId]);
    const targetUser = targetUsers[0];
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(password.trim(), 10);

    // Update password and clear any failed login lockouts
    await db.query(
      'UPDATE users SET password_hash = ?, failed_login_attempts = 0, lockout_until = NULL WHERE id = ?',
      [password_hash, targetId]
    );

    // Audit log
    await logAudit({
      organization_id: targetUser.organization_id || 1,
      action: 'USER_PASSWORD_RESET',
      comment: `Password reset by Super Admin for user account '${targetUser.email}' (${targetUser.name}).`,
      req
    });

    return res.json({
      success: true,
      message: `Password for user '${targetUser.name}' (${targetUser.email}) has been successfully reset.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUserStatus,
  getRoles,
  deleteUser,
  resetUserPassword
};
