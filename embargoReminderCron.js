// embargoReminderCron.js
//
// Runs hourly. Finds vaults whose embargo lifts in the next 24 hours
// and sends a one-time reminder email to each invited journalist.
//
// Tracking: adds a `embargoReminderSentAt` field to VaultAsset once
// the reminder batch has been dispatched — prevents duplicate sends.
//
// Loaded in server.js via:
//   require('./embargoReminderCron');

'use strict';

const cron       = require('node-cron');
const nodemailer = require('nodemailer');
const mongoose   = require('mongoose');
const VaultAsset = require('./models/VaultAsset');
const User       = require('./models/User');

// ── Mail transport — same Brevo config as rest of app ────────
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp-relay.brevo.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── Format embargo date for email ────────────────────────────
function fmtEmbargoEmail(dateStr, tz) {
  const dt = new Date(dateStr);
  if (!dt || isNaN(dt)) return 'See your vault for details';
  const safeTz = tz || 'Europe/Berlin';
  try {
    const tzLabel = dt.toLocaleTimeString('en-GB', {
      timeZone: safeTz, timeZoneName: 'short'
    }).split(' ').pop();
    const formatted = dt.toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: safeTz, hour12: false
    });
    return `${formatted} ${tzLabel}`;
  } catch(e) {
    return dt.toUTCString();
  }
}

// ── Send reminder email ───────────────────────────────────────
async function sendEmbargoReminderEmail({ toEmail, toName, vaultTitle, embargoUntil, timezone, senderCompany }) {
  const embargoStr   = fmtEmbargoEmail(embargoUntil, timezone);
  const vaultUrl     = `${process.env.APP_URL || 'https://automediacenter.com'}/automediavault.html`;
  const recipientName = toName ? `Hi ${toName.split(' ')[0]},` : 'Hi,';
  const senderLabel  = senderCompany || 'AutoMediaCenter';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#64748b;">AutoMediaCenter</p>
          <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.02em;">Embargo lifts in 24 hours</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 36px;">
          <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">${recipientName}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
            This is a reminder that the embargo on the following Media Vault from <strong>${senderLabel}</strong> lifts in <strong>24 hours</strong>.
          </p>

          <!-- Vault info card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">MEDIA VAULT</p>
              <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;line-height:1.3;">${vaultTitle}</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:8px;font-size:13px;color:#dc2626;">⚠</td>
                  <td style="font-size:13px;font-weight:600;color:#dc2626;">Embargo: ${embargoStr}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- Reminder text -->
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
            Please ensure you have downloaded all assets you need before publishing. Remember — all content from this vault is embargoed until the date and time above. Publishing before the embargo lifts is a breach of your NDA.
          </p>

          <!-- CTA button -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#2563eb;border-radius:8px;">
              <a href="${vaultUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">Open Media Vault →</a>
            </td></tr>
          </table>

          <!-- Security notice -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-left:3px solid #2563eb;border-radius:0 6px 6px 0;">
            <tr><td style="padding:14px 18px;font-size:12px;color:#1e40af;line-height:1.6;">
              <strong>Reminder:</strong> All downloads from this Media Vault are watermarked with your journalist identity. The embargo date and time above is legally binding under the NDA you signed.
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 36px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
            AutoMediaCenter · <a href="https://automediacenter.com" style="color:#94a3b8;">automediacenter.com</a><br>
            You are receiving this reminder because you have access to a Media Vault with an upcoming embargo. Do not forward this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Embargo reminder — ${vaultTitle}\n\nThe embargo on this Media Vault from ${senderLabel} lifts in 24 hours.\n\nEmbargo: ${embargoStr}\n\nOpen your vault: ${vaultUrl}\n\nAll content is embargoed until the above date and time. Publishing before the embargo lifts is a breach of your NDA.\n\nAutoMediaCenter`;

  try {
    await mailer.sendMail({
      from:    '"AutoMediaVault" <noreply@automediacenter.com>',
      to:      toEmail,
      subject: `Embargo reminder: "${vaultTitle}" lifts in 24 hours`,
      html,
      text
    });
    console.log(`[EMBARGO REMINDER] ✅ Sent to ${toEmail} for vault: "${vaultTitle}"`);
    return true;
  } catch (err) {
    console.error(`[EMBARGO REMINDER] ❌ Failed to send to ${toEmail}:`, err.message);
    return false;
  }
}

// ── Main cron task ────────────────────────────────────────────
async function runEmbargoReminderTask() {
  console.log('[EMBARGO REMINDER] Running embargo reminder check...');

  const now      = new Date();
  const in23hrs  = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25hrs  = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  try {
    // Find active vaults whose embargo falls within the 23-25 hour window
    // and haven't had a reminder sent yet
    const vaults = await VaultAsset.find({
      status:                 'active',
      embargoUntil:           { $gte: in23hrs, $lte: in25hrs },
      embargoReminderSentAt:  { $exists: false }
    })
    .select('_id title embargoUntil availabilityTimezone invitedUsers brand companyName user')
    .populate('user', 'email firstName lastName')
    .lean();

    if (!vaults.length) {
      console.log('[EMBARGO REMINDER] No vaults due for reminder.');
      return;
    }

    console.log(`[EMBARGO REMINDER] Found ${vaults.length} vault(s) due for reminder.`);

    for (const vault of vaults) {
      const senderCompany = vault.brand || vault.companyName || 'AutoMediaCenter';
      const invitedEmails = vault.invitedUsers || [];

      if (!invitedEmails.length) {
        console.log(`[EMBARGO REMINDER] Vault "${vault.title}" has no invited journalists — skipping.`);
        continue;
      }

      let sentCount = 0;

      for (const email of invitedEmails) {
        // Try to get journalist's name for personalisation
        let toName = null;
        try {
          const journalist = await User.findOne({ email }).select('firstName lastName name').lean();
          if (journalist) {
            toName = journalist.firstName
              ? `${journalist.firstName} ${journalist.lastName || ''}`.trim()
              : journalist.name || null;
          }
        } catch(e) { /* non-fatal */ }

        const sent = await sendEmbargoReminderEmail({
          toEmail:      email,
          toName,
          vaultTitle:   vault.title,
          embargoUntil: vault.embargoUntil,
          timezone:     vault.availabilityTimezone || 'Europe/Berlin',
          senderCompany
        });

        if (sent) sentCount++;
      }

      // Mark vault as having had reminder sent — prevents duplicate sends
      await VaultAsset.findByIdAndUpdate(vault._id, {
        $set: { embargoReminderSentAt: new Date() }
      });

      console.log(`[EMBARGO REMINDER] Vault "${vault.title}" — ${sentCount}/${invitedEmails.length} reminders sent.`);
    }

  } catch (err) {
    console.error('[EMBARGO REMINDER] Task error:', err.message);
  }
}

// ── Schedule: runs every hour at :00 ─────────────────────────
cron.schedule('0 * * * *', runEmbargoReminderTask);

console.log('✅ Embargo reminder cron job initialised — runs hourly');

module.exports = { runEmbargoReminderTask };
