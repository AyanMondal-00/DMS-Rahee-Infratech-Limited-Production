const db = require('../config/db');
const { sendNotification } = require('../services/notification.service');
const { logAudit } = require('../services/audit.service');
const { MULTI_TENANT_ISOLATION_ENABLED } = require('../config/workflow.config');

async function processReviewAction(req, res) {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be APPROVED or REJECTED.' });
    }

    if (action === 'REJECTED' && (!comments || comments.trim().length === 0)) {
      return res.status(400).json({ success: false, message: 'A rejection reason / required changes comment is mandatory when rejecting a document.' });
    }

    // Fetch document & current version details
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [id]);
    const doc = docs[0];
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Tenant Isolation Check
    const isExecAdmin = req.user.role_name === 'RAHEE_EXEC_ADMIN' || req.user.role_id === 3;
    if (MULTI_TENANT_ISOLATION_ENABLED && !req.user.is_super_admin && !isExecAdmin && parseInt(doc.organization_id) !== parseInt(req.user.organization_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access denied under strict tenant isolation. Cannot view or review documents belonging to another organization.' });
    }

    if (doc.is_locked === 1 || doc.status === 'FINAL_APPROVED') {
      if (action === 'REJECTED') {
        const reviewerRoleTag = req.user.role_name || 'REVIEWER';
        await db.query(
          `INSERT INTO document_reviews (document_id, document_version_id, organization_id, reviewer_id, reviewer_role, action, comments)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [doc.id, doc.current_version_id, doc.organization_id, req.user.id, reviewerRoleTag, action, comments ? comments.trim() : 'Revision requested on Final Approved document']
        );

        await db.query('UPDATE documents SET status = "REJECTED", is_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [doc.id]);

        // Send notification to Uploader & Super Admin
        const targetUsers = await db.query(
          `SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE (u.organization_id = ? OR r.name = 'SUPER_ADMIN') AND u.status = 'ACTIVE'`,
          [doc.organization_id]
        );

        for (const usr of targetUsers) {
          const isUploader = usr.id === doc.uploaded_by;
          await sendNotification({
            recipientId: usr.id,
            senderId: req.user.id,
            documentId: doc.id,
            organizationId: doc.organization_id,
            title: isUploader ? `⚠️ Revision Requested for Approved Document ${doc.title}` : `⚠️ Revision Requested: ${doc.title}`,
            message: `${req.user.name} requested changes on Final Approved document "${doc.title}". Required Updates: ${comments.trim()}`,
            type: 'DOCUMENT_REJECTED_STAGE_1',
            emailDetails: { documentTitle: doc.title, documentVersion: doc.current_version_number }
          });
        }

        await logAudit({
          organization_id: doc.organization_id,
          user_id: req.user.id,
          action: 'DOCUMENT_REJECTED',
          document_id: doc.id,
          version: doc.current_version_number,
          comment: `Revision requested on Final Approved document by ${req.user.name}. Comments: ${comments}`,
          req
        });

        return res.json({ success: true, message: `Revision requested on Final Approved document. Status set to REJECTED for major version update.`, status: 'REJECTED' });
      } else {
        return res.status(400).json({ success: false, message: 'This document is already final approved and locked. To request changes, select REJECT with required change notes.' });
      }
    }

    const versions = await db.query('SELECT * FROM document_versions WHERE id = ?', [doc.current_version_id]);
    const currentVersion = versions[0];
    if (!currentVersion) {
      return res.status(404).json({ success: false, message: 'Current document version record not found.' });
    }

    let nextStatus = doc.status;
    let reviewerRoleTag = 'REVIEWER_1';
    let auditActionTag = 'DOCUMENT_APPROVED';

    // Current Workflow Stage Evaluation
    if (doc.status === 'PENDING_REVIEW_1') {
      reviewerRoleTag = req.user.role_name === 'STEP2_REVIEWER' || req.user.role_name === 'REVIEWER_2' ? 'REVIEWER_2' : 'REVIEWER_1';

      if (doc.organization_id === 2) {
        // Company 2 (Ircon - org_id 2): single-stage reviewer Shardu
        if (action === 'REJECTED') {
          nextStatus = 'REJECTED';
          auditActionTag = 'DOCUMENT_REJECTED';

          // Record review action
          await db.query(
            `INSERT INTO document_reviews (document_id, document_version_id, organization_id, reviewer_id, reviewer_role, action, comments)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [doc.id, doc.current_version_id, doc.organization_id, req.user.id, reviewerRoleTag, action, comments ? comments.trim() : 'REJECTED']
          );

          await db.query('UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['REJECTED', doc.id]);

          // Notify Uploader & Super Admin
          const targetUsers = await db.query(
            `SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE (u.organization_id = 2 OR r.name = 'SUPER_ADMIN') AND u.status = 'ACTIVE'`,
            []
          );

          for (const usr of targetUsers) {
            const isUploader = usr.id === doc.uploaded_by;
            await sendNotification({
              recipientId: usr.id,
              senderId: req.user.id,
              documentId: doc.id,
              organizationId: doc.organization_id,
              title: isUploader ? `❌ Action Required: Rejection for ${doc.title}` : `❌ Rejection Alert: ${doc.title}`,
              message: `Shardu Kumar Rastogi requested changes for "${doc.title}". Required Updates: ${comments.trim()}`,
              type: 'DOCUMENT_REJECTED_STAGE_1',
              emailDetails: { documentTitle: doc.title, documentVersion: doc.current_version_number }
            });
          }

          await logAudit({
            organization_id: doc.organization_id,
            user_id: req.user.id,
            action: auditActionTag,
            document_id: doc.id,
            version: doc.current_version_number,
            comment: `Review action '${action}' recorded by ${req.user.name}. Comment: ${comments}`,
            req
          });

          return res.json({ success: true, message: `Document rejected by ${reviewerRoleTag}. Status: REJECTED.`, status: 'REJECTED' });
        } else {
          nextStatus = 'FINAL_APPROVED';
          auditActionTag = 'FINAL_APPROVED';
          const currentVerNum = doc.current_version_number || 'V1';
          const finalVerString = `${currentVerNum.replace('V', 'V')} FINAL`;

          await db.query(
            `UPDATE documents SET status = 'FINAL_APPROVED', current_version_number = ?, is_locked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [finalVerString, doc.id]
          );
          await db.query(
            'UPDATE document_versions SET version_number = ?, review_status = "FINAL_APPROVED" WHERE id = ?',
            [finalVerString, doc.current_version_id]
          );

          // Record review action
          await db.query(
            `INSERT INTO document_reviews (document_id, document_version_id, organization_id, reviewer_id, reviewer_role, action, comments)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [doc.id, doc.current_version_id, doc.organization_id, req.user.id, reviewerRoleTag, action, comments ? comments.trim() : 'APPROVED']
          );

          const targetUsers = await db.query(
            `SELECT u.id, u.name, u.email FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE (u.organization_id = 2 OR r.name = 'SUPER_ADMIN') AND u.status = 'ACTIVE'`,
            []
          );

          for (const usr of targetUsers) {
            const isUploader = usr.id === doc.uploaded_by;
            await sendNotification({
              recipientId: usr.id,
              senderId: req.user.id,
              documentId: doc.id,
              organizationId: doc.organization_id,
              title: isUploader ? '🎉 Your Document Has Been Approved!' : `🎉 Document Approved: ${doc.title}`,
              message: `Shardu Kumar Rastogi approved "${doc.title}" (${finalVerString}) with comment: "${comments.trim()}".`,
              type: 'FINAL_APPROVED_NOTIFICATION',
              emailDetails: { documentTitle: doc.title, documentVersion: finalVerString }
            });
          }

          await logAudit({
            organization_id: doc.organization_id,
            user_id: req.user.id,
            action: auditActionTag,
            document_id: doc.id,
            version: doc.current_version_number,
            comment: `Review action '${action}' recorded by ${req.user.name}. Comment: ${comments}`,
            req
          });

          return res.json({ success: true, message: `Document approved. Status: FINAL_APPROVED.`, status: 'FINAL_APPROVED' });
        }
      } else {
        // Company 1 (Rahee Infratech): Stage 1 review (by Reviewer 1 or 2) moves document to PENDING_REVIEW_2 so Reviewer 2 can also review
        nextStatus = 'PENDING_REVIEW_2';
        auditActionTag = action === 'REJECTED' ? 'DOCUMENT_REJECTED_STAGE_1' : 'DOCUMENT_APPROVED_STAGE_1';

        // Notify Reviewer 2, Uploader (Om Jha) & Super Admin
        const reviewer2AndUploader = await db.query(
          `SELECT DISTINCT u.id, u.name, u.email 
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           LEFT JOIN role_permissions rp ON r.id = rp.role_id
           LEFT JOIN permissions p ON rp.permission_id = p.id
           WHERE (u.organization_id = ? OR u.organization_id IS NULL) 
             AND (p.code IN ('approve_reject', 'DOCUMENT_REVIEW') OR r.name IN ('SUPER_ADMIN', 'RAHEE_EXEC_ADMIN', 'STEP2_REVIEWER') OR u.id = ?) 
             AND u.status = 'ACTIVE'`,
          [doc.organization_id, doc.uploaded_by]
        );

        const EXCLUDED_NOTIF_EMAILS = ['ayush.k@rahee.com', 'manoj.g@rahee.com', 'arunabha.p@rahee.com'];

        for (const targetUser of reviewer2AndUploader) {
          if (targetUser.email && EXCLUDED_NOTIF_EMAILS.includes(targetUser.email.toLowerCase())) {
            continue;
          }
          const isUploader = targetUser.id === doc.uploaded_by;
          const reviewerTitle = req.user.role_name === 'STEP2_REVIEWER' || req.user.role_name === 'REVIEWER_2' ? 'Reviewer 2' : 'Reviewer 1';
          
          let notifTitle = '';
          let notifMessage = '';

          if (action === 'REJECTED') {
            notifTitle = isUploader
              ? `⚠️ Stage 1 Requested Changes by ${reviewerTitle}`
              : `🔔 Stage 1 Review Completed (${reviewerTitle} Requested Changes): Ready for Stage 2 Review`;
            notifMessage = isUploader
              ? `${reviewerTitle} (${req.user.name}) reviewed your document "${doc.title}" (${doc.current_version_number}) and requested changes: "${comments.trim()}". Pending Stage 2 review.`
              : `${reviewerTitle} (${req.user.name}) reviewed "${doc.title}" (${doc.current_version_number}) and requested changes: "${comments.trim()}". Please conduct Stage 2 review.`;
          } else {
            notifTitle = isUploader
              ? `✅ Stage 1 Approved by ${reviewerTitle}`
              : `🔔 Stage 1 Approved: Ready for Stage 2 Review`;
            notifMessage = isUploader
              ? `${reviewerTitle} (${req.user.name}) approved your document "${doc.title}" (${doc.current_version_number}) with comment: "${comments.trim()}". Moved to Stage 2 Review.`
              : `${reviewerTitle} (${req.user.name}) approved "${doc.title}" (${doc.current_version_number}) with comment: "${comments.trim()}". Ready for Stage 2 Review.`;
          }

          await sendNotification({
            recipientId: targetUser.id,
            senderId: req.user.id,
            documentId: doc.id,
            organizationId: doc.organization_id,
            title: notifTitle,
            message: notifMessage,
            type: 'REVIEW_REQUIRED_STAGE_2',
            emailDetails: {
              documentTitle: doc.title,
              documentVersion: doc.current_version_number
            }
          });
        }
      }
    } else if (doc.status === 'PENDING_REVIEW_2' || doc.status === 'APPROVED_BY_REVIEWER_1') {
      reviewerRoleTag = 'REVIEWER_2';

      // Insert current Reviewer 2 review action into DB first so we can aggregate both reviewers' feedback
      await db.query(
        `INSERT INTO document_reviews (document_id, document_version_id, organization_id, reviewer_id, reviewer_role, action, comments)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.current_version_id, doc.organization_id, req.user.id, reviewerRoleTag, action, comments ? comments.trim() : 'OK']
      );

      // Aggregate all reviews for this version
      const versionReviews = await db.query(
        `SELECT dr.*, u.name as reviewer_name 
         FROM document_reviews dr
         LEFT JOIN users u ON dr.reviewer_id = u.id
         WHERE dr.document_version_id = ?`,
        [doc.current_version_id]
      );

      const hasRejection = versionReviews.some(r => r.action === 'REJECTED');

      if (hasRejection) {
        nextStatus = 'REJECTED';
        auditActionTag = 'DOCUMENT_REJECTED_STAGE_2';

        // Format combined review feedback from all reviewers for the uploader
        const reviewFeedbackList = versionReviews.map(r => `${r.reviewer_role === 'REVIEWER_2' ? 'Reviewer 2' : 'Reviewer 1'} (${r.reviewer_name || 'Reviewer'}): [${r.action}] ${r.comments}`).join(' | ');

        // Notify Reviewer 1, Uploader (Om Jha) & Super Admin
        const targetUsers = await db.query(
          `SELECT DISTINCT u.id, u.name, u.email, u.role_id, r.name as role_name
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE (u.organization_id = ? OR u.organization_id IS NULL OR r.name = 'SUPER_ADMIN')
             AND (r.name IS NULL OR (r.name != 'MANAGER_OVERSIGHT' AND r.name != 'DOCUMENT_VIEWER'))
             AND u.status = 'ACTIVE'`,
          [doc.organization_id]
        );

        const EXCLUDED_NOTIF_EMAILS = ['ayush.k@rahee.com', 'manoj.g@rahee.com', 'arunabha.p@rahee.com'];

        for (const targetUser of targetUsers) {
          if (targetUser.email && EXCLUDED_NOTIF_EMAILS.includes(targetUser.email.toLowerCase())) {
            continue;
          }

          const isUploader = targetUser.id === doc.uploaded_by;
          const notifTitle = isUploader
            ? `❌ Action Required: Document Rejection & Feedback for ${doc.title}`
            : `❌ Stage 2 Rejection Alert: ${doc.title}`;

          await sendNotification({
            recipientId: targetUser.id,
            senderId: req.user.id,
            documentId: doc.id,
            organizationId: doc.organization_id,
            title: notifTitle,
            message: isUploader
              ? `Reviewers requested changes for "${doc.title}". Combined Feedback: ${reviewFeedbackList}. Please edit and re-upload the document.`
              : `Stage 2 review completed with rejections for "${doc.title}". Feedback: ${reviewFeedbackList}`,
            type: 'DOCUMENT_REJECTED_STAGE_2',
            emailDetails: {
              documentTitle: doc.title,
              documentVersion: doc.current_version_number
            }
          });
        }
      } else {
        // Approved by Reviewer 2 -> Moves to FINAL_APPROVAL_PENDING
        nextStatus = 'FINAL_APPROVAL_PENDING';
        auditActionTag = 'DOCUMENT_APPROVED_STAGE_2';

        // Notify Final Approver, Uploader (Om Jha), Reviewer 1, and Super Admin
        const targetUsers = await db.query(
          `SELECT DISTINCT u.id, u.name, u.email, u.role_id, r.name as role_name
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE (u.organization_id = ? OR u.organization_id IS NULL OR r.name = 'SUPER_ADMIN')
             AND (r.name IS NULL OR (r.name != 'MANAGER_OVERSIGHT' AND r.name != 'DOCUMENT_VIEWER'))
             AND u.status = 'ACTIVE'`,
          [doc.organization_id]
        );

        const EXCLUDED_NOTIF_EMAILS = ['ayush.k@rahee.com', 'arunabha.p@rahee.com'];

        for (const targetUser of targetUsers) {
          if (targetUser.email && EXCLUDED_NOTIF_EMAILS.includes(targetUser.email.toLowerCase())) {
            continue;
          }

          const isFinalApprover = targetUser.email && targetUser.email.toLowerCase() === 'manoj.g@rahee.com';
          const isUploader = targetUser.id === doc.uploaded_by;

          const notifTitle = isFinalApprover
            ? `⭐ Final Document Approval Required`
            : isUploader
            ? `✅ Both Reviewers Approved: Ready for Final Approval`
            : `✅ Stage 2 Approved: ${doc.title}`;

          const notifMessage = isFinalApprover
            ? `Document "${doc.title}" (${doc.current_version_number}) passed Stage 1 & Stage 2 with comment: "${comments.trim()}". Please review, preview, download, and provide Final Approval.`
            : `Reviewer 1 & Reviewer 2 approved "${doc.title}" (${doc.current_version_number}) with comment: "${comments.trim()}". Moved to Final Approver.`;

          await sendNotification({
            recipientId: targetUser.id,
            senderId: req.user.id,
            documentId: doc.id,
            organizationId: doc.organization_id,
            title: notifTitle,
            message: notifMessage,
            type: 'FINAL_APPROVAL_PENDING_NOTIFICATION',
            emailDetails: {
              documentTitle: doc.title,
              documentVersion: doc.current_version_number
            }
          });
        }
      }
    } else if (doc.status === 'FINAL_APPROVAL_PENDING' || doc.status === 'APPROVED_BY_REVIEWER_2') {
      const isFinalUser = req.user.role_name === 'FINAL_APPROVER' || req.user.is_super_admin;
      if (!isFinalUser) {
        return res.status(403).json({ success: false, message: 'Forbidden: Only Final Approver can grant final approval.' });
      }
      reviewerRoleTag = 'FINAL_APPROVER';

      if (action === 'REJECTED') {
        nextStatus = 'REJECTED';
        auditActionTag = 'DOCUMENT_REJECTED';

        await sendNotification({
          recipientId: doc.uploaded_by,
          senderId: req.user.id,
          documentId: doc.id,
          organizationId: doc.organization_id,
          title: '❌ Final Approval Rejected',
          message: `Final Approver (${req.user.name}) rejected "${doc.title}". Reason: ${comments.trim()}`,
          type: 'DOCUMENT_REJECTED_FINAL',
          emailDetails: {
            documentTitle: doc.title,
            documentVersion: doc.current_version_number
          }
        });
      } else {
        // FINAL APPROVED!
        nextStatus = 'FINAL_APPROVED';
        auditActionTag = 'FINAL_APPROVED';

        // Compute final version string (e.g. V2 FINAL)
        const currentVerNum = doc.current_version_number || 'V1';
        const finalVerString = `${currentVerNum.replace('V', 'V')} FINAL`;

        // Update document to locked
        await db.query(
          `UPDATE documents 
           SET status = 'FINAL_APPROVED', current_version_number = ?, is_locked = 1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [finalVerString, doc.id]
        );

        await db.query(
          'UPDATE document_versions SET version_number = ?, review_status = "FINAL_APPROVED" WHERE id = ?',
          [finalVerString, doc.current_version_id]
        );

        // Notify Uploader & Super Admin on Final Approval (Managers receive ONLY initial document upload notification)
        const uploaderAndSuperAdmin = await db.query(
          `SELECT u.id, u.name, u.email 
           FROM users u
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE (u.organization_id = ? OR u.organization_id IS NULL OR u.id = ?) 
             AND (u.id = ? OR r.name = 'SUPER_ADMIN') 
             AND u.status = 'ACTIVE'`,
          [doc.organization_id, doc.uploaded_by, doc.uploaded_by]
        );

        const EXCLUDED_NOTIF_EMAILS = ['ayush.k@rahee.com', 'arunabha.p@rahee.com'];

        for (const usr of uploaderAndSuperAdmin) {
          if (usr.email && EXCLUDED_NOTIF_EMAILS.includes(usr.email.toLowerCase())) {
            continue;
          }

          await sendNotification({
            recipientId: usr.id,
            senderId: req.user.id,
            documentId: doc.id,
            organizationId: doc.organization_id,
            title: '🎉 Document Final Approved & Locked',
            message: `Document "${doc.title}" has received Final Approval by ${req.user.name} and is now locked as ${finalVerString}.`,
            type: 'FINAL_APPROVED_NOTIFICATION',
            emailDetails: {
              documentTitle: doc.title,
              documentVersion: finalVerString
            }
          });
        }
      }
    }

    // Record review entry in DB if not already inserted during Stage 2 aggregation
    if (doc.status !== 'PENDING_REVIEW_2' && doc.status !== 'APPROVED_BY_REVIEWER_1') {
      await db.query(
        `INSERT INTO document_reviews (document_id, document_version_id, organization_id, reviewer_id, reviewer_role, action, comments)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [doc.id, doc.current_version_id, doc.organization_id, req.user.id, reviewerRoleTag, action, comments ? comments.trim() : 'OK']
      );
    }

    // Update document status if not already updated in final approval block
    if (nextStatus !== 'FINAL_APPROVED') {
      await db.query('UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStatus, doc.id]);
    }

    // Log Audit
    await logAudit({
      organization_id: doc.organization_id,
      user_id: req.user.id,
      action: auditActionTag,
      document_id: doc.id,
      version: doc.current_version_number,
      comment: `Review action '${action}' recorded by ${req.user.name} (${reviewerRoleTag}). Comment: ${comments || 'OK'}`,
      req
    });

    return res.json({
      success: true,
      message: `Document successfully ${action.toLowerCase()} by ${reviewerRoleTag}. Status: ${nextStatus}.`,
      status: nextStatus
    });
  } catch (err) {
    console.error('Review Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { processReviewAction };
