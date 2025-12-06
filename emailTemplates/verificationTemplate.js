function renderVerificationEmail({ firstName, verificationCode, expiryHours = 24 }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your AutoMediaCenter Account</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #1a73e8; margin-bottom: 10px; }
        .verification-code { background: #f8f9fa; border: 2px dashed #1a73e8; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
        .code { font-size: 32px; font-weight: bold; color: #1a73e8; letter-spacing: 4px; font-family: 'Courier New', monospace; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; text-align: center; }
        .button { display: inline-block; background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
        .button:hover { background: #1557b0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">AutoMediaCenter</div>
            <h1>Verify Your Email Address</h1>
        </div>
        
        <p>Hello ${firstName},</p>
        <p>Thank you for signing up for AutoMediaCenter! Please verify your email address to complete your account setup.</p>
        
        <div class="verification-code">
            <p><strong>Your verification code is:</strong></p>
            <div class="code">${verificationCode}</div>
            <p style="margin-top: 15px; font-size: 14px; color: #666;">Enter this code on the verification page to activate your account.</p>
        </div>
        
        <p>This code will expire in <strong>${expiryHours} hours</strong>. If you don't verify your email within this time, you'll need to request a new verification code.</p>
        
        <div class="warning">
            <strong>Security Notice:</strong> If you didn't create an AutoMediaCenter account, please ignore this email. Your email address will not be used without verification.
        </div>
        
        <div class="footer">
            <p>This email was sent by AutoMediaCenter<br>
            If you have any questions, please contact our support team.</p>
            <p style="font-size: 12px; color: #999;">
                This is an automated message, please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = { renderVerificationEmail };