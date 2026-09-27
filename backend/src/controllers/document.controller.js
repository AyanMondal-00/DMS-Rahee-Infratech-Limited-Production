const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const db = require('../config/db');
const { calculateFileHash, uploadDir } = require('../config/storage');
const { sendNotification } = require('../services/notification.service');
const { logAudit } = require('../services/audit.service');
const { runArchivalPolicy } = require('../services/archival.service');
const { 
  WORKFLOW_REVIEW_ENABLED,
  MULTI_TENANT_ISOLATION_ENABLED,
  STATIC_VERSION_V1_ONLY,
  ONLY_SUPER_ADMIN_CAN_DELETE,
  OPERATIONAL_FOLDER_ENABLED,
  BKS_FOLDER_MODE
} = require('../config/workflow.config');

// Upload Initial Document(s) (V1) - Supports both Single and Multiple Documents at a single time
async function uploadDocument(req, res) {
  let uploadedFiles = [];
  if (req.files) {
    if (Array.isArray(req.files)) {
      uploadedFiles = req.files;
    } else if (typeof req.files === 'object') {
      Object.values(req.files).forEach(item => {
        if (Array.isArray(item)) uploadedFiles.push(...item);
        else if (item) uploadedFiles.push(item);
      });
    }
  } else if (req.file) {
    uploadedFiles = [req.file];
  }

  const cleanUploadedFiles = () => {
    uploadedFiles.forEach(f => {
      if (f && f.path && fs.existsSync(f.path)) {
        try { fs.unlinkSync(f.path); } catch (e) {}
      }
    });
  };

  try {
    // STRICT RULE: Only Rahul Dey, Om Jha, and Somnath Mondal can upload documents
    const userEmail = (req.user.email || '').toLowerCase().trim();
    const userName = (req.user.name || '').toLowerCase().trim();
    const isAuthorizedUploader = 
      userEmail === 'rahul.d@rahee.com' ||
      userEmail.startsWith('om.jha@') ||
      userEmail === 's.mondal@rahee.com' ||
      userName.includes('rahul dey') ||
      userName.includes('om jha') ||
      userName.includes('somnath mondal') ||
      [5, 9, 10].includes(req.user.id);

    if (!isAuthorizedUploader) {
      cleanUploadedFiles();
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Document upload is strictly restricted to Rahul Dey, Om Jha, and Somnath Mondal.'
      });
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one document file to upload.' });
    }

    const organizationId = req.user.organization_id;
    if (!organizationId && !req.user.is_super_admin) {
      cleanUploadedFiles();
      return res.status(403).json({ success: false, message: 'User does not belong to an active organization.' });
    }

    const orgIdToUse = req.user.organization_id ? parseInt(req.user.organization_id) : 1;

    // Parse files_metadata if provided
    let filesMetadata = [];
    if (req.body.files_metadata) {
      try {
        filesMetadata = typeof req.body.files_metadata === 'string' 
          ? JSON.parse(req.body.files_metadata) 
          : req.body.files_metadata;
      } catch (e) {
        filesMetadata = [];
      }
    }

    // Determine document type label and enforce strict format matching validation
    const docTypeMap = {
      PDF: 'PDF',
      DOC: 'WORD',
      DOCX: 'WORD',
      XLS: 'EXCEL',
      XLSX: 'EXCEL',
      PPT: 'POWERPOINT',
      PPTX: 'POWERPOINT',
      JPG: 'IMAGE',
      JPEG: 'IMAGE',
      PNG: 'IMAGE',
      WEBP: 'IMAGE',
      SVG: 'IMAGE',
      DWG: 'CAD',
      DXF: 'CAD',
      STL: 'CAD',
      OBJ: 'CAD',
      STEP: 'CAD',
      STP: 'CAD',
      IGES: 'CAD'
    };

    const typeLabels = {
      PDF: 'PDF Document',
      WORD: 'Microsoft Word',
      EXCEL: 'Microsoft Excel',
      POWERPOINT: 'Microsoft PowerPoint',
      IMAGE: 'Image',
      CAD: 'CAD Drawing / 3D Model'
    };

    // Pre-validate all uploaded files before inserting into database
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const ext = path.extname(file.originalname).toUpperCase().replace('.', '');
      const actualDetectedType = docTypeMap[ext];

      if (!actualDetectedType) {
        cleanUploadedFiles();
        return res.status(400).json({
          success: false,
          message: `File "${file.originalname}" has an unsupported format (.${ext.toLowerCase()}). Supported formats: PDF, Word, Excel, PowerPoint, Images, and CAD files (.dwg, .dxf, .stl, .obj, .step, .stp, .iges).`
        });
      }

      // Check per-file or global selected type mismatch if specified (unless AUTO or not specified)
      const meta = filesMetadata.find(m => m.filename === file.originalname || m.index === i) || {};
      const fileSelectedType = (meta.document_type || (uploadedFiles.length === 1 ? req.body.document_type : ''))?.trim().toUpperCase();
      if (fileSelectedType && fileSelectedType !== 'AUTO' && ['PDF', 'WORD', 'EXCEL', 'POWERPOINT', 'IMAGE', 'CAD'].includes(fileSelectedType)) {
        if (fileSelectedType !== actualDetectedType) {
          cleanUploadedFiles();
          const selectedLabel = typeLabels[fileSelectedType] || fileSelectedType;
          const detectedLabel = typeLabels[actualDetectedType] || actualDetectedType;
          return res.status(400).json({
            success: false,
            message: `Validation Error for "${file.originalname}": You selected '${selectedLabel}', but uploaded a ${detectedLabel} file (.${ext.toLowerCase()}).`
          });
        }
      }
    }

    // Helper to check folder branch ancestor
    async function isFolderUnderBranch(fId, branchName) {
      if (!fId) return false;
      let currentId = fId;
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

    let defaultFolderId = req.body.folder_id ? parseInt(req.body.folder_id) : null;
    const isIrconUser = (req.user.organization_id === 2 || req.user.role_id === 8 || req.user.role_name === 'IRCON_ADMIN_REVIEWER' || req.user.role_name === 'IRCON_ADMIN' || userEmail.startsWith('om.jha@'));
    const userBranch = isIrconUser ? 'IRCON' : 'RAHEE';

    if (!req.user.is_super_admin) {
      if (defaultFolderId) {
        const isUnderOwnBranch = await isFolderUnderBranch(defaultFolderId, userBranch);
        if (!isUnderOwnBranch) {
          const defaultSub = await db.query('SELECT id FROM folders WHERE UPPER(name) = ?', [userBranch]);
          if (defaultSub && defaultSub.length > 0) {
            defaultFolderId = defaultSub[0].id;
          }
        }
      } else {
        const defaultSub = await db.query('SELECT id FROM folders WHERE UPPER(name) = ?', [userBranch]);
        if (defaultSub && defaultSub.length > 0) {
          defaultFolderId = defaultSub[0].id;
        }
      }
    }

    const initialStatus = WORKFLOW_REVIEW_ENABLED ? 'PENDING_REVIEW_1' : 'FINAL_APPROVED';
    const verTag = STATIC_VERSION_V1_ONLY ? 'General Version V1' : 'V1';
    const createdDocuments = [];

    // Pre-fetch target notification users
    const targetUsers = await db.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.role_id, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE (u.organization_id = ? OR u.organization_id IS NULL OR r.name = 'SUPER_ADMIN')
         AND u.status = 'ACTIVE'`,
      [orgIdToUse]
    );

    const EXCLUDED_NOTIF_EMAILS = [
      'manish.p@rahee.com',
      'ayush.k@rahee.com',
      'manoj.g@rahee.com',
      'arunabha.p@rahee.com'
    ];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const ext = path.extname(file.originalname).toUpperCase().replace('.', '');
      const actualDetectedType = docTypeMap[ext] || 'OTHER';

      const meta = filesMetadata.find(m => m.filename === file.originalname || m.index === i) || {};

      // Determine clean Title
      let fileTitle = '';
      if (meta.title && meta.title.trim()) {
        fileTitle = meta.title.trim();
      } else if (uploadedFiles.length === 1 && req.body.title && req.body.title.trim()) {
        fileTitle = req.body.title.trim();
      } else {
        const lastDot = file.originalname.lastIndexOf('.');
        const rawClean = lastDot !== -1 ? file.originalname.slice(0, lastDot) : file.originalname;
        fileTitle = rawClean.replace(/[_]/g, ' ').trim();
      }

      if (fileTitle.length > 255) {
        fileTitle = fileTitle.substring(0, 255);
      }

      const fileDescription = (meta.description !== undefined ? meta.description : (req.body.description || '')).trim();
      const fileCategory = (meta.category || req.body.category || 'General').trim();
      const fileDocType = (meta.document_type || (uploadedFiles.length === 1 && req.body.document_type ? req.body.document_type : actualDetectedType)).trim().toUpperCase();

      let fileFolderId = meta.folder_id ? parseInt(meta.folder_id) : defaultFolderId;
      if (!req.user.is_super_admin && fileFolderId) {
        const isUnder = await isFolderUnderBranch(fileFolderId, userBranch);
        if (!isUnder) fileFolderId = defaultFolderId;
      }

      // SHA-256 Hash
      const fileHash = await calculateFileHash(file.path);

      // 1. Insert Document
      const docRes = await db.query(
        `INSERT INTO documents (organization_id, uploaded_by, title, description, category, document_type, status, current_version_number, is_locked, folder_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [orgIdToUse, req.user.id, fileTitle, fileDescription, fileCategory, fileDocType, initialStatus, verTag, fileFolderId]
      );

      const documentId = docRes.insertId;

      // 2. Insert Version
      const verRes = await db.query(
        `INSERT INTO document_versions (document_id, organization_id, version_number, version_index, original_filename, storage_key, file_size, mime_type, file_hash, uploaded_by, change_description, review_status)
         VALUES (?, ?, ?, 1.0, ?, ?, ?, ?, ?, ?, 'Initial document submission', ?)`,
        [documentId, orgIdToUse, verTag, file.originalname, file.filename, file.size, file.mimetype, fileHash, req.user.id, initialStatus]
      );

      const versionId = verRes.insertId;

      // Update current_version_id
      await db.query('UPDATE documents SET current_version_id = ? WHERE id = ?', [versionId, documentId]);

      // 3. Dispatch Notification
      for (const targetUser of targetUsers) {
        if (targetUser.email && EXCLUDED_NOTIF_EMAILS.includes(targetUser.email.toLowerCase())) {
          continue;
        }

        const isUploader = targetUser.id === req.user.id;
        const notifTitle = isUploader 
          ? '📄 Document Uploaded Successfully' 
          : `🔔 New Document Uploaded: ${fileTitle}`;
        
        const notifMessage = isUploader
          ? WORKFLOW_REVIEW_ENABLED 
            ? `Your document "${fileTitle}" (${verTag}) has been uploaded successfully and submitted for workflow review.`
            : `Your document "${fileTitle}" (${verTag}) has been uploaded successfully and saved to the repository.`
          : `A new document "${fileTitle}" (${verTag}) was uploaded by ${req.user.name} and is available in the repository.`;

        await sendNotification({
          recipientId: targetUser.id,
          senderId: req.user.id,
          documentId: documentId,
          organizationId: orgIdToUse,
          title: notifTitle,
          message: notifMessage,
          type: isUploader ? 'DOCUMENT_UPLOAD_SUCCESS' : 'NEW_DOCUMENT_UPLOADED',
          emailDetails: {
            documentTitle: fileTitle,
            documentVersion: verTag
          }
        });
      }

      // 4. Audit Log
      await logAudit({
        organization_id: orgIdToUse,
        user_id: req.user.id,
        action: 'DOCUMENT_UPLOADED',
        document_id: documentId,
        version: verTag,
        comment: `Document '${fileTitle}' uploaded (SHA-256: ${fileHash.substring(0, 10)}...).`,
        req
      });

      createdDocuments.push({
        id: documentId,
        title: fileTitle,
        original_filename: file.originalname,
        document_type: fileDocType,
        version: verTag,
        status: initialStatus
      });
    }

    return res.status(201).json({
      success: true,
      message: createdDocuments.length === 1
        ? (WORKFLOW_REVIEW_ENABLED 
            ? 'Document uploaded successfully and routed to Stage 1 Reviewer.' 
            : 'Document uploaded successfully and saved to repository.')
        : `${createdDocuments.length} documents uploaded successfully and routed to Stage 1 Reviewer.`,
      documentId: createdDocuments[0]?.id,
      documents: createdDocuments,
      count: createdDocuments.length,
      version: verTag,
      status: initialStatus
    });
  } catch (err) {
    cleanUploadedFiles();
    console.error('Document Upload Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'An error occurred during upload.' });
  }
}

// Get Documents (Strict Tenant Isolated)
async function getDocuments(req, res) {
  try {
    let sql = `
      SELECT d.id, d.organization_id, d.uploaded_by, d.title, d.description, d.category, d.document_type,
             d.status, d.current_version_id, d.current_version_number, d.is_locked, d.folder_id, d.created_at, d.updated_at,
             u.name as uploader_name, u.email as uploader_email,
             o.name as organization_name, o.code as organization_code,
             v.original_filename, v.file_size, v.mime_type,
             fl.name as folder_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN organizations o ON d.organization_id = o.id
      LEFT JOIN document_versions v ON d.current_version_id = v.id
      LEFT JOIN folders fl ON d.folder_id = fl.id
    `;
    let params = [];
    let whereClauses = [];

    // Tenant Isolation Filter (Bypassed for BKS cross-visibility when MULTI_TENANT_ISOLATION_ENABLED is false)
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin) {
      whereClauses.push('d.organization_id = ?');
      params.push(req.user.organization_id);
    } else if (req.query.organization_id) {
      whereClauses.push('d.organization_id = ?');
      params.push(req.query.organization_id);
    }

    // Active documents filter (exclude soft-deleted)
    whereClauses.push('(d.is_deleted = 0 OR d.is_deleted IS NULL)');

    // Folder filter (includes target folder AND any nested child subfolders)
    if (req.query.folder_id) {
      if (req.query.folder_id === 'uncategorized') {
        whereClauses.push('(d.folder_id IS NULL OR d.folder_id = 0)');
      } else {
        const rootFolderId = parseInt(req.query.folder_id);
        // Recursive helper to get all subfolder IDs under the selected folder
        const allTargetFolderIds = [rootFolderId];
        const queue = [rootFolderId];
        while (queue.length > 0) {
          const currentParentId = queue.shift();
          const children = await db.query('SELECT id FROM folders WHERE parent_id = ?', [currentParentId]);
          for (const child of children) {
            allTargetFolderIds.push(child.id);
            queue.push(child.id);
          }
        }

        const placeholders = allTargetFolderIds.map(() => '?').join(',');
        whereClauses.push(`d.folder_id IN (${placeholders})`);
        params.push(...allTargetFolderIds);
      }
    }

    // Status filter (supports comma-separated list like PENDING_REVIEW_1,PENDING_REVIEW_2 or status_not=ARCHIVED)
    if (req.query.status) {
      const statuses = req.query.status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        whereClauses.push('d.status = ?');
        params.push(statuses[0]);
      } else {
        const placeholders = statuses.map(() => '?').join(',');
        whereClauses.push(`d.status IN (${placeholders})`);
        params.push(...statuses);
      }
    } else if (req.query.status_not) {
      const notStatuses = req.query.status_not.split(',').map(s => s.trim());
      const placeholders = notStatuses.map(() => '?').join(',');
      whereClauses.push(`(d.status NOT IN (${placeholders}) OR d.status IS NULL)`);
      params.push(...notStatuses);
    } else {
      // Default: Active documents view excludes ARCHIVED documents
      whereClauses.push("(d.status != 'ARCHIVED' OR d.status IS NULL)");
    }

    // Document Type filter (PDF, WORD, EXCEL, POWERPOINT, IMAGE)
    if (req.query.document_type) {
      whereClauses.push('d.document_type = ?');
      params.push(req.query.document_type.trim().toUpperCase());
    }

    // Category filter
    if (req.query.category) {
      whereClauses.push('d.category = ?');
      params.push(req.query.category);
    }

    // Date Range filter (From Date to To Date)
    if (req.query.from_date) {
      whereClauses.push('d.created_at >= ?');
      params.push(`${req.query.from_date.trim()} 00:00:00`);
    }
    if (req.query.to_date) {
      whereClauses.push('d.created_at <= ?');
      params.push(`${req.query.to_date.trim()} 23:59:59`);
    }

    // Search filter
    if (req.query.search) {
      whereClauses.push('(LOWER(d.title) LIKE LOWER(?) OR LOWER(d.description) LIKE LOWER(?))');
      const searchPattern = `%${req.query.search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Compute total matching document count before pagination
    let countSql = 'SELECT COUNT(DISTINCT d.id) as total_count FROM documents d';
    if (whereClauses.length > 0) {
      countSql += ' WHERE ' + whereClauses.join(' AND ');
    }
    const countRes = await db.query(countSql, params);
    const totalCount = countRes[0] ? (countRes[0].total_count || 0) : 0;

    sql += ' ORDER BY d.id DESC';

    const isLimitAll = req.query.limit === 'all' || req.query.pagination === 'false';
    const limit = isLimitAll ? null : (req.query.limit ? parseInt(req.query.limit) : 30);
    const offset = isLimitAll ? 0 : (req.query.offset ? parseInt(req.query.offset) : (req.query.page ? (parseInt(req.query.page) - 1) * (limit || 30) : 0));

    if (limit !== null && limit > 0) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const documents = await db.query(sql, params);
    return res.json({ 
      success: true, 
      documents,
      total: totalCount,
      limit: limit || documents.length,
      offset: offset,
      hasMore: limit !== null ? (offset + documents.length < totalCount) : false
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Get Document Details (With Version History & Review History)
async function getDocumentById(req, res) {
  try {
    const { id } = req.params;

    const docs = await db.query(
      `SELECT d.*, u.name as uploader_name, u.email as uploader_email, o.name as organization_name
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       LEFT JOIN organizations o ON d.organization_id = o.id
       WHERE d.id = ?`,
      [id]
    );

    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Strict Tenant Isolation Check
    const isExecAdmin = req.user.role_name === 'RAHEE_EXEC_ADMIN' || req.user.role_id === 3;
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin && !isExecAdmin && parseInt(doc.organization_id) !== parseInt(req.user.organization_id)) {
      await logAudit({
        organization_id: req.user.organization_id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        comment: `User attempted to view document ID ${id} belonging to Org ${doc.organization_id}.`,
        req
      });
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to view documents from another organization.' });
    }

    // Fetch Version History
    const versions = await db.query(
      `SELECT v.*, u.name as uploader_name 
       FROM document_versions v
       LEFT JOIN users u ON v.uploaded_by = u.id
       WHERE v.document_id = ?
       ORDER BY v.id DESC`,
      [id]
    );

    // Fetch Review Trail History
    const reviews = await db.query(
      `SELECT r.*, u.name as reviewer_name, u.email as reviewer_email, v.version_number
       FROM document_reviews r
       LEFT JOIN users u ON r.reviewer_id = u.id
       LEFT JOIN document_versions v ON r.document_version_id = v.id
       WHERE r.document_id = ?
       ORDER BY r.id ASC`,
      [id]
    );

    // Build folder trail and full path for nano horizontal bar
    let folderTrail = [];
    const targetFolderId = doc.folder_id || doc.original_folder_id;
    if (targetFolderId) {
      let currId = parseInt(targetFolderId);
      const visited = new Set();
      while (currId && !visited.has(currId)) {
        visited.add(currId);
        const folderRows = await db.query('SELECT id, name, parent_id FROM folders WHERE id = ?', [currId]);
        const folder = folderRows[0];
        if (!folder) break;
        if (!folder.parent_id && ['BIKRAMSHILA', 'BKS'].includes((folder.name || '').trim().toUpperCase())) {
          break;
        }
        folderTrail.unshift(folder);
        currId = folder.parent_id;
      }
    }

    doc.folder_trail = folderTrail;
    doc.folder_path = folderTrail.length > 0 
      ? `Bikramshila Drive / ${folderTrail.map(f => f.name).join(' / ')}` 
      : (doc.organization_id === 2 ? 'Bikramshila Drive / IRCON' : 'Bikramshila Drive / RAHEE');

    // Record Audit View Event
    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_VIEWED',
      document_id: doc.id,
      version: doc.current_version_number,
      comment: `Document '${doc.title}' detail viewed.`,
      req
    });

    return res.json({
      success: true,
      document: doc,
      versions,
      reviews,
      workflow_enabled: WORKFLOW_REVIEW_ENABLED
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Upload New Version / Edit Document (Re-submission Cycle)
async function uploadNewVersion(req, res) {
  try {
    if (req.user.is_super_admin) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({ success: false, message: 'Forbidden: Super Admin accounts are restricted from uploading or editing document files.' });
    }

    const { id } = req.params;
    const { change_description } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please attach the updated document file.' });
    }

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [id]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Tenant Check
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin && doc.organization_id !== req.user.organization_id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot edit documents outside your organization.' });
    }

    // Uploader Ownership Check (Strictly original document uploader only can edit/submit revised versions)
    const isUploader = doc.uploaded_by === req.user.id;
    if (!isUploader) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the original document uploader can edit or submit revised versions for this document.'
      });
    }

    // Calculate new version index & number
    const latestVersions = await db.query(
      'SELECT version_index, version_number FROM document_versions WHERE document_id = ? ORDER BY version_index DESC LIMIT 1',
      [id]
    );

    let newIndex = 1.0;
    let newVersionNumber = 'V1.0';

    if (doc.is_locked === 1 || doc.status === 'FINAL_APPROVED') {
      // Re-upload on a Final Approved document -> Major Release Update (e.g. V1 FINAL -> V2.0 -> V2.1 -> V2.2...)
      let currentMajor = 1;
      if (latestVersions[0]) {
        const lastIdx = parseFloat(latestVersions[0].version_index);
        currentMajor = Math.floor(lastIdx);
      }
      const newMajor = currentMajor + 1;
      newIndex = parseFloat(`${newMajor}.0`);
      newVersionNumber = `V${newMajor}.0`;
    } else {
      // Minor revision re-upload before Final Approval (e.g. V1.0 -> V1.1 -> V1.2...)
      const lastIndex = latestVersions[0] ? parseFloat(latestVersions[0].version_index) : 1.0;
      newIndex = parseFloat((lastIndex + 0.1).toFixed(1));
      newVersionNumber = `V${newIndex}`;
    }

    // Hash calculation
    const filePath = req.file.path;
    const fileHash = await calculateFileHash(filePath);
    const versionStatus = WORKFLOW_REVIEW_ENABLED ? 'PENDING_REVIEW_1' : 'FINAL_APPROVED';

    // Insert new version (never overwrites previous version records!)
    const verRes = await db.query(
      `INSERT INTO document_versions (document_id, organization_id, version_number, version_index, original_filename, storage_key, file_size, mime_type, file_hash, uploaded_by, change_description, review_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, doc.organization_id, newVersionNumber, newIndex, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype, fileHash, req.user.id, change_description || 'Revision submitted', versionStatus]
    );

    const newVersionId = verRes.insertId;

    // Update main document status
    await db.query(
      `UPDATE documents 
       SET current_version_id = ?, current_version_number = ?, status = ?, is_locked = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newVersionId, newVersionNumber, versionStatus, id]
    );

    // Notify All Organization Stakeholders (Reviewers, Managers, Uploaders, Super Admin) of revision
    const targetUsers = await db.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.role_id, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE (u.organization_id = ? OR u.organization_id IS NULL OR r.name = 'SUPER_ADMIN')
         AND (r.name IS NULL OR r.name != 'MANAGER_OVERSIGHT')
         AND u.status = 'ACTIVE'`,
      [doc.organization_id]
    );

    const EXCLUDED_NOTIF_EMAILS = [
      'manish.p@rahee.com',
      'ayush.k@rahee.com',
      'manoj.g@rahee.com',
      'arunabha.p@rahee.com'
    ];

    for (const targetUser of targetUsers) {
      if (targetUser.email && EXCLUDED_NOTIF_EMAILS.includes(targetUser.email.toLowerCase())) {
        continue; // Skip Manish Kumar Patra, Ayush Khaitan, Manoj Ghosh, and Arunabha Pyne
      }

      const isUploader = targetUser.id === req.user.id;
      const notifTitle = isUploader 
        ? `🔄 Revision Submitted (${newVersionNumber})` 
        : `🔄 Document Revision Submitted: ${doc.title}`;
      
      const notifMessage = isUploader
        ? `Your revised version ${newVersionNumber} for document "${doc.title}" has been uploaded successfully.`
        : `Revised version ${newVersionNumber} of document "${doc.title}" was uploaded by ${req.user.name}.`;

      await sendNotification({
        recipientId: targetUser.id,
        senderId: req.user.id,
        documentId: id,
        organizationId: doc.organization_id,
        title: notifTitle,
        message: notifMessage,
        type: 'REVISION_SUBMITTED',
        emailDetails: {
          documentTitle: doc.title,
          documentVersion: newVersionNumber
        }
      });
    }

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'VERSION_CREATED',
      document_id: id,
      version: newVersionNumber,
      comment: `Uploaded revised version ${newVersionNumber} (${change_description || 'No comment'}).`,
      req
    });

    return res.status(201).json({
      success: true,
      message: `Revised version ${newVersionNumber} uploaded successfully and resubmitted for review.`,
      versionNumber: newVersionNumber,
      status: 'PENDING_REVIEW_1'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Download Document File
async function downloadDocument(req, res) {
  try {
    const { id } = req.params;
    const versionId = req.query.version_id;

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [id]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Strict Tenant Isolation Check
    const isExecAdmin = req.user.role_name === 'RAHEE_EXEC_ADMIN' || req.user.role_id === 3;
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin && !isExecAdmin && parseInt(doc.organization_id) !== parseInt(req.user.organization_id)) {
      await logAudit({
        organization_id: req.user.organization_id,
        action: 'UNAUTHORIZED_DOWNLOAD_ATTEMPT',
        comment: `User attempted to download document ID ${id} across tenant boundary.`,
        req
      });
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot download document belonging to another organization.' });
    }

    // Retrieve requested version or current version
    let versionSql = 'SELECT * FROM document_versions WHERE document_id = ?';
    let params = [id];
    if (versionId) {
      versionSql += ' AND id = ?';
      params.push(versionId);
    } else {
      versionSql += ' ORDER BY id DESC LIMIT 1';
    }

    const versions = await db.query(versionSql, params);
    const versionObj = versions[0];
    if (!versionObj) {
      return res.status(404).json({ success: false, message: 'Requested document version file not found.' });
    }

    const filePath = path.join(uploadDir, versionObj.storage_key);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Physical document storage file missing from server.' });
    }

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_DOWNLOADED',
      document_id: doc.id,
      version: versionObj.version_number,
      comment: `Downloaded file '${versionObj.original_filename}'.`,
      req
    });

    res.setHeader('Content-Type', versionObj.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${versionObj.original_filename}"`);
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Preview Document File / Content Stream
async function previewDocument(req, res) {
  try {
    const { id } = req.params;

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [id]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    const isExecAdmin = req.user.role_name === 'RAHEE_EXEC_ADMIN' || req.user.role_id === 3;
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin && !isExecAdmin && parseInt(doc.organization_id) !== parseInt(req.user.organization_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Cannot preview document belonging to another organization.' });
    }

    const versions = await db.query(
      'SELECT * FROM document_versions WHERE document_id = ? ORDER BY id DESC LIMIT 1',
      [id]
    );
    const versionObj = versions[0];
    if (!versionObj) {
      return res.status(404).json({ success: false, message: 'Document version file not found.' });
    }

    const filePath = path.join(uploadDir, versionObj.storage_key);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Physical document storage file missing.' });
    }

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_PREVIEWED',
      document_id: doc.id,
      version: versionObj.version_number,
      comment: `Previewed file '${versionObj.original_filename}'.`,
      req
    });

    const ext = path.extname(versionObj.original_filename).toLowerCase();

    // 1. Render Word (.docx, .doc) files directly into clean, responsive HTML
    if (['.docx', '.doc'].includes(ext) || doc.document_type === 'WORD') {
      try {
        const result = await mammoth.convertToHtml({ path: filePath });
        const htmlContent = result.value || '<p style="color:#64748b;">No text content found in Word document.</p>';
        const styledDoc = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${versionObj.original_filename} - In-Browser Preview</title>
            <style>
              body {
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.7;
                color: #1e293b;
                background-color: #f8fafc;
                margin: 0;
                padding: 30px 15px;
              }
              .doc-paper {
                max-width: 850px;
                margin: 0 auto;
                background: #ffffff;
                padding: 50px 60px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.06);
                border: 1px solid #e2e8f0;
              }
              h1, h2, h3, h4, h5, h6 {
                color: #0f172a;
                font-weight: 700;
                margin-top: 1.4em;
                margin-bottom: 0.5em;
              }
              p { margin-bottom: 1em; }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              th, td {
                border: 1px solid #cbd5e1;
                padding: 10px 14px;
                text-align: left;
              }
              th {
                background-color: #f1f5f9;
                font-weight: 600;
              }
              img {
                max-width: 100%;
                height: auto;
                border-radius: 6px;
              }
              blockquote {
                border-left: 4px solid #3b82f6;
                padding-left: 16px;
                color: #475569;
                margin: 16px 0;
                font-style: italic;
              }
            </style>
          </head>
          <body>
            <div class="doc-paper">
              ${htmlContent}
            </div>
          </body>
          </html>
        `;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(styledDoc);
      } catch (wordErr) {
        console.warn('Word HTML conversion failed, serving raw file:', wordErr.message);
      }
    }

    // 2. Render Excel (.xlsx, .xls) spreadsheets directly into HTML Data Tables
    if (['.xlsx', '.xls'].includes(ext) || doc.document_type === 'EXCEL') {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const htmlTable = XLSX.utils.sheet_to_html(worksheet);
        const styledSheet = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${versionObj.original_filename} - Spreadsheet Preview</title>
            <style>
              body {
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                background-color: #f8fafc;
                margin: 0;
                padding: 20px;
              }
              .sheet-container {
                background: #ffffff;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                border: 1px solid #e2e8f0;
                overflow-x: auto;
              }
              h3 {
                margin-top: 0;
                color: #0f172a;
                font-size: 14px;
                font-weight: 700;
                padding-bottom: 12px;
                border-b: 1px solid #f1f5f9;
              }
              table {
                border-collapse: collapse;
                width: 100%;
                font-size: 13px;
              }
              td, th {
                border: 1px solid #cbd5e1;
                padding: 8px 12px;
                white-space: nowrap;
              }
              tr:nth-child(even) { background-color: #f8fafc; }
              tr:hover { background-color: #f1f5f9; }
            </style>
          </head>
          <body>
            <div class="sheet-container">
              <h3>📊 Sheet View: ${sheetName}</h3>
              ${htmlTable}
            </div>
          </body>
          </html>
        `;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(styledSheet);
      } catch (excelErr) {
        console.warn('Excel HTML conversion failed, serving raw file:', excelErr.message);
      }
    }

    // 3. Render PowerPoint (.pptx, .ppt) slides directly into HTML Slide Deck Presentation
    if (['.pptx', '.ppt'].includes(ext) || doc.document_type === 'POWERPOINT') {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(fileBuffer);
        const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
        
        slideFiles.sort((a, b) => {
          const matchA = a.match(/\d+/);
          const matchB = b.match(/\d+/);
          const numA = matchA ? parseInt(matchA[0]) : 0;
          const numB = matchB ? parseInt(matchB[0]) : 0;
          return numA - numB;
        });

        const slideHtmlCards = [];
        for (let i = 0; i < slideFiles.length; i++) {
          const xml = await zip.files[slideFiles[i]].async('text');
          const textMatches = xml.match(/<a:t>(.*?)<\/a:t>/g) || [];
          const texts = textMatches.map(m => m.replace(/<\/?a:t>/g, '').trim()).filter(Boolean);
          
          const titleText = texts[0] || `Slide ${i + 1}`;
          const bodyTexts = texts.slice(1);
          
          slideHtmlCards.push(`
            <div class="slide-card">
              <div class="slide-header">
                <span class="slide-badge">SLIDE ${i + 1}</span>
                <h2 class="slide-title">${titleText}</h2>
              </div>
              <div class="slide-body">
                ${bodyTexts.length > 0 ? `<ul>${bodyTexts.map(t => `<li>${t}</li>`).join('')}</ul>` : '<p class="empty-slide">Graphic / Diagram Slide View</p>'}
              </div>
            </div>
          `);
        }

        const styledDeck = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${versionObj.original_filename} - PowerPoint Presentation</title>
            <style>
              body {
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                background-color: #0f172a;
                color: #f8fafc;
                margin: 0;
                padding: 30px 15px;
              }
              .deck-container {
                max-width: 900px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 24px;
              }
              .deck-title-bar {
                background: #1e293b;
                padding: 16px 24px;
                border-radius: 12px;
                border: 1px solid #334155;
                display: flex;
                align-items: center;
                justify-content: space-between;
              }
              .deck-title { margin: 0; font-size: 16px; font-weight: 700; color: #38bdf8; }
              .slide-card {
                background: #1e293b;
                border-radius: 16px;
                padding: 32px 40px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                border: 1px solid #334155;
                min-height: 180px;
              }
              .slide-header {
                display: flex;
                align-items: center;
                gap: 12px;
                border-bottom: 1px solid #334155;
                padding-bottom: 16px;
                margin-bottom: 20px;
              }
              .slide-badge {
                background: #0284c7;
                color: #ffffff;
                font-size: 10px;
                font-weight: 900;
                padding: 4px 10px;
                border-radius: 6px;
                letter-spacing: 1px;
              }
              .slide-title { margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; }
              .slide-body { font-size: 14px; color: #cbd5e1; line-height: 1.8; }
              .slide-body ul { margin: 0; padding-left: 20px; }
              .slide-body li { margin-bottom: 8px; }
              .empty-slide { font-style: italic; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="deck-container">
              <div class="deck-title-bar">
                <h1 class="deck-title">📊 PowerPoint Presentation Slide Deck (${slideFiles.length} Slides)</h1>
                <span style="font-size: 12px; color: #94a3b8;">${versionObj.original_filename}</span>
              </div>
              ${slideHtmlCards.length > 0 ? slideHtmlCards.join('') : '<div class="slide-card"><p class="empty-slide">Presentation file loaded.</p></div>'}
            </div>
          </body>
          </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(styledDeck);
      } catch (pptErr) {
        console.warn('PPTX slide conversion failed, serving raw file:', pptErr.message);
      }
    }

    // 4. Render CAD files (.dwg, .dxf, .stl, .obj, .step, .stp, .iges) into interactive HTML5 CAD Viewer
    if (['.dwg', '.dxf', '.stl', '.obj', '.step', '.stp', '.iges'].includes(ext) || doc.document_type === 'CAD') {
      try {
        let cadData = null;
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          if (!raw.includes('\0')) cadData = raw;
        } catch (e) {}

        const cadViewerHtml = generateCADViewerHtml(versionObj.original_filename, ext, filePath, cadData);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(cadViewerHtml);
      } catch (cadErr) {
        console.warn('CAD rendering failed, serving raw file:', cadErr.message);
      }
    }

    const mimeTypeMap = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };

    const targetMimeType = mimeTypeMap[ext] || versionObj.mime_type || 'application/octet-stream';

    res.setHeader('Content-Type', targetMimeType);
    res.setHeader('Content-Disposition', `inline; filename="${versionObj.original_filename}"`);
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// CAD Interactive Blueprint & 3D Model Viewer HTML Generator
function generateCADViewerHtml(filename, ext, filePath, textData) {
  const isDxf = ext.toLowerCase() === '.dxf';
  const isStl = ext.toLowerCase() === '.stl';
  const formatLabel = ext.toUpperCase().replace('.', '');

  let sanitizedText = '';
  if (isDxf && textData) {
    sanitizedText = JSON.stringify(textData.substring(0, 500000));
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${filename} - CAD Blueprint & 3D Model Viewer</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          background-color: #0b132b;
          color: #e0e1dd;
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .cad-header {
          background-color: #1c2541;
          padding: 10px 18px;
          border-bottom: 1px solid #3a506b;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }
        .cad-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          color: #6fffe9;
        }
        .badge-cad {
          background: #5bc0be;
          color: #0b132b;
          font-size: 10px;
          font-weight: 900;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .cad-toolbar {
          background: #1c2541;
          padding: 8px 18px;
          border-bottom: 1px solid #3a506b;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          flex-wrap: wrap;
        }
        .cad-btn {
          background: #3a506b;
          color: #ffffff;
          border: 1px solid #5bc0be;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .cad-btn:hover {
          background: #5bc0be;
          color: #0b132b;
        }
        .cad-canvas-container {
          flex: 1;
          position: relative;
          background: #0b132b;
          overflow: hidden;
          cursor: grab;
        }
        .cad-canvas-container:active {
          cursor: grabbing;
        }
        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        .cad-stats-overlay {
          position: absolute;
          bottom: 12px;
          left: 12px;
          background: rgba(28, 37, 65, 0.85);
          backdrop-filter: blur(4px);
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid #3a506b;
          font-size: 11px;
          font-family: monospace;
          color: #a5a5a5;
          pointer-events: none;
        }
        .cad-stats-overlay strong { color: #6fffe9; }
      </style>
    </head>
    <body>
      <div class="cad-header">
        <div class="cad-title">
          <span>📐 CAD Drawing & 3D Viewer</span>
          <span class="badge-cad">${formatLabel}</span>
          <span style="color: #a5a5a5; font-size: 12px; font-weight: normal;">${filename}</span>
        </div>
      </div>

      <div class="cad-toolbar">
        <button class="cad-btn" onclick="resetView()">🔄 Reset View</button>
        <button class="cad-btn" onclick="zoomIn()">➕ Zoom In</button>
        <button class="cad-btn" onclick="zoomOut()">➖ Zoom Out</button>
        <button class="cad-btn" onclick="toggleTheme()">🎨 Switch Theme (Blueprint/Dark)</button>
        <button class="cad-btn" onclick="toggleGrid()">🌐 Toggle Grid</button>
      </div>

      <div class="cad-canvas-container" id="container">
        <canvas id="cadCanvas"></canvas>
        <div class="cad-stats-overlay" id="stats">
          Format: <strong>${formatLabel}</strong> | Mode: <strong id="modeLabel">2D/3D Interactive Canvas</strong> | Zoom: <strong id="zoomLabel">100%</strong>
        </div>
      </div>

      <script>
        const canvas = document.getElementById('cadCanvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('container');

        let width = container.clientWidth;
        let height = container.clientHeight;
        canvas.width = width;
        canvas.height = height;

        window.addEventListener('resize', () => {
          width = container.clientWidth;
          height = container.clientHeight;
          canvas.width = width;
          canvas.height = height;
          draw();
        });

        let scale = 1.0;
        let panX = width / 2;
        let panY = height / 2;
        let isDragging = false;
        let startX = 0, startY = 0;

        let rotX = 0.4, rotY = 0.6;
        let theme = 'blueprint';
        let showGrid = true;

        const rawDxfText = ${sanitizedText || '""'};
        const isStl = ${isStl ? 'true' : 'false'};
        const isDxf = ${isDxf ? 'true' : 'false'};

        const dxfLines = [];
        const dxfCircles = [];

        function parseDxf() {
          if (!rawDxfText) return;
          const lines = rawDxfText.split(/\\r?\\n/);
          for (let i = 0; i < lines.length - 4; i++) {
            const code = lines[i].trim();
            const val = lines[i+1] ? lines[i+1].trim() : '';
            if (code === '0' && val === 'LINE') {
              let x1=0, y1=0, x2=0, y2=0;
              for (let j = i+2; j < i+20 && j < lines.length - 1; j+=2) {
                const c = lines[j].trim();
                const v = parseFloat(lines[j+1]);
                if (c === '10') x1 = v;
                if (c === '20') y1 = v;
                if (c === '11') x2 = v;
                if (c === '21') y2 = v;
                if (c === '0') break;
              }
              dxfLines.push({x1, y1, x2, y2});
            } else if (code === '0' && val === 'CIRCLE') {
              let cx=0, cy=0, r=10;
              for (let j = i+2; j < i+20 && j < lines.length - 1; j+=2) {
                const c = lines[j].trim();
                const v = parseFloat(lines[j+1]);
                if (c === '10') cx = v;
                if (c === '20') cy = v;
                if (c === '40') r = v;
                if (c === '0') break;
              }
              dxfCircles.push({cx, cy, r});
            }
          }
        }

        if (isDxf) parseDxf();

        function drawGrid() {
          if (!showGrid) return;
          ctx.strokeStyle = theme === 'blueprint' ? '#1d3557' : '#1f293d';
          ctx.lineWidth = 1;
          const gridSize = 40 * scale;
          const offsetX = panX % gridSize;
          const offsetY = panY % gridSize;

          for (let x = offsetX; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = offsetY; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
        }

        function draw() {
          ctx.fillStyle = theme === 'blueprint' ? '#0b132b' : '#000000';
          ctx.fillRect(0, 0, width, height);

          drawGrid();

          ctx.save();
          ctx.translate(panX, panY);
          ctx.scale(scale, -scale);

          if (isDxf && (dxfLines.length > 0 || dxfCircles.length > 0)) {
            ctx.strokeStyle = theme === 'blueprint' ? '#6fffe9' : '#00ffcc';
            ctx.lineWidth = 1.5 / scale;

            for (const l of dxfLines) {
              ctx.beginPath();
              ctx.moveTo(l.x1, l.y1);
              ctx.lineTo(l.x2, l.y2);
              ctx.stroke();
            }

            for (const c of dxfCircles) {
              ctx.beginPath();
              ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else {
            ctx.strokeStyle = theme === 'blueprint' ? '#6fffe9' : '#38bdf8';
            ctx.lineWidth = 1.5 / scale;

            ctx.strokeRect(-120, -80, 240, 160);

            ctx.beginPath();
            ctx.moveTo(-120, 0); ctx.lineTo(120, 0);
            ctx.moveTo(0, -80); ctx.lineTo(0, 80);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2);
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(-120, -80); ctx.lineTo(120, 80);
            ctx.moveTo(-120, 80); ctx.lineTo(120, -80);
            ctx.stroke();

            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

            const cubeNodes = [
              [-30, -30, -30], [30, -30, -30], [30, 30, -30], [-30, 30, -30],
              [-30, -30, 30],  [30, -30, 30],  [30, 30, 30],  [-30, 30, 30]
            ];

            const projected = cubeNodes.map(node => {
              let x = node[0], y = node[1], z = node[2];
              let y1 = y * cosX - z * sinX;
              let z1 = y * sinX + z * cosX;
              let x2 = x * cosY + z1 * sinY;
              return [x2, y1];
            });

            const edges = [
              [0,1],[1,2],[2,3],[3,0],
              [4,5],[5,6],[6,7],[7,4],
              [0,4],[1,5],[2,6],[3,7]
            ];

            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2 / scale;
            for (const edge of edges) {
              ctx.beginPath();
              ctx.moveTo(projected[edge[0]][0], projected[edge[0]][1]);
              ctx.lineTo(projected[edge[1]][0], projected[edge[1]][1]);
              ctx.stroke();
            }
          }

          ctx.restore();
          document.getElementById('zoomLabel').innerText = Math.round(scale * 100) + '%';
        }

        container.addEventListener('mousedown', (e) => {
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
        });

        container.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          startX = e.clientX;
          startY = e.clientY;

          if (e.shiftKey) {
            rotX += dy * 0.01;
            rotY += dx * 0.01;
          } else {
            panX += dx;
            panY += dy;
          }
          draw();
        });

        window.addEventListener('mouseup', () => { isDragging = false; });

        container.addEventListener('wheel', (e) => {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
          scale = Math.max(0.1, Math.min(50, scale * zoomFactor));
          draw();
        });

        function resetView() {
          scale = 1.0;
          panX = width / 2;
          panY = height / 2;
          rotX = 0.4;
          rotY = 0.6;
          draw();
        }

        function zoomIn() {
          scale = Math.min(50, scale * 1.25);
          draw();
        }

        function zoomOut() {
          scale = Math.max(0.1, scale * 0.8);
          draw();
        }

        function toggleTheme() {
          theme = theme === 'blueprint' ? 'dark' : 'blueprint';
          draw();
        }

        function toggleGrid() {
          showGrid = !showGrid;
          draw();
        }

        draw();
      </script>
    </body>
    </html>
  `;
}

// Trigger Archival Policy Check / Bulk Archive (Super Admin Trigger ONLY)
async function triggerArchivalPolicy(req, res) {
  try {
    if (!req.user.is_super_admin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Archival policy manual execution is strictly restricted to Super Admin ONLY.'
      });
    }

    const targetFolderId = req.body?.folder_id || req.query?.folder_id || null;
    const result = await runArchivalPolicy(true, targetFolderId);
    if (result.success) {
      return res.json({
        success: true,
        message: `Bikramshila Manual Archival Policy executed successfully. ${result.archivedCount} document(s) archived.`,
        archivedCount: result.archivedCount,
        archivedDocTitles: result.archivedDocTitles
      });
    } else {
      return res.status(500).json({ success: false, message: result.error });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Manual Archive Document (Super Admin Rajib Ghosh ONLY)
async function archiveDocument(req, res) {
  try {
    const { id } = req.params;

    const userEmail = req.user.email?.toLowerCase() || '';
    const userName = req.user.name?.toLowerCase() || '';
    const isRajibGhosh = userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || req.user.is_super_admin || req.user.role_id === 1 || req.user.id === 11;

    if (!isRajibGhosh) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Document archival is strictly restricted to Super Admin (Rajib Ghosh) only. Other users cannot archive documents.'
      });
    }

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [id]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    if (doc.status === 'ARCHIVED') {
      return res.status(400).json({ success: false, message: 'Document is already archived.' });
    }

    await db.query(
      "UPDATE documents SET status = 'ARCHIVED', is_locked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );

    const targetUsers = await db.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.role_id, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE (u.organization_id = ? OR u.organization_id IS NULL OR r.name = 'SUPER_ADMIN')
         AND u.status = 'ACTIVE'`,
      [doc.organization_id]
    );

    const EXCLUDED_NOTIF_EMAILS = [
      'manish.p@rahee.com',
      'ayush.k@rahee.com',
      'manoj.g@rahee.com',
      'arunabha.p@rahee.com'
    ];

    for (const targetUser of targetUsers) {
      if (targetUser.email && EXCLUDED_NOTIF_EMAILS.includes(targetUser.email.toLowerCase())) {
        continue;
      }
      await sendNotification({
        recipientId: targetUser.id,
        senderId: req.user.id,
        documentId: doc.id,
        organizationId: doc.organization_id,
        title: '📦 Document Archived',
        message: `Document "${doc.title}" was moved to Archive by ${req.user.name}.`,
        type: 'DOCUMENT_ARCHIVED',
        emailDetails: {
          documentTitle: doc.title,
          documentVersion: doc.current_version_number || 'General Version V1'
        }
      });
    }

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_ARCHIVED',
      document_id: doc.id,
      version: doc.current_version_number,
      comment: `Document '${doc.title}' (ID: ${doc.id}) manually moved to Archive by ${req.user.name}.`,
      req
    });

    return res.json({
      success: true,
      message: `Document '${doc.title}' has been archived successfully.`,
      status: 'ARCHIVED'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Restore / Unarchive an Archived Document (Super Admin Rajib Ghosh ONLY)
async function restoreDocument(req, res) {
  try {
    const { id } = req.params;

    const userEmail = req.user.email?.toLowerCase() || '';
    const userName = req.user.name?.toLowerCase() || '';
    const isRajibGhosh = userEmail === 'rajib.g@rahee.com' || userName.includes('rajib ghosh') || req.user.is_super_admin || req.user.role_id === 1 || req.user.id === 11;

    if (!isRajibGhosh) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Document restoration from archive is strictly restricted to Super Admin (Rajib Ghosh) only. Company Admins (Rahul Dey, Om Jha) cannot restore archived documents.'
      });
    }

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [id]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    if (doc.status !== 'ARCHIVED') {
      return res.status(400).json({ success: false, message: 'Document is not currently archived.' });
    }

    const restoredStatus = WORKFLOW_REVIEW_ENABLED ? 'PENDING_REVIEW_1' : 'FINAL_APPROVED';

    // Reset status back to active (FINAL_APPROVED or PENDING_REVIEW_1)
    await db.query(
      "UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [restoredStatus, id]
    );

    // Dispatch Live Notification to Stakeholders of the Document's Company & Super Admin
    const targetUsers = await db.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.role_id, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE (u.organization_id = ? OR u.organization_id IS NULL OR r.name = 'SUPER_ADMIN')
         AND u.status = 'ACTIVE'`,
      [doc.organization_id]
    );

    const EXCLUDED_NOTIF_EMAILS = [
      'manish.p@rahee.com',
      'ayush.k@rahee.com',
      'manoj.g@rahee.com',
      'arunabha.p@rahee.com'
    ];

    for (const targetUser of targetUsers) {
      if (targetUser.email && EXCLUDED_NOTIF_EMAILS.includes(targetUser.email.toLowerCase())) {
        continue;
      }
      await sendNotification({
        recipientId: targetUser.id,
        senderId: req.user.id,
        documentId: doc.id,
        organizationId: doc.organization_id,
        title: '♻️ Document Restored from Archive',
        message: `Document "${doc.title}" was restored from Archive by ${req.user.name} and is back active in BKS hierarchy.`,
        type: 'DOCUMENT_RESTORED',
        emailDetails: {
          documentTitle: doc.title,
          documentVersion: doc.current_version_number || 'General Version V1'
        }
      });
    }

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_RESTORED',
      document_id: doc.id,
      version: doc.current_version_number,
      comment: `Document '${doc.title}' (ID: ${doc.id}) restored from Archive by ${req.user.name} back into active BKS hierarchy.`,
      req
    });

    return res.json({
      success: true,
      message: `Document '${doc.title}' successfully restored from Archive back into active BKS folder hierarchy.`,
      status: restoredStatus
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// Delete Document (Restricted to Rahul Dey / Rahee Admin, Ircon Admin, and Super Admin)
async function deleteDocument(req, res) {
  try {
    const { id } = req.params;
    const userEmail = req.user.email?.toLowerCase() || '';
    const userName = req.user.name?.toLowerCase() || '';
    const userRole = req.user.role_name || '';
    const isSuperAdmin = req.user.is_super_admin || req.user.role_id === 1 || userRole === 'SUPER_ADMIN';

    // Rahul Dey specifically & Rahee Admin
    const isRahulDey = userEmail === 'rahul.d@rahee.com' || userName.includes('rahul dey') || req.user.id === 5;
    const isRaheeAdmin = isRahulDey || ((req.user.organization_id === 1 || req.user.organization_code === 'RAHEE' || userEmail.includes('@rahee.com')) && (
      [2, 3].includes(req.user.role_id) ||
      ['RAHEE_ADMIN', 'RAHEE_ADMIN_REVIEWER', 'RAHEE_EXEC_ADMIN'].includes(userRole) ||
      req.user.designation === 'Admin' ||
      userEmail.startsWith('rahul.d@') ||
      userEmail.startsWith('s.mondal@') ||
      req.user.permissions?.includes('delete') ||
      req.user.permissions?.includes('delete_document')
    ));

    // Ircon Admin: Om Jha, Role 8, IRCON_ADMIN, IRCON_ADMIN_REVIEWER, or Ircon user with Admin designation
    const isIrconAdmin = (req.user.organization_id === 2 || req.user.organization_code === 'IRCON' || userEmail.includes('@ircon.org')) && (
      [8].includes(req.user.role_id) ||
      ['IRCON_ADMIN', 'IRCON_ADMIN_REVIEWER'].includes(userRole) ||
      req.user.designation === 'Admin' ||
      userEmail.startsWith('om.jha@') ||
      req.user.permissions?.includes('delete') ||
      req.user.permissions?.includes('delete_document')
    );

    if (!isSuperAdmin && !isRahulDey && !isRaheeAdmin && !isIrconAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Document deletion is restricted to Rahul Dey (Rahee Admin), Ircon Admin, and Super Admin.'
      });
    }

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [id]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Tenant Isolation Check for Company Admins (cannot delete another company's document)
    if (!isSuperAdmin && !isRahulDey && doc.organization_id && req.user.organization_id && parseInt(doc.organization_id) !== parseInt(req.user.organization_id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot delete a document belonging to another organization.'
      });
    }

    // Soft delete document: move to Recycle Bin
    await db.query(
      `UPDATE documents 
       SET is_deleted = 1, 
           deleted_at = NOW(), 
           deleted_by = ?, 
           original_folder_id = COALESCE(folder_id, original_folder_id) 
       WHERE id = ?`,
      [req.user.id, id]
    );

    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: 'DOCUMENT_DELETED',
      comment: `Document '${doc.title}' (ID: ${id}) moved to Recycle Bin by ${req.user.name}.`,
      req
    });

    return res.json({ 
      success: true, 
      message: `Document '${doc.title}' moved to Recycle Bin. Super Admin (Rajib Ghosh) can restore it at any time.` 
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadDocument,
  getDocuments,
  getDocumentById,
  uploadNewVersion,
  downloadDocument,
  previewDocument,
  triggerArchivalPolicy,
  archiveDocument,
  restoreDocument,
  deleteDocument
};
