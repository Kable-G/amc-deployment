const nodemailer = require('nodemailer');
const { renderInviteEmail } = require('./emailTemplates/inviteTemplate');

// Email configuration
const createTransporter = () => {
  // Check if we have email configuration (support both EMAIL_* and SMTP_* env vars)
  const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const emailPort = process.env.EMAIL_PORT || process.env.SMTP_PORT || 587;
  const emailSecure = process.env.EMAIL_SECURE === 'true' || emailPort == 465;
  
  if (emailHost && emailUser && emailPass) {
    console.log(`📧 Creating email transporter with host: ${emailHost}, user: ${emailUser}`);
    return nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailSecure,
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
  }
  
  console.log('📧 No email configuration found, using console fallback mode');
  // Fallback to console logging if no email config
  return null;
};

const sendInviteEmail = async (inviteOrEmail, inviteToken, inviterName = 'AMC Admin') => {
  try {
    // Handle both invite object and individual parameters for backward compatibility
    let email, token, firstName, companyName;
    
    if (typeof inviteOrEmail === 'object' && inviteOrEmail.email) {
      // New format: invite object
      const invite = inviteOrEmail;
      email = invite.email;
      token = invite.token;
      firstName = invite.firstName || '';
      companyName = invite.companyName || 'AMC Platform';
      
      // Update invite status to track email attempt
      if (invite.save) {
        // Don't set 'sending' status as it's not in the schema - keep as 'pending' until sent
        invite.emailAttempts = (invite.emailAttempts || 0) + 1;
        invite.lastEmailAttempt = new Date();
        try {
          await invite.save();
        } catch (saveError) {
          console.warn('Could not update invite status:', saveError.message);
        }
      }
    } else {
      // Legacy format: individual parameters
      email = inviteOrEmail;
      token = inviteToken;
      firstName = '';
      companyName = 'AMC Platform';
    }
    
    const transporter = createTransporter();
    
    if (!transporter) {
      // Console fallback mode
      console.log('📧 EMAIL INVITE (Console Mode):');
      console.log('To:', email);
      console.log('From:', inviterName);
      console.log('Invite Token:', token);
      console.log('Company:', companyName);
      console.log('Invite URL:', `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite-accept.html?token=${token}`);
      
      // Update invite status if it's an object
      if (typeof inviteOrEmail === 'object' && inviteOrEmail.save) {
        try {
          inviteOrEmail.emailStatus = 'sent';
          inviteOrEmail.emailSentAt = new Date();
          await inviteOrEmail.save();
        } catch (saveError) {
          console.warn('Could not update invite status:', saveError.message);
        }
      }
      
      return { success: true, mode: 'console' };
    }

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite-accept.html?token=${token}`;
    
    // Personalized greeting
    const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || emailUser,
      to: email,
      subject: `AutoMediaCenter invites ${companyName} to join its global media platform`,
      html: renderInviteEmail({
        firstName: firstName || 'there',
        companyName: companyName,
        inviteLink: inviteUrl,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      })
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Invite email sent:', info.messageId);
    
    // Update invite status if it's an object
    if (typeof inviteOrEmail === 'object' && inviteOrEmail.save) {
      try {
        inviteOrEmail.emailStatus = 'sent';
        inviteOrEmail.emailSentAt = new Date();
        await inviteOrEmail.save();
      } catch (saveError) {
        console.warn('Could not update invite status:', saveError.message);
      }
    }
    
    return {
      success: true,
      messageId: info.messageId,
      mode: 'email'
    };
    
  } catch (error) {
    console.error('❌ Error sending invite email:', error);
    
    // Update invite status if it's an object
    if (typeof inviteOrEmail === 'object' && inviteOrEmail.save) {
      try {
        inviteOrEmail.emailStatus = 'failed';
        inviteOrEmail.emailError = error.message;
        inviteOrEmail.lastEmailAttempt = new Date();
        await inviteOrEmail.save();
      } catch (saveError) {
        console.warn('Could not update invite status:', saveError.message);
      }
    }
    
    // Fallback to console logging on email error
    const email = typeof inviteOrEmail === 'object' ? inviteOrEmail.email : inviteOrEmail;
    const token = typeof inviteOrEmail === 'object' ? inviteOrEmail.token : inviteToken;
    const companyName = typeof inviteOrEmail === 'object' ? inviteOrEmail.companyName : 'AMC Platform';
    
    console.log('📧 EMAIL INVITE (Fallback Mode):');
    console.log('To:', email);
    console.log('From:', inviterName);
    console.log('Invite Token:', token);
    console.log('Company:', companyName);
    console.log('Invite URL:', `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite-accept.html?token=${token}`);
    
    return {
      success: true,
      error: error.message,
      mode: 'console_fallback'
    };
  }
};

module.exports = {
  sendInviteEmail
};