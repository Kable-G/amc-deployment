// Load environment variables
require('dotenv').config();

const { sendInviteEmail } = require('./inviteMailer');

// Test the email functionality with a mock invite object
const testInvite = {
  email: 'test@example.com',
  token: 'test-token-123',
  firstName: 'John',
  companyName: 'Test Company',
  emailStatus: 'pending',
  emailAttempts: 0,
  save: async function() {
    console.log('Mock save called - invite status updated');
  }
};

console.log('🧪 Testing company invitation email functionality...');
console.log('📧 Environment variables check:');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***configured***' : 'not configured');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

sendInviteEmail(testInvite)
  .then(result => {
    console.log('✅ Email test result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Email test failed:', error);
    process.exit(1);
  });