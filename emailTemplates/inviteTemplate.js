const renderInviteEmail = ({
  firstName,
  companyName,
  inviteLink,
  expiryDate,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AutoMediaCenter Invitation</title>
<style>
body{margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif;color:#111827;}
.wrapper{width:100%;background:#f8fafc;padding:40px 0;}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;}
.header{background:#0d6efd;color:#fff;padding:24px;text-align:center;}
.header h1{margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;}
.hero-tagline{font-size:14px;color:#e0e7ff;letter-spacing:0.3px;margin-top:6px;font-style:italic;}
.content{padding:32px 36px;line-height:1.6;font-size:15px;color:#374151;}
.content p{margin-bottom:16px;}
.content ul{padding-left:18px;margin:12px 0 20px 0;}
.cta{text-align:center;margin:30px 0;}
.cta a{background:#0d6efd;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:15px;display:inline-block;}
.cta a:hover{background:#0b5ed7;}
.footer{border-top:1px solid #e5e7eb;text-align:center;padding:24px 20px;font-size:13px;color:#6b7280;}
.footer a{color:#0d6efd;text-decoration:none;}
.footer a:hover{text-decoration:underline;}
@media(max-width:620px){.content{padding:24px 20px;}}
</style>
</head>
<body>
<div class="wrapper"><div class="container">
  <div class="header">
    <h1>AutoMediaCenter</h1>
    <div class="hero-tagline">Where automotive stories begin</div>
  </div>
  <div class="content">
    <p>Hello ${firstName},</p>
    <p><strong>AutoMediaCenter invites ${companyName} to join its global media-intelligence and content-distribution platform for the automotive industry.</strong></p>
    <p>By activating your company's account, you'll gain access to:</p>
    <ul>
      <li>Centralised media releases, assets, and analytics</li>
      <li>Real-time performance insights across news, creators, and channels</li>
      <li>Controlled distribution tools for press and influencer outreach</li>
    </ul>
    <p>To begin onboarding, click the button below and complete your company's registration:</p>
    <div class="cta"><a href="${inviteLink}" target="_blank">Join AutoMediaCenter now</a></div>
    <p>This link will remain active until <strong>${expiryDate}</strong>.</p>
    <p>If you weren't expecting this invitation, please disregard it or contact our team at 
      <a href="mailto:support@automediacenter.com">support@automediacenter.com</a>.
    </p>
    <p>For more information about the platform, visit 
      <a href="https://automediacenter.com" target="_blank">automediacenter.com</a>.
    </p>
  </div>
  <div class="footer">
    © ${new Date().getFullYear()} AutoMediaCenter · Where automotive stories begin<br>
    — The AutoMediaCenter Team
  </div>
</div></div>
</body>
</html>
`;

module.exports = { renderInviteEmail };