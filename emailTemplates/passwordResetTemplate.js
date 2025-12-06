function renderPasswordResetEmail({ firstName, resetLink, expiryHours = 1 }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - AutoMediaCenter</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0d6efd;
            margin-bottom: 10px;
        }
        .title {
            font-size: 28px;
            font-weight: 600;
            color: #1a1a1a;
            margin: 0 0 10px 0;
        }
        .subtitle {
            color: #666;
            font-size: 16px;
            margin: 0;
        }
        .content {
            margin: 30px 0;
        }
        .reset-button {
            display: inline-block;
            background: #0d6efd;
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: background-color 0.2s;
        }
        .reset-button:hover {
            background: #0b5ed7;
        }
        .security-notice {
            background: #f8f9fa;
            border-left: 4px solid #0d6efd;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
            text-align: center;
        }
        .link-fallback {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            word-break: break-all;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">AutoMediaCenter</div>
            <h1 class="title">Reset Your Password</h1>
            <p class="subtitle">We received a request to reset your password</p>
        </div>
        
        <div class="content">
            <p>Hi ${firstName},</p>
            
            <p>Someone requested a password reset for your AutoMediaCenter account. If this was you, click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" class="reset-button">Reset My Password</a>
            </div>
            
            <div class="security-notice">
                <strong>🔒 Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>This link will expire in ${expiryHours} hour${expiryHours !== 1 ? 's' : ''}</li>
                    <li>If you didn't request this reset, you can safely ignore this email</li>
                    <li>Your password won't change until you create a new one</li>
                </ul>
            </div>
            
            <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
            <div class="link-fallback">${resetLink}</div>
            
            <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.</p>
        </div>
        
        <div class="footer">
            <p>This email was sent by AutoMediaCenter<br>
            If you have questions, contact us at <a href="mailto:support@automediacenter.com">support@automediacenter.com</a></p>
            
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                This is an automated message, please do not reply to this email.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = { renderPasswordResetEmail };