const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { uploadDir } = require('../config/storage');
const { logAudit } = require('../services/audit.service');

// Helper to check Super Admin permission strictly
function isSuperAdminUser(user) {
  if (!user) return false;
  const userEmail = (user.email || '').toLowerCase();
  const userName = (user.name || '').toLowerCase();
  const userRole = user.role_name || '';
  return (
    user.is_super_admin ||
    user.role_id === 1 ||
    userRole === 'SUPER_ADMIN' ||
    userEmail === 'rajib.g@rahee.com' ||
    userName.includes('rajib ghosh') ||
    user.id === 11
  );
}

// Recursive helper to get all subfolder IDs under a given parent folder ID
async function getAllSubfolderIds(folderId) {
  const subfolderIds = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const currentParentId = queue.shift();
    const children = await db.query('SELECT id FROM folders WHERE parent_id = ? OR original_parent_id = ?', [currentParentId, currentParentId]);
    for (const child of children) {
      if (!subfolderIds.includes(child.id)) {
        subfolderIds.push(child.id);
        queue.push(child.id);
      }
    }
  }

  return subfolderIds;
}

// Build hierarchical folder path string for any folder ID
async function computeFolderPath(folderId, allFoldersMap = null) {
  if (!folderId) return 'Root / Uncategorized';

  if (!allFoldersMap) {
    const rows = await db.query('SELECT id, name, parent_id, original_parent_id, organization_id FROM folders');
    allFoldersMap = new Map();
    rows.forEach(r => allFoldersMap.set(r.id, r));
  }

  const parts = [];
  let currId = parseInt(folderId);
  const visited = new Set();

  while (currId && !visited.has(currId) && allFoldersMap.has(currId)) {
    visited.add(currId);
    const folder = allFoldersMap.get(currId);
    parts.unshift(folder.name);
    currId = folder.original_parent_id || folder.parent_id;
  }

  return parts.length > 0 ? parts.join(' / ') : 'Root / Uncategorized';
}

// 1. Get all deleted folders and deleted files in Recycle Bin (Super Admin Rajib Ghosh Only)
async function getDeletedItems(req, res) {
  try {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Access to the Recycle Bin is strictly restricted to Super Administrator (Rajib Ghosh).'
      });
    }

    // Retrieve all folders in DB to construct complete breadcrumb path strings
    const allFoldersRows = await db.query('SELECT id, name, parent_id, original_parent_id, organization_id FROM folders');
    const allFoldersMap = new Map();
    allFoldersRows.forEach(r => allFoldersMap.set(r.id, r));

    // 1. Fetch Deleted Folders
    const deletedFolders = await db.query(`
      SELECT f.id, f.name, f.description, f.organization_id, f.parent_id, f.original_parent_id,
             f.is_operational, f.created_by, f.created_at, f.deleted_at, f.deleted_by,
             u.name as deleted_by_name, u.email as deleted_by_email,
             o.name as organization_name, o.code as organization_code,
             (SELECT COUNT(*) FROM documents d WHERE (d.folder_id = f.id OR d.original_folder_id = f.id)) as document_count,
             (SELECT COUNT(*) FROM folders sf WHERE (sf.parent_id = f.id OR sf.original_parent_id = f.id)) as subfolder_count
      FROM folders f
      LEFT JOIN users u ON f.deleted_by = u.id
      LEFT JOIN organizations o ON f.organization_id = o.id
      WHERE f.is_deleted = 1
      ORDER BY f.deleted_at DESC, f.id DESC
    `);

    // Add full path details for folders
    const formattedFolders = await Promise.all(
      deletedFolders.map(async (folder) => {
        const parentTargetId = folder.original_parent_id || folder.parent_id;
        const parentPath = parentTargetId ? await computeFolderPath(parentTargetId, allFoldersMap) : 'Root Directory';
        const fullPath = parentTargetId ? `${parentPath} / ${folder.name}` : folder.name;

        return {
          ...folder,
          item_type: 'FOLDER',
          original_parent_path: parentPath,
          full_path: fullPath
        };
      })
    );

    // 2. Fetch Deleted Documents
    const deletedDocs = await db.query(`
      SELECT d.id, d.organization_id, d.uploaded_by, d.title, d.description, d.category, d.document_type,
             d.status, d.current_version_id, d.current_version_number, d.is_locked, d.folder_id, d.original_folder_id,
             d.created_at, d.updated_at, d.deleted_at, d.deleted_by,
             u.name as deleted_by_name, u.email as deleted_by_email,
             up.name as uploader_name, up.email as uploader_email,
             o.name as organization_name, o.code as organization_code,
             v.original_filename, v.file_size, v.mime_type
      FROM documents d
      LEFT JOIN users u ON d.deleted_by = u.id
      LEFT JOIN users up ON d.uploaded_by = up.id
      LEFT JOIN organizations o ON d.organization_id = o.id
      LEFT JOIN document_versions v ON d.current_version_id = v.id
      WHERE d.is_deleted = 1
      ORDER BY d.deleted_at DESC, d.id DESC
    `);

    // Add full path details for documents
    const formattedDocuments = await Promise.all(
      deletedDocs.map(async (doc) => {
        const targetFolderId = doc.original_folder_id || doc.folder_id;
        let folderPath = 'Root / Uncategorized';
        let folderName = 'Uncategorized';

        if (targetFolderId && allFoldersMap.has(targetFolderId)) {
          folderName = allFoldersMap.get(targetFolderId).name;
          folderPath = await computeFolderPath(targetFolderId, allFoldersMap);
        }

        const fullPath = `${folderPath} / ${doc.title}`;

        return {
          ...doc,
          item_type: 'DOCUMENT',
          target_folder_name: folderName,
          target_folder_path: folderPath,
          full_path: fullPath
        };
      })
    );

    // Summary statistics
    const totalFolders = formattedFolders.length;
    const totalDocuments = formattedDocuments.length;
    const totalDeleted = totalFolders + totalDocuments;
    const totalBytes = formattedDocuments.reduce((acc, curr) => acc + (parseInt(curr.file_size) || 0), 0);

    return res.json({
      success: true,
      folders: formattedFolders,
      documents: formattedDocuments,
      stats: {
        totalDeleted,
        totalFolders,
        totalDocuments,
        totalBytes
      }
    });
  } catch (err) {
    console.error('getDeletedItems Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 2. Restore Folder back to its exact original path (Super Admin Rajib Ghosh Only)
async function restoreFolder(req, res) {
  try {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Folder restoration is strictly restricted to Super Administrator (Rajib Ghosh).'
      });
    }

    const { id } = req.params;
    const folderId = parseInt(id);

    const folders = await db.query('SELECT * FROM folders WHERE id = ?', [folderId]);
    const folder = folders[0];
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found in Recycle Bin.' });
    }

    // Recursively find and restore all ancestor folders if any parent was also deleted
    let currentParentId = folder.original_parent_id || folder.parent_id;
    const visited = new Set();
    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      const parentRows = await db.query('SELECT id, is_deleted, original_parent_id, parent_id FROM folders WHERE id = ?', [currentParentId]);
      if (parentRows.length === 0) break;
      const parent = parentRows[0];
      if (parent.is_deleted === 1) {
        await db.query(
          'UPDATE folders SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL, parent_id = COALESCE(parent_id, original_parent_id) WHERE id = ?',
          [parent.id]
        );
      }
      currentParentId = parent.original_parent_id || parent.parent_id;
    }

    // Get all descendant subfolders of this folder
    const subfolderIds = await getAllSubfolderIds(folderId);
    const allFolderIds = [folderId, ...subfolderIds];
    const placeholders = allFolderIds.map(() => '?').join(',');

    // 1. Restore folder and all subfolders
    await db.query(
      `UPDATE folders 
       SET is_deleted = 0, 
           deleted_at = NULL, 
           deleted_by = NULL, 
           parent_id = COALESCE(parent_id, original_parent_id) 
       WHERE id IN (${placeholders})`,
      allFolderIds
    );

    // 2. Restore all documents that belong to this folder and its subfolders
    await db.query(
      `UPDATE documents 
       SET is_deleted = 0, 
           deleted_at = NULL, 
           deleted_by = NULL, 
           folder_id = COALESCE(folder_id, original_folder_id) 
       WHERE (folder_id IN (${placeholders}) OR original_folder_id IN (${placeholders})) AND is_deleted = 1`,
      [...allFolderIds, ...allFolderIds]
    );

    await logAudit({
      organization_id: folder.organization_id || 1,
      user_id: req.user.id,
      action: 'FOLDER_RESTORED',
      comment: `Restored folder '${folder.name}' (ID: ${folderId}${subfolderIds.length > 0 ? ` with ${subfolderIds.length} subfolders` : ''}) from Recycle Bin back to its original location by Super Admin ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: `Folder '${folder.name}' and all its contents were successfully restored to their original location.`,
      folderId
    });
  } catch (err) {
    console.error('restoreFolder Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 3. Restore Document back to its exact original path (Super Admin Rajib Ghosh Only)
async function restoreDocument(req, res) {
  try {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Document restoration is strictly restricted to Super Administrator (Rajib Ghosh).'
      });
    }

    const { id } = req.params;
    const docId = parseInt(id);

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [docId]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found in Recycle Bin.' });
    }

    const targetFolderId = doc.original_folder_id || doc.folder_id;

    // If destination folder was also deleted, restore that folder hierarchy automatically
    if (targetFolderId) {
      let currFolderId = targetFolderId;
      const visited = new Set();
      while (currFolderId && !visited.has(currFolderId)) {
        visited.add(currFolderId);
        const folderRows = await db.query('SELECT id, is_deleted, original_parent_id, parent_id FROM folders WHERE id = ?', [currFolderId]);
        if (folderRows.length === 0) break;
        const folder = folderRows[0];
        if (folder.is_deleted === 1) {
          await db.query(
            'UPDATE folders SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL, parent_id = COALESCE(parent_id, original_parent_id) WHERE id = ?',
            [folder.id]
          );
        }
        currFolderId = folder.original_parent_id || folder.parent_id;
      }
    }

    // Restore document
    await db.query(
      `UPDATE documents 
       SET is_deleted = 0, 
           deleted_at = NULL, 
           deleted_by = NULL, 
           folder_id = COALESCE(folder_id, original_folder_id) 
       WHERE id = ?`,
      [docId]
    );

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_RESTORED',
      document_id: docId,
      version: doc.current_version_number,
      comment: `Restored document '${doc.title}' (ID: ${docId}) from Recycle Bin back to its original location by Super Admin ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: `Document '${doc.title}' was successfully restored back to its original location.`,
      docId
    });
  } catch (err) {
    console.error('restoreDocument Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 4. Restore All deleted folders and files (Super Admin Rajib Ghosh Only)
async function restoreAll(req, res) {
  try {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Batch restoration is strictly restricted to Super Administrator (Rajib Ghosh).'
      });
    }

    // 1. Restore all folders
    await db.query(`
      UPDATE folders 
      SET is_deleted = 0, 
          deleted_at = NULL, 
          deleted_by = NULL, 
          parent_id = COALESCE(parent_id, original_parent_id) 
      WHERE is_deleted = 1
    `);

    // 2. Restore all documents
    await db.query(`
      UPDATE documents 
      SET is_deleted = 0, 
          deleted_at = NULL, 
          deleted_by = NULL, 
          folder_id = COALESCE(folder_id, original_folder_id) 
      WHERE is_deleted = 1
    `);

    await logAudit({
      organization_id: req.user.organization_id || 1,
      user_id: req.user.id,
      action: 'RECYCLE_BIN_RESTORED_ALL',
      comment: `All deleted folders and documents were restored from Recycle Bin back to their original locations by Super Admin ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: 'All deleted folders and files have been successfully restored to their original locations.'
    });
  } catch (err) {
    console.error('restoreAll Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 5. Permanently Purge a Document (Super Admin Only)
async function permanentDeleteDocument(req, res) {
  try {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Permanent purging is strictly restricted to Super Administrator (Rajib Ghosh).'
      });
    }

    const { id } = req.params;
    const docId = parseInt(id);

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [docId]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Remove physical files on disk for all versions
    const versions = await db.query('SELECT storage_key FROM document_versions WHERE document_id = ?', [docId]);
    for (const v of versions) {
      if (v.storage_key) {
        const filePath = path.join(uploadDir, v.storage_key);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
    }

    // Delete DB records
    await db.query('DELETE FROM document_versions WHERE document_id = ?', [docId]);
    await db.query('DELETE FROM document_reviews WHERE document_id = ?', [docId]);
    await db.query('DELETE FROM documents WHERE id = ?', [docId]);

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_PURGED',
      comment: `Permanently purged document '${doc.title}' (ID: ${docId}) from system storage by Super Admin ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: `Document '${doc.title}' permanently purged from the system.`
    });
  } catch (err) {
    console.error('permanentDeleteDocument Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 6. Permanently Purge a Folder (Super Admin Only)
async function permanentDeleteFolder(req, res) {
  try {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Permanent purging is strictly restricted to Super Administrator (Rajib Ghosh).'
      });
    }

    const { id } = req.params;
    const folderId = parseInt(id);

    const folders = await db.query('SELECT * FROM folders WHERE id = ?', [folderId]);
    const folder = folders[0];
    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found.' });
    }

    const subfolderIds = await getAllSubfolderIds(folderId);
    const allFolderIds = [folderId, ...subfolderIds];
    const placeholders = allFolderIds.map(() => '?').join(',');

    // Delete associated permissions
    await db.query(`DELETE FROM folder_permissions WHERE folder_id IN (${placeholders})`, allFolderIds);

    // Unlink any remaining active documents
    await db.query(`UPDATE documents SET folder_id = NULL, original_folder_id = NULL WHERE folder_id IN (${placeholders}) OR original_folder_id IN (${placeholders})`, [...allFolderIds, ...allFolderIds]);

    // Delete folders
    await db.query(`DELETE FROM folders WHERE id IN (${placeholders})`, allFolderIds);

    await logAudit({
      organization_id: folder.organization_id || 1,
      user_id: req.user.id,
      action: 'FOLDER_PURGED',
      comment: `Permanently purged folder '${folder.name}' (ID: ${folderId}${subfolderIds.length > 0 ? ` and ${subfolderIds.length} subfolders` : ''}) by Super Admin ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: `Folder '${folder.name}' permanently deleted.`
    });
  } catch (err) {
    console.error('permanentDeleteFolder Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// 7. Empty entire Recycle Bin (Super Admin Only)
async function emptyRecycleBin(req, res) {
  try {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Emptying the Recycle Bin is strictly restricted to Super Administrator (Rajib Ghosh).'
      });
    }

    // 1. Delete physical files for all deleted documents
    const deletedDocs = await db.query('SELECT id FROM documents WHERE is_deleted = 1');
    for (const d of deletedDocs) {
      const versions = await db.query('SELECT storage_key FROM document_versions WHERE document_id = ?', [d.id]);
      for (const v of versions) {
        if (v.storage_key) {
          const filePath = path.join(uploadDir, v.storage_key);
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) {}
          }
        }
      }
      await db.query('DELETE FROM document_versions WHERE document_id = ?', [d.id]);
      await db.query('DELETE FROM document_reviews WHERE document_id = ?', [d.id]);
      await db.query('DELETE FROM documents WHERE id = ?', [d.id]);
    }

    // 2. Delete all deleted folders
    const deletedFolders = await db.query('SELECT id FROM folders WHERE is_deleted = 1');
    const folderIds = deletedFolders.map(f => f.id);
    if (folderIds.length > 0) {
      const placeholders = folderIds.map(() => '?').join(',');
      await db.query(`DELETE FROM folder_permissions WHERE folder_id IN (${placeholders})`, folderIds);
      await db.query(`DELETE FROM folders WHERE id IN (${placeholders})`, folderIds);
    }

    await logAudit({
      organization_id: req.user.organization_id || 1,
      user_id: req.user.id,
      action: 'RECYCLE_BIN_EMPTIED',
      comment: `Recycle Bin completely emptied and purged by Super Admin ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: 'Recycle Bin emptied successfully. All deleted files and folders have been permanently purged.'
    });
  } catch (err) {
    console.error('emptyRecycleBin Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getDeletedItems,
  restoreFolder,
  restoreDocument,
  restoreAll,
  permanentDeleteDocument,
  permanentDeleteFolder,
  emptyRecycleBin
};
