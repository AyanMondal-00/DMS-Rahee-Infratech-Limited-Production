const https = require('https');
const querystring = require('querystring');
const db = require('./db');

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Retrieve OAuth2 Bearer token from Microsoft Entra ID (Azure AD)
 */
async function getMicrosoftGraphToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure Entra ID configuration missing (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET).');
  }

  const postData = querystring.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'login.microsoftonline.com',
      path: `/${tenantId}/oauth2/v2.0/token`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            cachedToken = parsed.access_token;
            tokenExpiresAt = Date.now() + ((parsed.expires_in || 3599) * 1000);
            resolve(cachedToken);
          } else {
            reject(new Error(parsed.error_description || parsed.error || 'Failed to acquire Azure AD token.'));
          }
        } catch (err) {
          reject(new Error(`Azure token response parse error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

/**
 * Send an email using Microsoft Graph API /v1.0/users/{sender}/sendMail
 */
async function sendEmailViaGraph({ toEmail, toName, subject, bodyHtml }) {
  const senderEmail = process.env.AZURE_SENDER_EMAIL || 'ayan@siliconsystems.in';
  const token = await getMicrosoftGraphToken();

  const emailPayload = JSON.stringify({
    message: {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: bodyHtml
      },
      toRecipients: [
        {
          emailAddress: {
            address: toEmail,
            name: toName || toEmail
          }
        }
      ]
    },
    saveToSentItems: true
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.microsoft.com',
      path: `/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailPayload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`Microsoft Graph API error [${res.statusCode}]: ${data || 'No response body'}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(emailPayload);
    req.end();
  });
}

// Send Email Notification & Record to Outbox Log (Preserves exact function signature & logging)
async function sendWorkflowEmail({ toEmail, toName, subject, eventType, documentTitle, bodyHtml, socketIo }) {
  try {
    let sentStatus = 'SENT';

    try {
      await sendEmailViaGraph({ toEmail, toName, subject, bodyHtml });
      console.log(`[MICROSOFT GRAPH EMAIL DELIVERED] To: ${toEmail} | Subject: ${subject}`);
    } catch (graphErr) {
      console.warn(`Microsoft Graph send issue (${graphErr.message}). Email recorded in System Outbox Log.`);
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
        <td style="padding: 8px 10px; color: #059669; font-size: 13px; font-weight: 500;">${d.version || 'V1'}</td>
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
              <th style="padding: 8px 10px; width: 110px;">Type</th>
              <th style="padding: 8px 10px; width: 90px;">Version</th>
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
          <tr>
            <td style="padding: 6px 0; color: #6b7280;"><strong>Version:</strong></td>
            <td style="padding: 6px 0; color: #111827;">${documentVersion || (documents && documents[0] ? documents[0].version : 'V1')}</td>
          </tr>
        </table>
      </div>
    `;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px; background-color: #ffffff;">
      <div style="background-color: ${color}; color: #ffffff; padding: 15px 20px; border-radius: 6px 6px 0 0;">
        <h2 style="margin: 0; font-size: 20px;">Enterprise DMS Notification</h2>
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
  getMicrosoftGraphToken,
  sendWorkflowEmail,
  generateEmailTemplate,
  generateRecipientUploadEmail
};
