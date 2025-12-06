const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { renderVerificationEmail } = require("../emailTemplates/verificationTemplate");
const { renderMediaUserWelcomeEmail } = require("../emailTemplates/mediaUserWelcomeTemplate");
const { renderPasswordResetEmail } = require("../emailTemplates/passwordResetTemplate");
const MailLog = require("../models/MailLog");

dotenv.config();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds for verification emails (faster than invite emails)

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function logMailEvent({ recipient, subject, status, errorMessage, attempt, emailType }) {
  try {
    await MailLog.create({ 
      recipient, 
      companyName: 'AutoMediaCenter', // For media user emails
      subject, 
      status, 
      errorMessage, 
      attempt,
      emailType: emailType || 'media_user_verification'
    });
  } catch (err) {
    console.error("⚠️ Mail log error:", err);
  }
}

async function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // Use STARTTLS for port 587
    requireTLS: true, // Force TLS upgrade
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      ciphers: 'SSLv3'
    }
  });
}

async function sendVerificationEmail(user, verificationCode) {
  const subject = "Verify your AutoMediaCenter account";
  const firstName = user.name ? user.name.split(' ')[0] : 'there';
  
  const htmlBody = renderVerificationEmail({
    firstName,
    verificationCode,
    expiryHours: 24
  });

  let attempt = 0;
  let success = false;
  let lastError = "";

  while (attempt < MAX_RETRIES && !success) {
    attempt++;
    try {
      const transporter = await createTransporter();
      await transporter.sendMail({
        from: `"AutoMediaCenter" <${process.env.SMTP_USER}>`,
        replyTo: 'support@automediacenter.com',
        to: user.email,
        subject,
        html: htmlBody
      });

      console.log(`✅ Verification email sent to ${user.email} (attempt ${attempt})`);
      success = true;
      
      await logMailEvent({
        recipient: user.email,
        subject,
        status: "sent",
        attempt,
        emailType: 'verification'
      });
    } catch (err) {
      lastError = err.message;
      console.error(`❌ Verification email attempt ${attempt} failed for ${user.email}:`, lastError);
      
      await logMailEvent({
        recipient: user.email,
        subject,
        status: "failed",
        errorMessage: lastError,
        attempt,
        emailType: 'verification'
      });

      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying verification email in ${RETRY_DELAY_MS / 1000}s...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  if (!success) {
    console.error(`🚫 All ${MAX_RETRIES} verification email attempts failed for ${user.email}`);
  }

  return success;
}

async function sendWelcomeEmail(user) {
  const subject = "Welcome to AutoMediaCenter!";
  const firstName = user.name ? user.name.split(' ')[0] : 'there';
  
  const htmlBody = renderMediaUserWelcomeEmail({
    firstName,
    jobTitle: user.jobTitle,
    country: user.country,
    company: user.company
  });

  let attempt = 0;
  let success = false;
  let lastError = "";

  while (attempt < MAX_RETRIES && !success) {
    attempt++;
    try {
      const transporter = await createTransporter();
      await transporter.sendMail({
        from: `"AutoMediaCenter" <${process.env.SMTP_USER}>`,
        replyTo: 'support@automediacenter.com',
        to: user.email,
        subject,
        html: htmlBody
      });

      console.log(`✅ Welcome email sent to ${user.email} (attempt ${attempt})`);
      success = true;
      
      await logMailEvent({
        recipient: user.email,
        subject,
        status: "sent",
        attempt,
        emailType: 'welcome'
      });
    } catch (err) {
      lastError = err.message;
      console.error(`❌ Welcome email attempt ${attempt} failed for ${user.email}:`, lastError);
      
      await logMailEvent({
        recipient: user.email,
        subject,
        status: "failed",
        errorMessage: lastError,
        attempt,
        emailType: 'welcome'
      });

      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying welcome email in ${RETRY_DELAY_MS / 1000}s...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  if (!success) {
    console.error(`🚫 All ${MAX_RETRIES} welcome email attempts failed for ${user.email}`);
  }

  return success;
}

async function sendPasswordResetEmail(user, resetToken) {
  const subject = "Reset your AutoMediaCenter password";
  const firstName = user.name ? user.name.split(' ')[0] : 'there';
  
  // Create the reset link using the frontend URL
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontendUrl}/reset-password.html?token=${resetToken}`;
  
  const htmlBody = renderPasswordResetEmail({
    firstName,
    resetLink,
    expiryHours: 1
  });

  let attempt = 0;
  let success = false;
  let lastError = "";

  while (attempt < MAX_RETRIES && !success) {
    attempt++;
    try {
      const transporter = await createTransporter();
      await transporter.sendMail({
        from: `"AutoMediaCenter" <${process.env.SMTP_USER}>`,
        replyTo: 'support@automediacenter.com',
        to: user.email,
        subject,
        html: htmlBody
      });

      console.log(`✅ Password reset email sent to ${user.email} (attempt ${attempt})`);
      success = true;
      
      await logMailEvent({
        recipient: user.email,
        subject,
        status: "sent",
        attempt,
        emailType: 'password_reset'
      });
    } catch (err) {
      lastError = err.message;
      console.error(`❌ Password reset email attempt ${attempt} failed for ${user.email}:`, lastError);
      
      await logMailEvent({
        recipient: user.email,
        subject,
        status: "failed",
        errorMessage: lastError,
        attempt,
        emailType: 'password_reset'
      });

      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Retrying password reset email in ${RETRY_DELAY_MS / 1000}s...`);
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  if (!success) {
    console.error(`🚫 All ${MAX_RETRIES} password reset email attempts failed for ${user.email}`);
  }

  return success;
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
};