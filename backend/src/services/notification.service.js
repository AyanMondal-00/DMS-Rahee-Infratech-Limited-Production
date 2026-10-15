const db = require('../config/db');
const { sendWorkflowEmail, generateEmailTemplate } = require('../config/email');

let io = null;

function setSocketIO(socketServer) {
  io = socketServer;
}

const EXCLUDED_NOTIF_EMAILS = [
  'manish.p@rahee.com',
  'ayush.k@rahee.com',
  'manoj.g@rahee.com',
  'arunabha.p@rahee.com'
];

async function sendNotification({ recipientId, senderId, documentId, title, message, type, organizationId, emailDetails, recipientUser }) {
  try {
    let recipient = recipientUser;
    if (!recipient) {
      const recipientUsers = await db.query('SELECT id, name, email FROM users WHERE id = ?', [recipientId]);
      recipient = recipientUsers[0];
    }

    if (recipient && recipient.email && EXCLUDED_NOTIF_EMAILS.includes(recipient.email.toLowerCase())) {
      // Excluded view-only user: suppress all in-app & email notifications completely
      return null;
    }

    // 1. Save In-App Notification in DB
    const res = await db.query(
      `INSERT INTO notifications (organization_id, recipient_id, sender_id, document_id, title, message, type, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [organizationId || null, recipientId, senderId || null, documentId || null, title, message, type]
    );

    const notificationId = res.insertId;

    // 2. Real-Time Socket.IO Notification Delivery
    if (io) {
      io.to(`user_${recipientId}`).emit('new_notification', {
        id: notificationId,
        title,
        message,
        type,
        documentId,
        is_read: 0,
        created_at: new Date().toISOString()
      });
    }

    // 3. Send Email Notification to Recipient (Non-blocking background dispatch)
    if (emailDetails && recipient && recipient.email) {
      const bodyHtml = generateEmailTemplate({
        recipientName: recipient.name,
        title,
        headline: title,
        message: message,
        documentTitle: emailDetails.documentTitle || 'Document',
        documentVersion: emailDetails.documentVersion || 'V1',
        badgeColor: type.includes('REJECT') ? '#ef4444' : (type.includes('APPROVED') || type.includes('FINAL') ? '#10b981' : '#3b82f6')
      });

      // Execute email delivery asynchronously in background so HTTP response is never blocked
      setImmediate(async () => {
        try {
          await sendWorkflowEmail({
            toEmail: recipient.email,
            toName: recipient.name,
            subject: `${title} - ${emailDetails.documentTitle || ''}`,
            eventType: type,
            documentTitle: emailDetails.documentTitle,
            bodyHtml,
            socketIo: io
          });
        } catch (mailErr) {
          console.error('Background email delivery failed:', mailErr.message);
        }
      });
    }

    return notificationId;
  } catch (err) {
    console.error('Failed to dispatch notification:', err.message);
    return null;
  }
}

// Ultra-fast Bulk Notification Dispatcher for multi-document / multi-user scenarios
async function sendBatchNotifications(notificationsList) {
  if (!notificationsList || notificationsList.length === 0) return;

  try {
    const validItems = [];
    const emailsToDispatch = [];

    for (const item of notificationsList) {
      const email = item.recipientUser?.email || item.recipientEmail;
      if (email && EXCLUDED_NOTIF_EMAILS.includes(email.toLowerCase())) {
        continue; // Skip excluded user
      }
      validItems.push(item);

      if (item.emailDetails && email) {
        emailsToDispatch.push({
          recipientName: item.recipientUser?.name || item.recipientName || 'User',
          recipientEmail: email,
          title: item.title,
          message: item.message,
          type: item.type,
          emailDetails: item.emailDetails
        });
      }
    }

    if (validItems.length === 0) return;

    // 1. Bulk Insert into DB in a single SQL operation
    const placeholders = validItems.map(() => '(?, ?, ?, ?, ?, ?, ?, 0)').join(', ');
    const params = [];
    validItems.forEach(item => {
      params.push(
        item.organizationId || null,
        item.recipientId,
        item.senderId || null,
        item.documentId || null,
        item.title,
        item.message,
        item.type
      );
    });

    const sql = `INSERT INTO notifications (organization_id, recipient_id, sender_id, document_id, title, message, type, is_read) VALUES ${placeholders}`;
    const insertRes = await db.query(sql, params);
    const firstInsertId = insertRes.insertId || 0;

    // 2. Real-Time Socket.IO emission
    if (io) {
      validItems.forEach((item, index) => {
        io.to(`user_${item.recipientId}`).emit('new_notification', {
          id: firstInsertId ? firstInsertId + index : Date.now() + index,
          title: item.title,
          message: item.message,
          type: item.type,
          documentId: item.documentId,
          is_read: 0,
          created_at: new Date().toISOString()
        });
      });
    }

    // 3. Asynchronous non-blocking batch email processing
    // CONSOLIDATION RULE: If multiple documents are uploaded simultaneously, each recipient receives exactly 1 summary email listing all uploaded files
    if (emailsToDispatch.length > 0) {
      setImmediate(async () => {
        // Group items by recipient email to avoid sending N separate emails
        const groupedByRecipient = new Map();
        for (const mail of emailsToDispatch) {
          const key = mail.recipientEmail.toLowerCase();
          if (!groupedByRecipient.has(key)) {
            groupedByRecipient.set(key, {
              recipientEmail: mail.recipientEmail,
              recipientName: mail.recipientName,
              type: mail.type,
              uploaderName: mail.emailDetails.uploaderName || 'User',
              uploadedAt: mail.emailDetails.uploadedAt,
              isUploader: mail.emailDetails.isUploader,
              documents: []
            });
          }
          groupedByRecipient.get(key).documents.push({
            title: mail.emailDetails.documentTitle,
            document_type: mail.emailDetails.documentType,
            version: mail.emailDetails.documentVersion
          });
        }

        // Dispatch exactly 1 consolidated email per recipient
        for (const [, grp] of groupedByRecipient) {
          try {
            const docCount = grp.documents.length;
            const isSingle = docCount === 1;

            let subject = '';
            let headline = '';
            let message = '';
            let docTitleForLog = '';

            if (grp.isUploader) {
              subject = isSingle
                ? `📄 Document Uploaded Successfully - ${grp.documents[0].title}`
                : `📄 ${docCount} Documents Uploaded Successfully - Enterprise DMS`;
              headline = isSingle
                ? 'Your document has been uploaded successfully'
                : `Your ${docCount} documents have been uploaded successfully`;
              message = isSingle
                ? `Your document "${grp.documents[0].title}" (${grp.documents[0].version}) has been uploaded successfully and saved to the repository.`
                : `You have successfully uploaded ${docCount} documents into the Enterprise DMS repository.`;
              docTitleForLog = isSingle ? grp.documents[0].title : `${docCount} Documents (${grp.documents.map(d => d.title).slice(0, 3).join(', ')}${docCount > 3 ? '...' : ''})`;
            } else {
              subject = isSingle
                ? `🔔 New Document Uploaded: ${grp.documents[0].title}`
                : `🔔 ${docCount} New Documents Uploaded by ${grp.uploaderName}`;
              headline = isSingle
                ? `A new document was uploaded by ${grp.uploaderName}`
                : `${docCount} new documents were uploaded by ${grp.uploaderName}`;
              message = isSingle
                ? `A new document "${grp.documents[0].title}" (${grp.documents[0].version}) was uploaded by ${grp.uploaderName} and is available in the repository.`
                : `${grp.uploaderName} has uploaded ${docCount} new documents to the repository. Please review the summary below.`;
              docTitleForLog = isSingle ? grp.documents[0].title : `${docCount} Documents (${grp.documents.map(d => d.title).slice(0, 3).join(', ')}${docCount > 3 ? '...' : ''})`;
            }

            const bodyHtml = generateEmailTemplate({
              recipientName: grp.recipientName,
              title: subject,
              headline: headline,
              message: message,
              documentTitle: isSingle ? grp.documents[0].title : `${docCount} Documents`,
              documentVersion: isSingle ? grp.documents[0].version : 'V1',
              documents: grp.documents,
              badgeColor: grp.type.includes('REJECT') ? '#ef4444' : (grp.type.includes('APPROVED') || grp.type.includes('FINAL') ? '#10b981' : '#3b82f6')
            });

            await sendWorkflowEmail({
              toEmail: grp.recipientEmail,
              toName: grp.recipientName,
              subject: subject,
              eventType: grp.type,
              documentTitle: docTitleForLog,
              bodyHtml,
              socketIo: io
            });
          } catch (e) {
            console.error('Batch email send error for recipient:', e.message);
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to dispatch batch notifications:', err.message);
  }
}

module.exports = {
  setSocketIO,
  sendNotification,
  sendBatchNotifications,
  EXCLUDED_NOTIF_EMAILS
};
