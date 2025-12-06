function renderMediaUserWelcomeEmail({ firstName, jobTitle, country, company }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to AutoMediaCenter</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #1a73e8; margin-bottom: 10px; }
        .welcome-badge { background: linear-gradient(135deg, #1a73e8, #4285f4); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
        .features { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .feature-list { list-style: none; padding: 0; }
        .feature-list li { padding: 8px 0; padding-left: 25px; position: relative; }
        .feature-list li:before { content: "✓"; position: absolute; left: 0; color: #1a73e8; font-weight: bold; }
        .cta-button { display: inline-block; background: #1a73e8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; text-align: center; }
        .cta-button:hover { background: #1557b0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; text-align: center; }
        .profile-info { background: #e8f0fe; padding: 15px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">AutoMediaCenter</div>
            <h1>Welcome to AutoMediaCenter!</h1>
        </div>
        
        <div class="welcome-badge">
            <h2 style="margin: 0; font-size: 24px;">🎉 Account Verified Successfully!</h2>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">You're now part of the automotive media community</p>
        </div>
        
        <p>Hello ${firstName},</p>
        <p>Congratulations! Your AutoMediaCenter account has been successfully verified and activated. We're excited to have you join our community of automotive media professionals.</p>
        
        ${jobTitle || country || company ? `
        <div class="profile-info">
            <h3 style="margin-top: 0;">Your Profile Information:</h3>
            ${jobTitle ? `<p><strong>Job Title:</strong> ${jobTitle}</p>` : ''}
            ${country ? `<p><strong>Country:</strong> ${country}</p>` : ''}
            ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        </div>
        ` : ''}
        
        <div class="features">
            <h3>What you can do with AutoMediaCenter:</h3>
            <ul class="feature-list">
                <li>Access the latest automotive press releases and media assets</li>
                <li>Download high-resolution images, videos, and documents</li>
                <li>Stay updated with industry news and announcements</li>
                <li>Connect with automotive brands and PR teams</li>
                <li>Manage your media downloads and preferences</li>
            </ul>
        </div>
        
        <div style="text-align: center;">
            <a href="${process.env.BASE_URL || 'https://automediacenter.com'}/automediacenter.html" class="cta-button">
                Start Exploring AutoMediaCenter
            </a>
        </div>
        
        <p>If you have any questions or need assistance getting started, our support team is here to help. Simply reply to this email or contact us through the platform.</p>
        
        <p>Thank you for choosing AutoMediaCenter as your automotive media resource!</p>
        
        <p>Best regards,<br>
        <strong>The AutoMediaCenter Team</strong></p>
        
        <div class="footer">
            <p>AutoMediaCenter - Your Gateway to Automotive Media<br>
            <a href="${process.env.BASE_URL || 'https://automediacenter.com'}" style="color: #1a73e8;">Visit AutoMediaCenter</a></p>
            <p style="font-size: 12px; color: #999;">
                This email was sent to confirm your account verification. If you have any questions, please contact our support team.
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = { renderMediaUserWelcomeEmail };