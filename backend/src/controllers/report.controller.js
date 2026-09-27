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

    // 2. Pending Reviews
    const pendingRes = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status IN ('PENDING_REVIEW_1', 'PENDING_REVIEW_2', 'FINAL_APPROVAL_PENDING')`,
      params
    );
    const pendingReviews = pendingRes[0] ? (pendingRes[0].cnt || pendingRes[0]['COUNT(*)'] || 0) : 0;

    // 3. Rejected Documents
    const rejectedRes = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status = 'REJECTED'`,
      params
    );
    const rejectedDocuments = rejectedRes[0] ? (rejectedRes[0].cnt || rejectedRes[0]['COUNT(*)'] || 0) : 0;

    // 4. Final Approved Documents
    const finalApprovedRes = await db.query(
      `SELECT COUNT(*) as cnt FROM documents d ${tenantCondition} AND d.status = 'FINAL_APPROVED'`,
      params
    );
    const finalApproved = finalApprovedRes[0] ? (finalApprovedRes[0].cnt || finalApprovedRes[0]['COUNT(*)'] || 0) : 0;

    // 5. My Pending Actions Count
    let myPendingActions = 0;
    if (['RAHEE_ADMIN_REVIEWER', 'IRCON_ADMIN_REVIEWER', 'REVIEWER_1'].includes(req.user.role_name)) {
      const myPendingRes = await db.query(
        `SELECT COUNT(*) as cnt FROM documents WHERE (organization_id = ? OR organization_id IS NULL) AND (is_deleted = 0 OR is_deleted IS NULL) AND status = 'PENDING_REVIEW_1'`,
        [req.user.organization_id]
      );
      myPendingActions = myPendingRes[0] ? (myPendingRes[0].cnt || myPendingRes[0]['COUNT(*)'] || 0) : 0;
    } else if (['STEP2_REVIEWER', 'REVIEWER_2'].includes(req.user.role_name)) {
      const myPendingRes = await db.query(
        `SELECT COUNT(*) as cnt FROM documents WHERE (organization_id = ? OR organization_id IS NULL) AND (is_deleted = 0 OR is_deleted IS NULL) AND status = 'PENDING_REVIEW_2'`,
        [req.user.organization_id]
      );
      myPendingActions = myPendingRes[0] ? (myPendingRes[0].cnt || myPendingRes[0]['COUNT(*)'] || 0) : 0;
    } else if (req.user.role_name === 'FINAL_APPROVER') {
      const myPendingRes = await db.query(
        `SELECT COUNT(*) as cnt FROM documents WHERE (organization_id = ? OR organization_id IS NULL) AND (is_deleted = 0 OR is_deleted IS NULL) AND status = 'FINAL_APPROVAL_PENDING'`,
        [req.user.organization_id]
      );
      myPendingActions = myPendingRes[0] ? (myPendingRes[0].cnt || myPendingRes[0]['COUNT(*)'] || 0) : 0;
    } else if (req.user.role_name === 'DOCUMENT_UPLOADER' || req.user.role_name === 'UPLOAD_USER') {
      const myPendingRes = await db.query(
        `SELECT COUNT(*) as cnt FROM documents WHERE uploaded_by = ? AND (is_deleted = 0 OR is_deleted IS NULL) AND status = 'REJECTED'`,
        [req.user.id]
      );
      myPendingActions = myPendingRes[0] ? (myPendingRes[0].cnt || myPendingRes[0]['COUNT(*)'] || 0) : 0;
    }

    // 6. Documents Breakdown by Status
    const statusChartData = await db.query(
      `SELECT d.status, COUNT(*) as count FROM documents d ${tenantCondition} GROUP BY d.status`,
      params
    );

    // 7. Documents Breakdown by Document / File Type
    const categoryChartData = await db.query(
      `SELECT COALESCE(NULLIF(d.document_type, ''), 'OTHER') as category, COUNT(*) as count 
       FROM documents d ${tenantCondition} 
       GROUP BY COALESCE(NULLIF(d.document_type, ''), 'OTHER')`,
      params
    );

    // 8. Documents Breakdown by Company / Tenant
    let companyBreakdown = [];
    if (req.user.is_super_admin) {
      companyBreakdown = await db.query(
        `SELECT COALESCE(o.code, 'GLOBAL') as company, COALESCE(o.name, 'Global Repository') as company_name, COUNT(d.id) as count 
         FROM organizations o 
         LEFT JOIN documents d ON d.organization_id = o.id AND (d.is_deleted = 0 OR d.is_deleted IS NULL)
         GROUP BY o.id, o.code, o.name`
      );
    }

    // 9. Total Folders Count (Isolated by Tenant for Company Users, Combined for Super Admin)
    const allActiveFolders = await db.query(
      'SELECT id, name, organization_id, parent_id FROM folders WHERE (is_deleted = 0 OR is_deleted IS NULL)'
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

    // 10. Recent Audit Activity
    let recentAuditLogs = [];
    const hasAuditPerm = req.user.is_super_admin || (req.user.permissions && req.user.permissions.includes('view_audit_logs'));
    if (hasAuditPerm) {
      let auditSql = 'SELECT * FROM audit_logs';
      let auditParams = [];
      if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin) {
        auditSql += ' WHERE organization_id = ?';
        auditParams.push(req.user.organization_id);
      }
      auditSql += ' ORDER BY id DESC LIMIT 5';
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
        rejectedDocuments,
        finalApproved,
        myPendingActions
      },
      charts: {
        statusBreakdown: statusChartData,
        categoryBreakdown: categoryChartData,
        categoryChartData: categoryChartData, // alias
        companyBreakdown
      },
      recentAuditLogs
    });
  } catch (err) {
    console.error('getDashboardMetrics Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getDashboardMetrics };
