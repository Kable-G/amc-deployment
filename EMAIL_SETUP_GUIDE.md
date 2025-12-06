# 📧 AutoMediaCenter Email Setup Guide

## 🚀 Quick Start - Ready to Send Emails!

The email system is **fully implemented** and ready to use. You just need to configure your SMTP settings.

## 📋 Step 1: Choose Your Email Provider

### Option A: Gmail (Recommended for Testing)
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account Settings → Security
   - Under "2-Step Verification" → App passwords
   - Generate password for "Mail"
3. **Update `.env` file**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=your-16-character-app-password
   BASE_URL=http://localhost:3000
   ```

### Option B: Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
BASE_URL=http://localhost:3000
```

### Option C: Professional Email (Your Domain)
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_USER=noreply@automediacenter.com
SMTP_PASS=your-email-password
BASE_URL=https://automediacenter.com
```

## 📋 Step 2: Update Your .env File

Edit `Backend/.env` and replace these lines:
```env
SMTP_HOST=your-smtp-server
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password-or-app-password
BASE_URL=http://localhost:3000
```

## 📋 Step 3: Test Email Sending

1. **Restart your server** (to load new environment variables):
   ```bash
   cd Backend
   npm start
   ```

2. **Test via Admin Dashboard**:
   - Go to `http://localhost:3000/platform-admin-dashboard.html`
   - Login as platform admin
   - Click "Create Company"
   - Fill in company details with a **real email address**
   - Click "Create & Send Invitation"
   - Check the "Pending Invitations" section for email status

## 🔧 Step 4: Monitor Email Status

The system provides real-time email status tracking:

- **🟢 SENT** - Email delivered successfully
- **🟡 PENDING** - Email queued for sending
- **🔴 FAILED** - Email delivery failed (with error details)

## 🛠️ Troubleshooting

### Common Issues:

1. **"Authentication failed"**
   - Gmail: Use App Password, not regular password
   - Enable 2FA first, then generate App Password

2. **"Connection timeout"**
   - Check SMTP_HOST and SMTP_PORT
   - Try port 465 with secure: true for SSL

3. **"Invalid login"**
   - Verify SMTP_USER and SMTP_PASS
   - Some providers require "Allow less secure apps"

### Test SMTP Settings:
```javascript
// Quick test in Node.js console
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log('SMTP Error:', error);
  } else {
    console.log('✅ SMTP Ready to send emails!');
  }
});
```

## 📧 Email Features Available:

✅ **Professional Email Templates** - Branded AutoMediaCenter design
✅ **Automatic Retry Logic** - 3 attempts with delays
✅ **Daily Recovery Cron** - Retries failed emails at 3 AM
✅ **Real-time Status Tracking** - See email status in admin dashboard
✅ **Comprehensive Logging** - All attempts logged to database
✅ **Resend Functionality** - Manual resend from admin interface
✅ **Error Handling** - Graceful failure with user feedback

## 🎯 Ready to Go!

Once you update the `.env` file with your SMTP settings:

1. **Restart the server**
2. **Create a company** via admin dashboard
3. **Watch the email status** in pending invitations
4. **Check your email** for the professional invitation

The system is production-ready with full error handling and retry mechanisms!