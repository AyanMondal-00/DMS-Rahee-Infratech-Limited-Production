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
    if (emailsToDispatch.length > 0) {
      setImmediate(async () => {
        for (const mail of emailsToDispatch) {
          try {
            const bodyHtml = generateEmailTemplate({
              recipientName: mail.recipientName,
              title: mail.title,
              headline: mail.title,
              message: mail.message,
              documentTitle: mail.emailDetails.documentTitle || 'Document',
              documentVersion: mail.emailDetails.documentVersion || 'V1',
              badgeColor: mail.type.includes('REJECT') ? '#ef4444' : (mail.type.includes('APPROVED') || mail.type.includes('FINAL') ? '#10b981' : '#3b82f6')
            });

            await sendWorkflowEmail({
              toEmail: mail.recipientEmail,
              toName: mail.recipientName,
              subject: `${mail.title} - ${mail.emailDetails.documentTitle || ''}`,
              eventType: mail.type,
              documentTitle: mail.emailDetails.documentTitle,
              bodyHtml,
              socketIo: io
            });
          } catch (e) {
            console.error('Batch email send error:', e.message);
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
