require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./src/config/db');
const { getMicrosoftGraphToken, sendWorkflowEmail, generateRecipientUploadEmail } = require('./src/config/email');

async function testConnection() {
  await db.initDatabase();
  console.log('====================================================');
  console.log('   Microsoft Entra ID & Graph API Mailer Test');
  console.log('====================================================');
  console.log('AZURE_TENANT_ID:    ', process.env.AZURE_TENANT_ID ? `${process.env.AZURE_TENANT_ID.substring(0, 8)}...` : 'NOT SET');
  console.log('AZURE_CLIENT_ID:    ', process.env.AZURE_CLIENT_ID ? `${process.env.AZURE_CLIENT_ID.substring(0, 8)}...` : 'NOT SET');
  console.log('AZURE_CLIENT_SECRET:', process.env.AZURE_CLIENT_SECRET ? '****** (SET)' : 'NOT SET');
  console.log('AZURE_SENDER_EMAIL: ', process.env.AZURE_SENDER_EMAIL || 'NOT SET');
  console.log('----------------------------------------------------');

  if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    console.error('❌ Error: Azure Entra ID credentials are missing in .env file.');
    console.log('Please add AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_SENDER_EMAIL to your .env file.');
    process.exit(1);
  }

  try {
    console.log('🔄 1. Requesting OAuth2 token from Microsoft Entra ID...');
    const token = await getMicrosoftGraphToken();
    if (!token) {
      throw new Error('Could not obtain token.');
    }
    console.log('✅ 1. OAuth2 Token successfully acquired from Microsoft Entra ID!');

    const targetEmail = process.argv[2] || process.env.AZURE_SENDER_EMAIL;
    if (!targetEmail) {
      console.log('\n⚠️ No target email specified to send a test message. Token test was successful!');
      console.log('To send a test mail, run: node test_graph_mail.js recipient@rahee.com');
      process.exit(0);
    }

    console.log(`\n🔄 2. Attempting to send a test document upload email to: ${targetEmail}`);
    const sampleBody = generateRecipientUploadEmail({
      recipientName: 'Test Recipient',
      uploaderName: 'DMS Verification Admin',
      documentTitle: 'Test Engineering Specification Document',
      documentType: 'TECHNICAL SPECIFICATION (PDF)',
      documentVersion: 'V1.0',
      uploadedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    const success = await sendWorkflowEmail({
      toEmail: targetEmail,
      toName: 'Test Recipient',
      subject: '🔔 [TEST] New Document Uploaded: Test Engineering Specification',
      eventType: 'NEW_DOCUMENT_UPLOADED',
      documentTitle: 'Test Engineering Specification Document',
      bodyHtml: sampleBody
    });

    if (success) {
      console.log(`✅ 2. Test email successfully delivered via Microsoft Graph to ${targetEmail}!`);
      console.log('Check the recipient inbox and the sender "Sent Items" folder.');
    } else {
      console.log(`⚠️ Email logged to Outbox DB, but failed live delivery. Check error logs above.`);
    }

    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test Failed:', err.message);
    console.log('====================================================');
    process.exit(1);
  }
}

testConnection();
