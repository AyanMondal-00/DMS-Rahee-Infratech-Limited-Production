const nodemailer = require('nodemailer');
const db = require('./db');

// Create Transporter (uses SMTP env if available, or fallback test account)
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_USER !== 'mock_user@enterprise-dms.com') {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      console.log('Nodemailer SMTP transporter initialized for:', process.env.SMTP_HOST);
    } else {
      // Fast non-blocking JSON transport for local/simulated Outbox mode
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      console.log('Nodemailer JSON transporter initialized (Simulated Outbox mode).');
    }
  } catch (err) {
    console.warn('Nodemailer setup warning:', err.message);
  }
  return transporter;
}

// Send Email Notification & Record to Outbox Log
async function sendWorkflowEmail({ toEmail, toName, subject, eventType, documentTitle, bodyHtml, socketIo }) {
  try {
    const fromAddress = process.env.EMAIL_FROM || '"Enterprise DMS System" <notifications@enterprise-dms.com>';

    // Try sending email via Nodemailer
    let sentStatus = 'SENT';
    try {
      const activeTransporter = await getTransporter();
      if (activeTransporter) {
        await activeTransporter.sendMail({
          from: fromAddress,
          to: `${toName ? `"${toName}" ` : ''}<${toEmail}>`,
          subject: subject,
          html: bodyHtml
        });
      }
    } catch (sendErr) {
      console.warn(`Email transport send issue (${sendErr.message}). Email recorded in System Outbox Log.`);
      sentStatus = 'QUEUED';
    }

    // Always log to email_logs table for audit & UI Outbox view
    const insertRes = await db.query(
      `INSERT INTO email_logs (recipient_email, recipient_name, subject, body_html, event_type, document_title, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [toEmail, toName || toEmail, subject, bodyHtml, eventType, documentTitle || 'N/A', sentStatus]
    );

    const logId = insertRes.insertId;

    // Emit live Socket.IO update for Email Activity Monitor in UI
    if (socketIo) {
      socketIo.emit('email_activity', {
        id: logId,
        recipient_email: toEmail,
        recipient_name: toName || toEmail,
        subject: subject,
        event_type: eventType,
        document_title: documentTitle || 'N/A',
        status: sentStatus,
        body_html: bodyHtml,
        is_deleted: 0,
        deleted_at: null,
        created_at: new Date().toISOString()
      });
    }

    console.log(`[EMAIL NOTIFICATION SENT] To: ${toEmail} | Event: ${eventType} | Subject: ${subject}`);
    return true;
  } catch (err) {
    console.error('Error logging email notification:', err.message);
    return false;
  }
}

// HTML Template Generators
function generateEmailTemplate({ recipientName, title, headline, message, documentTitle, documentVersion, actionUrl, badgeColor }) {
  const color = badgeColor || '#2563eb';
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px; background-color: #ffffff;">
      <div style="background-color: ${color}; color: #ffffff; padding: 15px 20px; border-radius: 6px 6px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">Enterprise DMS Notification</h2>
      </div>
      <div style="padding: 20px; color: #374151;">
        <p style="font-size: 16px;">Hello <strong>${recipientName || 'User'}</strong>,</p>
        <h3 style="color: #1f2937; margin-top: 10px;">${headline}</h3>
        <p style="font-size: 14px; line-height: 1.6;">${message}</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 120px;"><strong>Document:</strong></td>
              <td style="padding: 6px 0; color: #111827;"><strong>${documentTitle}</strong></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;"><strong>Version:</strong></td>
              <td style="padding: 6px 0; color: #111827;">${documentVersion || 'V1'}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #6b7280; margin-top: 25px;">
          This is an automated workflow notification from Enterprise Document Management System (DMS).
        </p>
      </div>
    </div>
  `;
}

module.exports = {
  sendWorkflowEmail,
  generateEmailTemplate
};
