require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./src/config/db');
const { sendWorkflowEmail, generateRecipientUploadEmail } = require('./src/config/email');

async function testGmailSmtp() {
  await db.initDatabase();
  console.log('====================================================');
  console.log('          Gmail SMTP Mailer Verification');
  console.log('====================================================');
  console.log('SMTP_HOST:     ', process.env.SMTP_HOST || 'smtp.gmail.com');
  console.log('SMTP_PORT:     ', process.env.SMTP_PORT || '587');
  console.log('SMTP_USER:     ', process.env.SMTP_USER || 'NOT SET');
  console.log('SMTP_PASS:     ', process.env.SMTP_PASS ? '****** (SET)' : 'NOT SET');
  console.log('----------------------------------------------------');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_USER === 'your_email@gmail.com') {
    console.error('❌ Error: Gmail credentials are not configured or still placeholders in .env file.');
    console.log('Please update SMTP_USER and SMTP_PASS in the root .env file.');
    process.exit(1);
  }

  const targetEmail = process.argv[2] || process.env.SMTP_USER;
  console.log(`\n🔄 Attempting to send a test email to: ${targetEmail}`);

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
    subject: '🔔 [TEST] Gmail SMTP Configuration Verified - Enterprise DMS',
    eventType: 'SMTP_TEST_VERIFICATION',
    documentTitle: 'Test Engineering Specification Document',
    bodyHtml: sampleBody
  });

  if (success) {
    console.log(`\n✅ Test email successfully delivered via Gmail SMTP to: ${targetEmail}!`);
    console.log('Please check your inbox (and spam/promotions folder just in case).');
  } else {
    console.log(`\n⚠️ Test email could not be delivered. Check the warning above and ensure App Password is valid.`);
  }

  process.exit(0);
}

testGmailSmtp().catch(err => {
  console.error('Fatal test error:', err.message);
  process.exit(1);
});
