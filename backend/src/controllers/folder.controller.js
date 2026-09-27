const db = require('../config/db');
const { logAudit } = require('../services/audit.service');
const { MULTI_TENANT_ISOLATION_ENABLED, ONLY_SUPER_ADMIN_CAN_DELETE, ADMIN_FOLDER_CREATION_ENABLED } = require('../config/workflow.config');

// Recursive helper to get all subfolder IDs under a given parent folder ID
async function getAllSubfolderIds(folderId, includeDeleted = false) {
  const subfolderIds = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const currentParentId = queue.shift();
    const queryStr = includeDeleted
      ? 'SELECT id FROM folders WHERE parent_id = ?'
      : 'SELECT id FROM folders WHERE parent_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)';
    const children = await db.query(queryStr, [currentParentId]);
    for (const child of children) {
      subfolderIds.push(child.id);
      queue.push(child.id);
    }
  }

  return subfolderIds;
}

// Check if a folder is a descendant of a target branch (e.g. RAHEE, IRCON, Bikramshila)
async function isFolderUnderBranch(folderId, branchName) {
  if (!folderId) return false;
  let currentId = folderId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const rows = await db.query('SELECT id, name, parent_id FROM folders WHERE id = ?', [currentId]);
    if (!rows || rows.length === 0) break;
    const folder = rows[0];
    if (folder.name.toUpperCase() === branchName.toUpperCase()) {
      return true;
    }
    currentId = folder.parent_id;
  }
  return false;
}

// Check if a folder is the Bikramshila root folder
async function isBikramshilaRoot(folderId) {
  if (!folderId) return true;
  const rows = await db.query('SELECT id, name, parent_id FROM folders WHERE id = ?', [folderId]);
  if (!rows || rows.length === 0) return true;
  const folder = rows[0];
  return folder.parent_id === null || ['BIKRAMSHILA', 'BKS'].includes(folder.name.toUpperCase());
}

// Get all folders for the authenticated user's organization scope
async function getFolders(req, res) {
  try {
    let sql = `
      SELECT f.*, pf.name as parent_folder_name, u.name as creator_name,
        (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id AND (d.is_deleted = 0 OR d.is_deleted IS NULL)) as document_count
      FROM folders f
      LEFT JOIN folders pf ON f.parent_id = pf.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE (f.is_deleted = 0 OR f.is_deleted IS NULL)
    `;
    let params = [];

    const isExecAdmin = req.user.role_name === 'RAHEE_EXEC_ADMIN' || req.user.role_id === 3;
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin && !isExecAdmin) {
      sql += ' AND f.organization_id = ?';
      params.push(req.user.organization_id);
    } else if (req.query.organization_id) {
      sql += ' AND f.organization_id = ?';
      params.push(req.query.organization_id);
    }

    sql += ' ORDER BY f.name ASC';

    const folders = await db.query(sql, params);
    return res.json({ success: true, folders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Create new folder for tenant organization (Company 1 / Company 2 Admin)
async function createFolder(req, res) {
  try {
    const { name, description, parent_id, is_operational } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Folder name is required.' });
    }

    const userEmail = req.user.email?.toLowerCase() || '';
    const userName = req.user.name?.toLowerCase() || '';
    const userRole = req.user.role_name || '';

    const isRahulDey = userEmail === 'rahul.d@rahee.com' || userName.includes('rahul dey') || req.user.id === 5;
    const isRajibGhosh = userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || req.user.is_super_admin || req.user.role_id === 1 || req.user.id === 11;
    const isOmJha = userEmail.startsWith('om.jha@') || userName.includes('om jha') || req.user.id === 10;
    const isSuperAdmin = req.user.is_super_admin || req.user.role_id === 1 || userRole === 'SUPER_ADMIN';

    const isRaheeAdmin = isRahulDey || isRajibGhosh || ((req.user.organization_id === 1 || req.user.organization_code === 'RAHEE') && (
      [2, 3].includes(req.user.role_id) ||
      ['RAHEE_ADMIN', 'RAHEE_ADMIN_REVIEWER', 'RAHEE_EXEC_ADMIN'].includes(userRole) ||
      req.user.designation === 'Admin' ||
      userEmail.startsWith('rahul.d@')
    ));

    const isIrconAdmin = isOmJha || ((req.user.organization_id === 2 || req.user.organization_code === 'IRCON') && (
      [8].includes(req.user.role_id) ||
      ['IRCON_ADMIN', 'IRCON_ADMIN_REVIEWER'].includes(userRole) ||
      req.user.designation === 'Admin' ||
      userEmail.startsWith('om.jha@')
    ));

    if (!isRahulDey && !isRajibGhosh && !isOmJha && !isSuperAdmin && !isRaheeAdmin && !isIrconAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Folder creation is strictly restricted to designated Admins (Rahul Dey for Rahee, Om Jha for Ircon, and Super Admin).'
      });
    }

    const orgId = req.user.organization_id || 1;
    let parentId = parent_id ? parseInt(parent_id) : null;

    // Auto-resolve parent folder if omitted
    if (!parentId) {
      if (isRahulDey || isRaheeAdmin) {
        const raheeFolder = await db.query("SELECT id FROM folders WHERE UPPER(name) = 'RAHEE' LIMIT 1");
        if (raheeFolder.length > 0) parentId = raheeFolder[0].id;
      } else if (isOmJha || isIrconAdmin) {
        const irconFolder = await db.query("SELECT id FROM folders WHERE UPPER(name) = 'IRCON' LIMIT 1");
        if (irconFolder.length > 0) parentId = irconFolder[0].id;
      } else if (isSuperAdmin) {
        const bksFolder = await db.query("SELECT id FROM folders WHERE UPPER(name) = 'BIKRAMSHILA' OR UPPER(name) = 'BKS' LIMIT 1");
        if (bksFolder.length > 0) parentId = bksFolder[0].id;
      }
    }

    let finalOperationalFlag = is_operational ? 1 : 0;

    if (parentId) {
      const parentCheck = await db.query('SELECT id, is_operational, name FROM folders WHERE id = ?', [parentId]);

      if (!parentCheck || parentCheck.length === 0) {
        return res.status(400).json({ success: false, message: 'Selected parent folder does not exist.' });
      }
      if (parentCheck[0].is_operational === 1 || parentCheck[0].is_operational === true) {
        finalOperationalFlag = 1;
      }
    }

    // Check duplicate folder name under same parent
    let existing;
    if (parentId) {
      existing = await db.query('SELECT id FROM folders WHERE parent_id = ? AND LOWER(name) = LOWER(?)', [parentId, name.trim()]);
    } else {
      existing = await db.query('SELECT id FROM folders WHERE parent_id IS NULL AND LOWER(name) = LOWER(?)', [name.trim()]);
    }

    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, message: `Folder '${name.trim()}' already exists in this directory.` });
    }

    const result = await db.query(
      'INSERT INTO folders (organization_id, name, description, created_by, parent_id, is_operational) VALUES (?, ?, ?, ?, ?, ?)',
      [orgId, name.trim(), (description || '').trim(), req.user.id, parentId, finalOperationalFlag]
    );

    const folderId = result.insertId || result.id;

    // Inherit access control permission rules from parent folder if subfolder
    if (parentId) {
      const parentPerms = await db.query('SELECT role_id, user_id, permission_level FROM folder_permissions WHERE folder_id = ?', [parentId]);
      for (const p of parentPerms) {
        await db.query(
          'INSERT INTO folder_permissions (folder_id, role_id, user_id, permission_level) VALUES (?, ?, ?, ?)',
          [folderId, p.role_id, p.user_id, p.permission_level]
        );
      }
    }

    await logAudit({
      organization_id: orgId,
      user_id: req.user.id,
      action: 'FOLDER_CREATED',
      comment: `Created new document folder '${name.trim()}' (ID: ${folderId}${parentId ? `, Parent ID: ${parentId}` : ''}, Operational: ${finalOperationalFlag ? 'Yes' : 'No'}) by ${req.user.name}.`,
      req
    });

    return res.status(201).json({
      success: true,
      message: `Folder '${name.trim()}' created successfully.`,
      folder: {
        id: folderId,
        organization_id: orgId,
        name: name.trim(),
        description: (description || '').trim(),
        created_by: req.user.id,
        parent_id: parentId,
        is_operational: finalOperationalFlag
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Update folder details & Rename Folder (Rahul Dey, Rajib Ghosh, Om Jha, Company Admins & Super Admin)
async function updateFolder(req, res) {
  try {
    const { id } = req.params;
    const { name, description, parent_id, is_operational } = req.body;

    const folders = await db.query('SELECT * FROM folders WHERE id = ?', [id]);
    const folder = folders[0];
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    const userEmail = req.user.email?.toLowerCase() || '';
    const userName = req.user.name?.toLowerCase() || '';
    const userRole = req.user.role_name || '';

    const isRahulDey = userEmail === 'rahul.d@rahee.com' || userName.includes('rahul dey') || req.user.id === 5;
    const isRajibGhosh = userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || req.user.is_super_admin || req.user.role_id === 1 || req.user.id === 11;
    const isOmJha = userEmail.startsWith('om.jha@') || userName.includes('om jha') || req.user.id === 10;
    const isSuperAdmin = req.user.is_super_admin || req.user.role_id === 1 || userRole === 'SUPER_ADMIN';

    const isRaheeAdmin = isRahulDey || isRajibGhosh || ((req.user.organization_id === 1 || req.user.organization_code === 'RAHEE') && (
      [2, 3].includes(req.user.role_id) ||
      ['RAHEE_ADMIN', 'RAHEE_ADMIN_REVIEWER', 'RAHEE_EXEC_ADMIN'].includes(userRole) ||
      req.user.designation === 'Admin'
    ));

    const isIrconAdmin = isOmJha || ((req.user.organization_id === 2 || req.user.organization_code === 'IRCON') && (
      [8].includes(req.user.role_id) ||
      ['IRCON_ADMIN', 'IRCON_ADMIN_REVIEWER'].includes(userRole) ||
      req.user.designation === 'Admin'
    ));

    if (!isRahulDey && !isRajibGhosh && !isOmJha && !isSuperAdmin && !isRaheeAdmin && !isIrconAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Folder rename and modification is restricted to Rahul Dey, Rajib Ghosh, Om Jha, and Company Admins.'
      });
    }

    // Tenant Isolation Check (Super Admin & Rajib Ghosh can rename any folder; Company Admins rename their company's)
    if (!isSuperAdmin && !isRajibGhosh && folder.organization_id && req.user.organization_id && parseInt(folder.organization_id) !== parseInt(req.user.organization_id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot modify a folder belonging to another organization.'
      });
    }

    const newName = name && name.trim() ? name.trim() : folder.name;
    const newDesc = description !== undefined ? (description || '').trim() : folder.description;
    const newParentId = parent_id !== undefined ? (parent_id ? parseInt(parent_id) : null) : folder.parent_id;
    const newOperational = is_operational !== undefined ? (is_operational ? 1 : 0) : folder.is_operational;

    // Check duplicate name under the same parent
    if (newName.toLowerCase() !== folder.name.toLowerCase()) {
      let existing;
      if (newParentId) {
        existing = await db.query(
          'SELECT id FROM folders WHERE parent_id = ? AND LOWER(name) = LOWER(?) AND id != ?',
          [newParentId, newName, id]
        );
      } else {
        existing = await db.query(
          'SELECT id FROM folders WHERE parent_id IS NULL AND LOWER(name) = LOWER(?) AND id != ?',
          [newName, id]
        );
      }
      if (existing && existing.length > 0) {
        return res.status(400).json({ success: false, message: `A folder named '${newName}' already exists in this directory.` });
      }
    }

    await db.query(
      'UPDATE folders SET name = ?, description = ?, parent_id = ?, is_operational = ? WHERE id = ?',
      [newName, newDesc, newParentId, newOperational, id]
    );

    const isRenamed = newName !== folder.name;
    await logAudit({
      organization_id: folder.organization_id,
      user_id: req.user.id,
      action: isRenamed ? 'FOLDER_RENAMED' : 'FOLDER_UPDATED',
      comment: isRenamed
        ? `Folder ID ${id} renamed from '${folder.name}' to '${newName}' by ${req.user.name}.`
        : `Updated folder '${newName}' (ID: ${id}) by ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: isRenamed ? `Folder renamed to '${newName}' successfully.` : `Folder '${newName}' updated successfully.`,
      folder: {
        id: parseInt(id),
        organization_id: folder.organization_id,
        name: newName,
        description: newDesc,
        parent_id: newParentId,
        is_operational: newOperational
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Access Control Permissions for a folder & subfolders
async function getFolderPermissions(req, res) {
  try {
    const { id } = req.params;

    const folders = await db.query('SELECT * FROM folders WHERE id = ?', [id]);
    const folder = folders[0];
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    const permissions = await db.query(
      `SELECT fp.*, r.name as role_name, r.description as role_description, u.name as user_name, u.email as user_email
       FROM folder_permissions fp
       LEFT JOIN roles r ON fp.role_id = r.id
       LEFT JOIN users u ON fp.user_id = u.id
       WHERE fp.folder_id = ?
       ORDER BY fp.id ASC`,
      [id]
    );

    return res.json({
      success: true,
      folder,
      permissions
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Set/Update Access Control Permissions for a folder and optionally all subfolders (Admin ONLY)
async function updateFolderPermissions(req, res) {
  try {
    const { id } = req.params;
    const { permissions, apply_to_subfolders } = req.body; // permissions: Array of { role_id, user_id, permission_level }

    const folders = await db.query('SELECT * FROM folders WHERE id = ?', [id]);
    const folder = folders[0];
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    if (!req.user.is_super_admin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access control configuration is strictly restricted to Super Admin ONLY.' });
    }

    // Determine target folder IDs (single folder or recursive subfolders)
    let targetFolderIds = [parseInt(id)];
    if (apply_to_subfolders) {
      const subfolderIds = await getAllSubfolderIds(parseInt(id));
      targetFolderIds = targetFolderIds.concat(subfolderIds);
    }

    for (const fId of targetFolderIds) {
      // Clear existing permission entries for target folder
      await db.query('DELETE FROM folder_permissions WHERE folder_id = ?', [fId]);

      // Insert new permission rules
      if (Array.isArray(permissions)) {
        for (const p of permissions) {
          const roleId = p.role_id ? parseInt(p.role_id) : null;
          const userId = p.user_id ? parseInt(p.user_id) : null;
          const level = p.permission_level || 'FULL_CONTROL';

          if (roleId || userId) {
            await db.query(
              'INSERT INTO folder_permissions (folder_id, role_id, user_id, permission_level) VALUES (?, ?, ?, ?)',
              [fId, roleId, userId, level]
            );
          }
        }
      }
    }

    await logAudit({
      organization_id: folder.organization_id,
      user_id: req.user.id,
      action: 'FOLDER_PERMISSIONS_UPDATED',
      comment: `Updated access control permissions for folder '${folder.name}' (ID: ${id})${apply_to_subfolders ? ` and ${targetFolderIds.length - 1} subfolders` : ''}.`,
      req
    });

    return res.json({
      success: true,
      message: `Access control permissions updated successfully for '${folder.name}'${apply_to_subfolders ? ` and its subfolders.` : '.'}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Delete folder (Restricted to Rahul Dey, Rajib Ghosh, Om Jha, Company Admins & Super Admin)
async function deleteFolder(req, res) {
  try {
    const { id } = req.params;
    const userEmail = req.user.email?.toLowerCase() || '';
    const userName = req.user.name?.toLowerCase() || '';
    const userRole = req.user.role_name || '';

    const isRahulDey = userEmail === 'rahul.d@rahee.com' || userName.includes('rahul dey') || req.user.id === 5;
    const isRajibGhosh = userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || req.user.is_super_admin || req.user.role_id === 1 || req.user.id === 11;
    const isOmJha = userEmail.startsWith('om.jha@') || userName.includes('om jha') || req.user.id === 10;
    const isSuperAdmin = req.user.is_super_admin || req.user.role_id === 1 || userRole === 'SUPER_ADMIN';

    const targetFolderId = parseInt(id);
    const isRaheeAdmin = isRahulDey || isRajibGhosh || ((req.user.organization_id === 1 || req.user.organization_code === 'RAHEE') && (
      [2, 3].includes(req.user.role_id) ||
      ['RAHEE_ADMIN', 'RAHEE_ADMIN_REVIEWER', 'RAHEE_EXEC_ADMIN'].includes(userRole) ||
      req.user.designation === 'Admin' ||
      userEmail.startsWith('rahul.d@')
    ));

    const isIrconAdmin = isOmJha || ((req.user.organization_id === 2 || req.user.organization_code === 'IRCON') && (
      [8].includes(req.user.role_id) ||
      ['IRCON_ADMIN', 'IRCON_ADMIN_REVIEWER'].includes(userRole) ||
      req.user.designation === 'Admin' ||
      userEmail.startsWith('om.jha@')
    ));

    if (!isRahulDey && !isRajibGhosh && !isOmJha && !isSuperAdmin && !isRaheeAdmin && !isIrconAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Folder deletion is restricted to Rahul Dey, Rajib Ghosh, Om Jha, and Company Admins.'
      });
    }

    const folders = await db.query('SELECT * FROM folders WHERE id = ?', [targetFolderId]);
    const folder = folders[0];
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    // Protect primary root folder
    if (folder.name.toUpperCase() === 'BIKRAMSHILA' || (folder.parent_id === null && !folder.organization_id)) {
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Security Constraint: Primary root directory cannot be deleted.'
        });
      }
    }

    // Tenant Isolation Check (Super Admin & Rajib Ghosh can delete any; Company Admins delete their company's)
    if (!isSuperAdmin && !isRajibGhosh && folder.organization_id && req.user.organization_id && parseInt(folder.organization_id) !== parseInt(req.user.organization_id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot delete a folder belonging to another organization.'
      });
    }

    // Get all descendant subfolder IDs (including any subfolders under this folder)
    const subfolderIds = await getAllSubfolderIds(targetFolderId, true);
    const allFolderIds = [targetFolderId, ...subfolderIds];
    const placeholders = allFolderIds.map(() => '?').join(',');

    // 1. Soft-delete all documents inside this folder and all its subfolders (preserve original_folder_id)
    await db.query(
      `UPDATE documents 
       SET is_deleted = 1, 
           deleted_at = NOW(), 
           deleted_by = ?, 
           original_folder_id = COALESCE(folder_id, original_folder_id) 
       WHERE folder_id IN (${placeholders}) AND (is_deleted = 0 OR is_deleted IS NULL)`,
      [req.user.id, ...allFolderIds]
    );

    // 2. Soft-delete the folders and all subfolders (preserve original_parent_id)
    await db.query(
      `UPDATE folders 
       SET is_deleted = 1, 
           deleted_at = NOW(), 
           deleted_by = ?, 
           original_parent_id = COALESCE(parent_id, original_parent_id) 
       WHERE id IN (${placeholders})`,
      [req.user.id, ...allFolderIds]
    );

    await logAudit({
      organization_id: folder.organization_id || 1,
      user_id: req.user.id,
      action: 'FOLDER_DELETED',
      comment: `Folder '${folder.name}' (ID: ${targetFolderId}${subfolderIds.length > 0 ? ` and ${subfolderIds.length} subfolders` : ''}) moved to Recycle Bin by ${req.user.name}.`,
      req
    });

    return res.json({ 
      success: true, 
      message: `Folder '${folder.name}' moved to Recycle Bin. Super Admin (Rajib Ghosh) can restore it at any time.` 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getFolders,
  createFolder,
  updateFolder,
  getFolderPermissions,
  updateFolderPermissions,
  deleteFolder
};
