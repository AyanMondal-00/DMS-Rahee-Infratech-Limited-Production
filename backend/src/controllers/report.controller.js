const db = require('../config/db');
const { MULTI_TENANT_ISOLATION_ENABLED } = require('../config/workflow.config');

async function getDashboardMetrics(req, res) {
  try {
    let tenantCondition = ' WHERE (d.is_deleted = 0 OR d.is_deleted IS NULL)';
    let params = [];

    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin) {
      tenantCondition += ' AND d.organization_id = ?';
      params.push(req.user.organization_id);
    } else if (req.query.organization_id) {
      tenantCondition += ' AND d.organization_id = ?';
      params.push(req.query.organization_id);
    }

    // 1. Total Documents
    const totalDocsRes = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition}`,
      params
    );
    const totalDocuments = totalDocsRes[0] ? (totalDocsRes[0].cnt || totalDocsRes[0]['COUNT(*)'] || 0) : 0;

    // 2. Pending Reviews breakdown
    const pendingReview1Res = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status = 'PENDING_REVIEW_1'`,
      params
    );
    const pendingReview1 = pendingReview1Res[0] ? Number(pendingReview1Res[0].cnt || 0) : 0;

    const pendingReview2Res = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status = 'PENDING_REVIEW_2'`,
      params
    );
    const pendingReview2 = pendingReview2Res[0] ? Number(pendingReview2Res[0].cnt || 0) : 0;

    const finalApprovalPendingRes = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status = 'FINAL_APPROVAL_PENDING'`,
      params
    );
    const finalApprovalPending = finalApprovalPendingRes[0] ? Number(finalApprovalPendingRes[0].cnt || 0) : 0;

    const pendingReviews = pendingReview1 + pendingReview2 + finalApprovalPending;

    // 3. Rejected Documents
    const rejectedRes = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status = 'REJECTED'`,
      params
    );
    const rejectedDocuments = rejectedRes[0] ? Number(rejectedRes[0].cnt || 0) : 0;

    // 4. Final Approved Documents
    const finalApprovedRes = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status IN ('FINAL_APPROVED', 'APPROVED')`,
      params
    );
    const finalApproved = finalApprovedRes[0] ? Number(finalApprovedRes[0].cnt || 0) : 0;

    // 5. Velocity & Storage Metrics
    const storageRes = await db.query(
      `SELECT COALESCE(SUM(dv.file_size), 0) as total_size, COALESCE(AVG(dv.file_size), 0) as avg_size 
       FROM documents d 
       LEFT JOIN document_versions dv ON (d.current_version_id = dv.id OR (d.current_version_id IS NULL AND dv.document_id = d.id)) 
       ${tenantCondition}`,
      params
    );
    const totalStorageBytes = storageRes[0] ? Number(storageRes[0].total_size || 0) : 0;
    const avgSizeBytes = storageRes[0] ? Math.round(Number(storageRes[0].avg_size || 0)) : 0;

    // Upload velocity (today, this week, this month)
    const velocityRes = await db.query(
      `SELECT 
         COUNT(CASE WHEN d.created_at >= CURDATE() THEN 1 END) as uploads_today,
         COUNT(CASE WHEN d.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as uploads_week,
         COUNT(CASE WHEN d.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as uploads_month
       FROM documents d 
       ${tenantCondition}`,
      params
    );
    const uploadsToday = velocityRes[0] ? Number(velocityRes[0].uploads_today || 0) : 0;
    const uploadsThisWeek = velocityRes[0] ? Number(velocityRes[0].uploads_week || 0) : 0;
    const uploadsThisMonth = velocityRes[0] ? Number(velocityRes[0].uploads_month || 0) : 0;

    // Approval rate %
    const totalCompleted = finalApproved + rejectedDocuments;
    const approvalRate = totalCompleted > 0 ? Math.round((finalApproved / totalCompleted) * 100) : 100;

    // 6. Ingestion Timeline (Last 14 Days)
    const timelineRes = await db.query(
      `SELECT DATE_FORMAT(d.created_at, '%Y-%m-%d') as upload_date, COUNT(*) as count 
       FROM documents d 
       ${tenantCondition} AND d.created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY DATE_FORMAT(d.created_at, '%Y-%m-%d')
       ORDER BY upload_date ASC`,
      params
    );

    const timelineMap = {};
    (timelineRes || []).forEach(row => {
      timelineMap[row.upload_date] = Number(row.count || 0);
    });

    const ingestionTrend = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      ingestionTrend.push({
        date: dateKey,
        label: displayDate,
        uploads: timelineMap[dateKey] || 0
      });
    }

    // 7. My Pending Actions Count & Items List
    let myPendingActions = 0;
    let myPendingItems = [];
    let pendingCondition = null;
    let pendingParams = [];

    if (['RAHEE_ADMIN_REVIEWER', 'IRCON_ADMIN_REVIEWER', 'REVIEWER_1'].includes(req.user.role_name)) {
      pendingCondition = `WHERE (d.organization_id = ? OR d.organization_id IS NULL) AND (d.is_deleted = 0 OR d.is_deleted IS NULL) AND d.status = 'PENDING_REVIEW_1'`;
      pendingParams = [req.user.organization_id];
    } else if (['STEP2_REVIEWER', 'REVIEWER_2'].includes(req.user.role_name)) {
      pendingCondition = `WHERE (d.organization_id = ? OR d.organization_id IS NULL) AND (d.is_deleted = 0 OR d.is_deleted IS NULL) AND d.status = 'PENDING_REVIEW_2'`;
      pendingParams = [req.user.organization_id];
    } else if (req.user.role_name === 'FINAL_APPROVER') {
      pendingCondition = `WHERE (d.organization_id = ? OR d.organization_id IS NULL) AND (d.is_deleted = 0 OR d.is_deleted IS NULL) AND d.status = 'FINAL_APPROVAL_PENDING'`;
      pendingParams = [req.user.organization_id];
    } else if (req.user.role_name === 'DOCUMENT_UPLOADER' || req.user.role_name === 'UPLOAD_USER') {
      pendingCondition = `WHERE d.uploaded_by = ? AND (d.is_deleted = 0 OR d.is_deleted IS NULL) AND d.status = 'REJECTED'`;
      pendingParams = [req.user.id];
    }

    if (pendingCondition) {
      const myPendingRes = await db.query(
        `SELECT COUNT(*) as cnt FROM documents d ${pendingCondition}`,
        pendingParams
      );
      myPendingActions = myPendingRes[0] ? Number(myPendingRes[0].cnt || 0) : 0;

      myPendingItems = await db.query(
        `SELECT d.id, d.title, d.status, d.document_type, d.category, d.current_version_number, d.created_at,
                u.name as uploader_name, u.email as uploader_email,
                o.name as organization_name, o.code as organization_code
         FROM documents d 
         LEFT JOIN users u ON d.uploaded_by = u.id 
         LEFT JOIN organizations o ON d.organization_id = o.id
         ${pendingCondition}
         ORDER BY d.updated_at DESC
         LIMIT 6`,
        pendingParams
      );
    }

    // 8. Documents Breakdown by Status
    const statusChartData = await db.query(
      `SELECT d.status, COUNT(*) as count FROM documents d ${tenantCondition} GROUP BY d.status`,
      params
    );

    // 9. Documents Breakdown by Document / File Type & Storage Size
    const categoryChartData = await db.query(
      `SELECT 
         COALESCE(NULLIF(d.document_type, ''), 'OTHER') as category, 
         COUNT(d.id) as count,
         COALESCE(SUM(dv.file_size), 0) as total_size,
         COALESCE(AVG(dv.file_size), 0) as avg_size
       FROM documents d 
       LEFT JOIN document_versions dv ON (d.current_version_id = dv.id OR (d.current_version_id IS NULL AND dv.document_id = d.id))
       ${tenantCondition} 
       GROUP BY COALESCE(NULLIF(d.document_type, ''), 'OTHER')
       ORDER BY total_size DESC, count DESC`,
      params
    );

    // Format storage breakdown list with percentages
    const storageBreakdown = (categoryChartData || []).map(cat => {
      const sizeNum = Number(cat.total_size || 0);
      const countNum = Number(cat.count || 0);
      const percentage = totalStorageBytes > 0 
        ? Math.round((sizeNum / totalStorageBytes) * 100) 
        : 0;
      return {
        category: cat.category,
        count: countNum,
        totalBytes: sizeNum,
        percentage
      };
    });

    // 10. Documents Breakdown by Company / Tenant
    let companyBreakdown = [];
    if (req.user.is_super_admin) {
      companyBreakdown = await db.query(
        `SELECT COALESCE(o.code, 'GLOBAL') as company, 
                COALESCE(o.name, 'Global Repository') as company_name, 
                COUNT(d.id) as count,
                COALESCE(SUM(dv.file_size), 0) as total_size
         FROM organizations o 
         LEFT JOIN documents d ON d.organization_id = o.id AND (d.is_deleted = 0 OR d.is_deleted IS NULL)
         LEFT JOIN document_versions dv ON d.current_version_id = dv.id
         GROUP BY o.id, o.code, o.name`
      );
    }

    // 11. Total Folders Count
    const allActiveFolders = await db.query(
      `SELECT f.id, f.name, f.organization_id, f.parent_id, o.code as organization_code 
       FROM folders f 
       LEFT JOIN organizations o ON f.organization_id = o.id 
       WHERE (f.is_deleted = 0 OR f.is_deleted IS NULL)`
    );

    // Filter out root Bikramshila drive node
    const nonRootFolders = allActiveFolders.filter(
      f => !(f.parent_id === null && ['BIKRAMSHILA', 'BKS'].includes((f.name || '').trim().toUpperCase()))
    );

    const raheeFoldersCount = nonRootFolders.filter(f => f.organization_id === 1 || f.organization_code === 'RAHEE').length;
    const irconFoldersCount = nonRootFolders.filter(f => f.organization_id === 2 || f.organization_code === 'IRCON').length;

    let totalFolders = 0;
    if (req.user.is_super_admin || req.user.role_id === 1 || req.user.email === 'rajib.g@rahee.com') {
      totalFolders = nonRootFolders.length;
    } else if (req.user.organization_id === 2 || req.user.organization_code === 'IRCON') {
      totalFolders = irconFoldersCount;
    } else {
      totalFolders = raheeFoldersCount;
    }

    // 12. Recent Ingested Documents (Latest 8)
    const recentDocuments = await db.query(
      `SELECT d.id, d.title, d.description, d.category, d.document_type, d.status,
              d.current_version_number, d.created_at, d.updated_at,
              u.name as uploader_name, u.email as uploader_email,
              o.name as organization_name, o.code as organization_code,
              dv.file_size, dv.original_filename, dv.mime_type
       FROM documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       LEFT JOIN organizations o ON d.organization_id = o.id
       LEFT JOIN document_versions dv ON d.current_version_id = dv.id
       ${tenantCondition}
       ORDER BY d.id DESC
       LIMIT 8`,
      params
    );

    // 13. Recent Audit Activity
    let recentAuditLogs = [];
    const hasAuditPerm = req.user.is_super_admin || (req.user.permissions && req.user.permissions.includes('view_audit_logs'));
    if (hasAuditPerm) {
      let auditSql = 'SELECT * FROM audit_logs';
      let auditParams = [];
      if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin) {
        auditSql += ' WHERE organization_id = ?';
        auditParams.push(req.user.organization_id);
      }
      auditSql += ' ORDER BY id DESC LIMIT 6';
      recentAuditLogs = await db.query(auditSql, auditParams);
    }

    return res.json({
      success: true,
      metrics: {
        totalDocuments,
        totalFolders,
        raheeFoldersCount,
        irconFoldersCount,
        pendingReviews,
        pendingReview1,
        pendingReview2,
        finalApprovalPending,
        rejectedDocuments,
        finalApproved,
        myPendingActions,
        totalStorageBytes,
        avgSizeBytes,
        uploadsToday,
        uploadsThisWeek,
        uploadsThisMonth,
        approvalRate
      },
      charts: {
        statusBreakdown: statusChartData,
        categoryBreakdown: categoryChartData,
        categoryChartData: categoryChartData, // alias
        companyBreakdown,
        ingestionTrend,
        storageBreakdown
      },
      storageBreakdown,
      recentDocuments,
      myPendingItems,
      recentAuditLogs
    });
  } catch (err) {
    console.error('getDashboardMetrics Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getDashboardMetrics };
