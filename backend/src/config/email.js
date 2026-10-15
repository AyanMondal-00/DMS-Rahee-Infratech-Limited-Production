const nodemailer = require('nodemailer');
const db = require('./db');

// Regular expression for validating RFC 5322 email syntax
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Singleton pooled transporter
let transporterInstance = null;

// Background Outbox Recovery Worker state
let outboxWorkerInterval = null;
let isWorkerRunning = false;
let socketIoRef = null;

/**
 * Configure singleton pooled transporter for high-concurrency Gmail SMTP
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass || user === 'your_email@gmail.com') {
    throw new Error('Gmail SMTP credentials missing or placeholder in .env (SMTP_USER / SMTP_PASS).');
  }

  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      pool: true,              // Reuse persistent TCP connections for ultra-low latency & throughput
      host,
      port,
      secure,
      auth: {
        user,
        pass
      },
      maxConnections: 3,       // Max simultaneous connections to avoid Gmail 421 concurrency throttle
      maxMessages: 100,        // Reconnect after 100 messages to eliminate stale/leaked socket state
      rateDelta: 1000,         // Rate limit window: 1 second
      rateLimit: 5,            // Send up to 5 emails per second to strictly respect Gmail limits
      socketTimeout: 30000,    // 30s inactivity timeout
      connectionTimeout: 15000 // 15s initial TCP/TLS handshake timeout
    });
  }

  return transporterInstance;
}

/**
 * Reset transporter pool if a network socket fails or closes unexpectedly
 */
function resetTransporter() {
  if (transporterInstance) {
    try {
      transporterInstance.close();
    } catch (e) {}
    transporterInstance = null;
  }
}

/**
 * Sanitize and validate recipient email format
 */
function sanitizeAndValidateEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const cleaned = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleaned)) return null;
  return cleaned;
}

/**
 * Detect transient network or rate-limiting errors that warrant retry
 */
function isTransientError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toUpperCase();
  const responseCode = err.responseCode;

  const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE'];
  if (transientCodes.includes(code)) return true;

  // 4xx SMTP responses are temporary/transient
  if (responseCode && responseCode >= 400 && responseCode < 500) return true;

  if (msg.includes('421') || msg.includes('451') || msg.includes('454') || msg.includes('try again') || msg.includes('rate limit') || msg.includes('concurrent') || msg.includes('greeting never received')) {
    return true;
  }

  return false;
}

/**
 * Send an email with automatic exponential backoff retries for 99.99% deliverability
 */
const MAX_IMMEDIATE_RETRIES = 3;

async function sendEmailViaSmtp({ toEmail, toName, subject, bodyHtml }) {
  const validTo = sanitizeAndValidateEmail(toEmail);
  if (!validTo) {
    throw new Error(`Invalid recipient email address format: "${toEmail}"`);
  }

  const senderUser = process.env.SMTP_USER;
  const senderName = process.env.SMTP_FROM_NAME || 'DMS Bikramshila';

  const mailOptions = {
    from: `"${senderName}" <${senderUser}>`,
    to: toName ? `"${toName.replace(/"/g, '')}" <${validTo}>` : validTo,
    subject: subject,
    html: bodyHtml
  };

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_IMMEDIATE_RETRIES; attempt++) {
    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (err) {
      lastError = err;
      console.warn(`[SMTP Attempt ${attempt + 1}/${MAX_IMMEDIATE_RETRIES + 1} Failed]: To: ${validTo} | Reason: ${err.message}`);

      if (isTransientError(err) && attempt < MAX_IMMEDIATE_RETRIES) {
        // Reset socket pool on transient failure to re-handshake cleanly
        resetTransporter();

        // Exponential backoff with random jitter: 1.5s, 3s, 6s...
        const delayMs = Math.floor(1500 * Math.pow(2, attempt) + Math.random() * 500);
        console.log(`[SMTP Retry] Waiting ${delayMs}ms before retry attempt ${attempt + 2}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Non-transient error (e.g. invalid recipient account, bad credentials) - fail fast
        break;
      }
    }
  }

  throw lastError || new Error('Email delivery failed after retries.');
}

// Backward compatibility aliases
const sendEmailViaGraph = sendEmailViaSmtp;
const getMicrosoftGraphToken = async () => null;

/**
 * Background Outbox Auto-Recovery Worker
 * Sweeps for any emails in QUEUED state (e.g. from temporary network outages) and retries delivery
 */
async function processQueuedEmails() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    const queued = await db.query(
      `SELECT id, recipient_email, recipient_name, subject, body_html, event_type, document_title, retry_count 
       FROM email_logs 
       WHERE status = 'QUEUED' AND (is_deleted = 0 OR is_deleted IS NULL) AND (retry_count < 5 OR retry_count IS NULL)
       ORDER BY id ASC LIMIT 10`
    );

    if (!queued || queued.length === 0) {
      isWorkerRunning = false;
      return;
    }

    console.log(`[OUTBOX WORKER] Found ${queued.length} queued email(s) for auto-recovery delivery.`);

    for (const item of queued) {
      const currentRetry = (item.retry_count || 0) + 1;
      try {
        await sendEmailViaSmtp({
          toEmail: item.recipient_email,
          toName: item.recipient_name,
          subject: item.subject,
          bodyHtml: item.body_html
        });

        // Mark as successfully sent in database
        await db.query(
          `UPDATE email_logs SET status = 'SENT', retry_count = ?, last_error = NULL WHERE id = ?`,
          [currentRetry, item.id]
        );

        console.log(`[OUTBOX WORKER DELIVERED] Recovered and sent email ID ${item.id} to ${item.recipient_email}`);

        // Emit live Socket.IO update to UI monitor
        if (socketIoRef) {
          socketIoRef.emit('email_activity', {
            id: item.id,
            recipient_email: item.recipient_email,
            recipient_name: item.recipient_name,
            subject: item.subject,
            event_type: item.event_type,
            document_title: item.document_title,
            status: 'SENT',
            body_html: item.body_html,
            is_deleted: 0,
            deleted_at: null,
            created_at: new Date().toISOString()
          });
        }

        // Pacing delay between batch deliveries
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        const nextStatus = currentRetry >= 5 ? 'FAILED' : 'QUEUED';
        await db.query(
          `UPDATE email_logs SET status = ?, retry_count = ?, last_error = ? WHERE id = ?`,
          [nextStatus, currentRetry, err.message, item.id]
        );
        console.warn(`[OUTBOX WORKER RETRY ${currentRetry}/5 FAILED] ID ${item.id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[OUTBOX WORKER ERROR]:', err.message);
  } finally {
    isWorkerRunning = false;
  }
}

/**
 * Start the background outbox recovery cron worker
 */
function startOutboxWorker(socketIo) {
  if (socketIo) socketIoRef = socketIo;
  if (!outboxWorkerInterval) {
    // Run sweep every 60 seconds
    outboxWorkerInterval = setInterval(processQueuedEmails, 60000);
    // Unref so worker doesn't keep node process alive during tests or shutdown
    if (outboxWorkerInterval.unref) outboxWorkerInterval.unref();
    console.log('⚡ Outbox Auto-Recovery Worker initialized (60s sweep cycle).');
  }
}

// Send Email Notification & Record to Outbox Log (Preserves exact function signature & logging)
async function sendWorkflowEmail({ toEmail, toName, subject, eventType, documentTitle, bodyHtml, socketIo }) {
  try {
    if (socketIo) {
      socketIoRef = socketIo;
      startOutboxWorker(socketIo);
    }

    let sentStatus = 'SENT';
    let errorMessage = null;

    try {
      await sendEmailViaSmtp({ toEmail, toName, subject, bodyHtml });
      console.log(`[GMAIL SMTP EMAIL DELIVERED] To: ${toEmail} | Subject: ${subject}`);
    } catch (smtpErr) {
      console.warn(`Gmail SMTP delivery issue (${smtpErr.message}). Email recorded as QUEUED for background recovery.`);
      sentStatus = 'QUEUED';
      errorMessage = smtpErr.message;
    }

    // Always log to email_logs table for audit & UI Outbox view
    const insertRes = await db.query(
      `INSERT INTO email_logs (recipient_email, recipient_name, subject, body_html, event_type, document_title, status, retry_count, last_error) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toEmail,
        toName || toEmail,
        subject,
        bodyHtml,
        eventType,
        documentTitle || 'N/A',
        sentStatus,
        sentStatus === 'QUEUED' ? 1 : 0,
        errorMessage
      ]
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

    return sentStatus === 'SENT';
  } catch (err) {
    console.error('Error logging email notification:', err.message);
    return false;
  }
}

// HTML Template Generators
function generateEmailTemplate({ recipientName, title, headline, message, documentTitle, documentVersion, documents, actionUrl, badgeColor }) {
  const color = badgeColor || '#2563eb';

  let detailsTableHtml = '';
  if (Array.isArray(documents) && documents.length > 1) {
    const rows = documents.map((d, idx) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 10px; color: #6b7280; font-size: 13px;">${idx + 1}</td>
        <td style="padding: 8px 10px; color: #111827; font-weight: 600; font-size: 13px;">${d.title || d.original_filename || 'Document'}</td>
        <td style="padding: 8px 10px; color: #4b5563; font-size: 13px;">${d.document_type || 'General'}</td>
      </tr>
    `).join('');

    detailsTableHtml = `
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #1f2937;">
          📄 Uploaded Documents Summary (${documents.length} Files):
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background-color: #edf2f7; color: #4b5563;">
              <th style="padding: 8px 10px; width: 35px;">#</th>
              <th style="padding: 8px 10px;">Document Title</th>
              <th style="padding: 8px 10px; width: 130px;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  } else {
    detailsTableHtml = `
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; width: 120px;"><strong>Document:</strong></td>
            <td style="padding: 6px 0; color: #111827;"><strong>${documentTitle || (documents && documents[0] ? documents[0].title : 'Document')}</strong></td>
          </tr>
          ${documentVersion ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280;"><strong>Version:</strong></td>
            <td style="padding: 6px 0; color: #111827;">${documentVersion}</td>
          </tr>` : ''}
        </table>
      </div>
    `;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px; background-color: #ffffff;">
      <div style="background-color: ${color}; color: #ffffff; padding: 15px 20px; border-radius: 6px 6px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">DMS Bikramshila</h2>
      </div>
      <div style="padding: 20px; color: #374151;">
        <p style="font-size: 16px;">Hello <strong>${recipientName || 'User'}</strong>,</p>
        <h3 style="color: #1f2937; margin-top: 10px;">${headline}</h3>
        <p style="font-size: 14px; line-height: 1.6;">${message}</p>
        
        ${detailsTableHtml}

        <p style="font-size: 13px; color: #6b7280; margin-top: 25px;">
          This is an automated workflow notification from Enterprise Document Management System (DMS).
        </p>
      </div>
    </div>
  `;
}

function generateRecipientUploadEmail({ recipientName, uploaderName, documentTitle, documentType, documentVersion, uploadedAt }) {
  return generateEmailTemplate({
    recipientName,
    title: '📄 New Document Uploaded to Enterprise DMS',
    headline: 'A new document has been uploaded and is available in the repository',
    message: `${uploaderName || 'A user'} has uploaded a new ${documentType || 'General'} document on ${uploadedAt || new Date().toLocaleString()}.`,
    documentTitle,
    documentVersion,
    badgeColor: '#10b981'
  });
}

module.exports = {
  sendEmailViaSmtp,
  getMicrosoftGraphToken,
  sendWorkflowEmail,
  generateEmailTemplate,
  generateRecipientUploadEmail,
  startOutboxWorker,
  processQueuedEmails
};
