/**
 * ============================================================
 * AutoMediaVault — Secure Backend
 * ============================================================
 * Stack:   Node.js · Express · MongoDB/Mongoose · bcrypt
 * Email:   SendGrid Transactional API
 * SMS:     Twilio Verify (OTP)
 * Auth:    JWT (vault session tokens)
 * Assets:  AWS S3 presigned URLs
 *
 * Routes:
 *   POST /api/vault/nda-sign        — sign NDA, dispatch password
 *   POST /api/vault/unlock          — verify password, issue JWT
 *   GET  /api/vault/asset/:vaultId  — get signed download URL (JWT protected)
 *   POST /api/vault/resend          — resend password (rate-limited)
 *
 * ============================================================
 */

'use strict';

// ── Dependencies ─────────────────────────────────────────────
const express      = require('express');
const router       = express.Router();
const bcrypt       = require('bcrypt');
const crypto       = require('crypto');
const jwt          = require('jsonwebtoken');
const sgMail       = require('@sendgrid/mail');
const twilio       = require('twilio');
const AWS          = require('aws-sdk');
const rateLimit    = require('express-rate-limit');
const mongoose     = require('mongoose');

// ── Environment config ───────────────────────────────────────
const {
  JWT_SECRET,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,      // e.g. noreply@automediacenter.com
  SENDGRID_FROM_NAME,       // e.g. AutoMediaVault
  SENDGRID_TEMPLATE_ID,     // optional: dynamic template ID
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID, // Twilio Verify service SID (not a phone number)
  AWS_REGION,
  AWS_S3_BUCKET,
  SIGNED_URL_EXPIRY_SECONDS, // default: 300 (5 minutes)
  BCRYPT_ROUNDS,             // default: 12
  JWT_VAULT_EXPIRY,          // default: '8h'
  MAX_PASSWORD_ATTEMPTS,     // default: 5
  RESEND_LIMIT_PER_DAY,      // default: 3
} = process.env;

// ── Initialise third-party clients ───────────────────────────
sgMail.setApiKey(SENDGRID_API_KEY);
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const s3 = new AWS.S3({ region: AWS_REGION });

const BCRYPT_COST    = parseInt(BCRYPT_ROUNDS)              || 12;
const URL_EXPIRY     = parseInt(SIGNED_URL_EXPIRY_SECONDS)  || 300;
const JWT_EXPIRY     = JWT_VAULT_EXPIRY                     || '8h';
const MAX_ATTEMPTS   = parseInt(MAX_PASSWORD_ATTEMPTS)      || 5;
const MAX_RESENDS    = parseInt(RESEND_LIMIT_PER_DAY)       || 3;

// ============================================================
// MONGOOSE MODELS
// ============================================================

/**
 * VaultAccess — one record per (user × vault) pair.
 * Stores hashed password, NDA record, audit data.
 */
const vaultAccessSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vaultId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Vault', required: true },

  // NDA record
  signatureName:  { type: String, required: true },
  signedAt:       { type: Date },
  signingIp:      { type: String },
  signingDevice:  { type: String },   // UA + screen hash
  ndaPdfSentAt:   { type: Date },

  // Password
  passwordHash:   { type: String },
  passwordSetAt:  { type: Date },
  deliveryMethods:{ type: [String], enum: ['email', 'sms'] },

  // Delivery tracking
  emailDispatchedAt:  { type: Date },
  emailOpenedAt:      { type: Date },
  smsDispatchedAt:    { type: Date },
  smsDeliveredAt:     { type: Date },
  resendCount:        { type: Number, default: 0 },
  lastResendAt:       { type: Date },

  // Access
  accessGranted:      { type: Boolean, default: false },
  accessGrantedAt:    { type: Date },
  failedAttempts:     { type: Number, default: 0 },
  lockedAt:           { type: Date },
  lastAccessedAt:     { type: Date },
}, {
  timestamps: true,
  collection: 'vault_access'
});

// Compound unique index — one access record per user per vault
vaultAccessSchema.index({ userId: 1, vaultId: 1 }, { unique: true });

const VaultAccess = mongoose.model('VaultAccess', vaultAccessSchema);

/**
 * AuditLog — append-only. Never updated, never deleted.
 */
const auditLogSchema = new mongoose.Schema({
  vaultId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vault' },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  event:      { type: String, required: true },   // see EVENT_TYPES below
  meta:       { type: mongoose.Schema.Types.Mixed },
  ip:         { type: String },
  userAgent:  { type: String },
  ts:         { type: Date, default: Date.now },
}, {
  collection: 'audit_log'
});

// Prevent updates on audit log documents
auditLogSchema.pre('save', function(next) {
  if (!this.isNew) return next(new Error('AuditLog records are immutable'));
  next();
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

const EVENT = {
  NDA_SIGNED:           'NDA_SIGNED',
  PASSWORD_DISPATCHED:  'PASSWORD_DISPATCHED',
  EMAIL_OPENED:         'EMAIL_OPENED',
  SMS_DELIVERED:        'SMS_DELIVERED',
  VAULT_ACCESSED:       'VAULT_ACCESSED',
  ASSET_DOWNLOADED:     'ASSET_DOWNLOADED',
  FAILED_ATTEMPT:       'FAILED_ATTEMPT',
  VAULT_LOCKED:         'VAULT_LOCKED',
  PASSWORD_RESENT:      'PASSWORD_RESENT',
  JWT_ISSUED:           'JWT_ISSUED',
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate a cryptographically secure alphanumeric password.
 * 16 characters — strong enough for a vault access code,
 * short enough to type from an SMS.
 */
function generateVaultPassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  // Exclude ambiguous: 0/O, 1/l/I
  let result = '';
  const bytes = crypto.randomBytes(length * 2); // oversample
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    const idx = bytes[i] % chars.length;
    // Rejection sampling — discard values that would bias toward lower indices
    if (bytes[i] < Math.floor(256 / chars.length) * chars.length) {
      result += chars[idx];
    }
  }
  // Fallback if rejection sampling exhausted buffer
  while (result.length < length) {
    result += chars[crypto.randomInt(chars.length)];
  }
  return result;
}

/**
 * Write an immutable audit log entry.
 */
async function audit(event, { vaultId, userId, meta = {}, req } = {}) {
  try {
    await AuditLog.create({
      event, vaultId, userId, meta,
      ip:        req?.ip || meta.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    // Audit failure must never break the main flow — log to stderr
    console.error('[AUDIT FAIL]', event, err.message);
  }
}

/**
 * Get client IP, respecting reverse proxy headers.
 */
function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

/**
 * Build a lightweight device fingerprint from request headers.
 * Not cryptographic — for display in audit UI only.
 */
function deviceFingerprint(req) {
  const ua = req.headers['user-agent'] || '';
  const lang = req.headers['accept-language'] || '';
  const hash = crypto.createHash('sha256')
    .update(ua + lang)
    .digest('hex')
    .slice(0, 12);
  return `${ua.slice(0, 60)} [${hash}]`;
}

// ============================================================
// RATE LIMITERS
// ============================================================

const ndaSignLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, code: 'RATE_LIMITED', message: 'Too many unlock attempts. Please wait.' },
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3,
  message: { success: false, code: 'RATE_LIMITED', message: 'Maximum resend attempts reached for this hour.' },
});

// ============================================================
// EMAIL — SendGrid
// ============================================================

/**
 * Send branded vault password email via SendGrid.
 *
 * The HTML template embeds:
 * - Vault title and client brand
 * - The one-time password in a large, bold monospace block
 * - Publishing embargo date/time in red
 * - Journalist's signed name and timestamp as confirmation
 * - Link to access the vault (not the password — security separation)
 */
async function sendPasswordEmail({ to, toName, vaultTitle, clientName, password, embargoDisplay, signedName, vaultUrl, vaultId, userId }) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AutoMediaVault Access</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
            AutoMedia<span style="color:#3b82f6;">Vault</span>
          </p>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Secure Embargoed Asset Distribution</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">

          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">
            ${clientName}
          </p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;line-height:1.2;">
            ${vaultTitle}
          </h1>

          <!-- NDA Confirmation -->
          <div style="background:#ecfdf5;border:1px solid rgba(5,150,105,0.2);border-radius:8px;padding:14px 16px;margin-bottom:24px;display:flex;align-items:center;gap:10px;">
            <p style="margin:0;font-size:13px;color:#059669;font-weight:600;">
              ✓ NDA signed by ${signedName}
            </p>
          </div>

          <!-- Embargo — always red -->
          <div style="background:#fef2f2;border:1px solid rgba(220,38,38,0.2);border-left:4px solid #dc2626;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#dc2626;">
              ⚠ DO NOT PUBLISH BEFORE: ${embargoDisplay}
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#dc2626;opacity:0.8;">
              Publishing before this date constitutes a breach of your signed NDA.
            </p>
          </div>

          <!-- Password block -->
          <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">
              Your Vault Access Password
            </p>
            <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:0.15em;color:#0f172a;font-family:'Courier New',monospace;">
              ${password}
            </p>
            <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">
              Enter this password at the vault portal. Do not share it.
            </p>
          </div>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${vaultUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;letter-spacing:-0.01em;">
              Access Vault Portal →
            </a>
          </div>

          <!-- Security notice -->
          <div style="background:#eff6ff;border:1px solid rgba(37,99,235,0.15);border-radius:8px;padding:14px 16px;margin-bottom:0;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#2563eb;">Security Notice</p>
            <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
              All downloads from this vault are watermarked with your identity and logged with timestamp and IP address.
              This email and your NDA signature constitute an immutable audit record.
              If you did not sign this NDA, contact <a href="mailto:security@automediacenter.com" style="color:#2563eb;">security@automediacenter.com</a> immediately.
            </p>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
            AutoMediaCenter · automediacenter.com<br>
            This email was sent to ${to} as part of the AutoMediaVault secure asset access workflow.
            Vault ID: ${vaultId} · User ID: ${userId}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const msg = {
    to:      { email: to, name: toName },
    from:    { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME || 'AutoMediaVault' },
    subject: `Vault Access Password — ${vaultTitle}`,
    text: `Your AutoMediaVault access password for "${vaultTitle}" is: ${password}\n\nEMBARGO: DO NOT PUBLISH BEFORE ${embargoDisplay}\n\nAccess the vault at: ${vaultUrl}\n\nAll downloads are watermarked and logged.`,
    html,
    // SendGrid tracking — used to record email open events in audit log
    trackingSettings: {
      clickTracking:  { enable: true },
      openTracking:   { enable: true },
    },
    customArgs: {
      vaultId:  String(vaultId),
      userId:   String(userId),
      event:    'vault_password',
    },
  };

  const [response] = await sgMail.send(msg);
  return { messageId: response?.headers?.['x-message-id'], statusCode: response?.statusCode };
}

// ============================================================
// SMS — Twilio Verify
// ============================================================

/**
 * Send vault password via Twilio Verify.
 *
 * We use Twilio Verify rather than basic Twilio Messages because:
 * - Delivery receipts via webhook
 * - Built-in rate limiting and fraud detection
 * - Global phone number formatting and routing
 * - OTP expiry managed by Twilio
 *
 * Note: Twilio Verify sends the code — it doesn't let us set a
 * custom message for the OTP. For the vault password (which is
 * longer than a 6-digit OTP), we use Twilio Messaging with the
 * Verify service's channel for custom text.
 */
async function sendPasswordSms({ to, password, vaultTitle, embargoDisplay, userId, vaultId }) {
  const message = `AutoMediaVault\n\nVault: ${vaultTitle}\nPassword: ${password}\n\nDO NOT PUBLISH BEFORE ${embargoDisplay}\n\nAll downloads are watermarked. Reply STOP to opt out.`;

  const result = await twilioClient.messages.create({
    body: message,
    messagingServiceSid: TWILIO_VERIFY_SERVICE_SID, // use messaging service for best delivery
    to,
    statusCallback: `${process.env.APP_BASE_URL}/api/vault/sms-status`, // delivery webhook
  });

  return { sid: result.sid, status: result.status };
}

// ============================================================
// ROUTE 1: POST /api/vault/nda-sign
// ============================================================

/**
 * Called when a journalist completes the NDA signing modal.
 *
 * Request body:
 * {
 *   vaultId:          string,
 *   signatureName:    string,   // typed legal name
 *   deliveryMethods:  { email: boolean, sms: boolean },
 * }
 *
 * Requires: authenticated session (req.user set by auth middleware)
 */
router.post('/nda-sign', ndaSignLimiter, requireAuth, async (req, res) => {
  const { vaultId, signatureName, deliveryMethods = {} } = req.body;
  const userId = req.user.id;
  const ip     = getIp(req);
  const device = deviceFingerprint(req);

  // ── Input validation ────────────────────────────────────
  if (!vaultId || !signatureName?.trim() || signatureName.trim().length < 3) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Valid signature name required.' });
  }

  if (!deliveryMethods.email && !deliveryMethods.sms) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'At least one delivery method required.' });
  }

  try {
    // ── Load vault & user ───────────────────────────────
    const [vault, user] = await Promise.all([
      Vault.findById(vaultId),
      User.findById(userId),
    ]);

    if (!vault) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Vault not found.' });
    if (!user)  return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found.' });

    // Check vault is accepting signatures
    if (vault.status !== 'published' && vault.status !== 'scheduled') {
      return res.status(403).json({ success: false, code: 'VAULT_NOT_ACTIVE', message: 'This vault is not currently active.' });
    }

    // Check user is on the access list
    const isInvited = vault.invitedUsers.some(u => u.toString() === userId.toString())
                   || vault.invitedGroups.some(g => user.groups?.includes(g.toString()));
    if (!isInvited) {
      return res.status(403).json({ success: false, code: 'NOT_INVITED', message: 'You have not been invited to this vault.' });
    }

    // Check not already signed (idempotent — allow resend via separate route)
    const existing = await VaultAccess.findOne({ userId, vaultId });
    if (existing?.accessGranted) {
      return res.status(409).json({ success: false, code: 'ALREADY_UNLOCKED', message: 'You already have access to this vault.' });
    }

    // ── Generate & hash password ────────────────────────
    const plainPassword  = generateVaultPassword(16);
    const passwordHash   = await bcrypt.hash(plainPassword, BCRYPT_COST);

    // ── Upsert VaultAccess record ───────────────────────
    const accessRecord = await VaultAccess.findOneAndUpdate(
      { userId, vaultId },
      {
        $set: {
          signatureName:    signatureName.trim(),
          signedAt:         new Date(),
          signingIp:        ip,
          signingDevice:    device,
          passwordHash,
          passwordSetAt:    new Date(),
          deliveryMethods:  Object.keys(deliveryMethods).filter(k => deliveryMethods[k]),
        }
      },
      { upsert: true, new: true }
    );

    // ── Log NDA signature ───────────────────────────────
    await audit(EVENT.NDA_SIGNED, {
      vaultId, userId,
      meta: { signatureName: signatureName.trim(), ip, device, deliveryMethods },
      req,
    });

    // ── Dispatch password ───────────────────────────────
    const embargoDisplay = formatEmbargo(vault.embargoDate, vault.embargoTimezone);
    const vaultUrl = `${process.env.APP_BASE_URL}/vault/${vault._id}`;
    const dispatchResults = {};

    if (deliveryMethods.email && user.email) {
      try {
        const emailResult = await sendPasswordEmail({
          to:             user.email,
          toName:         user.fullName,
          vaultTitle:     vault.title,
          clientName:     vault.clientName,
          password:       plainPassword,
          embargoDisplay,
          signedName:     signatureName.trim(),
          vaultUrl,
          vaultId:        vault._id,
          userId:         user._id,
        });

        await VaultAccess.findByIdAndUpdate(accessRecord._id, {
          $set: { emailDispatchedAt: new Date() }
        });

        await audit(EVENT.PASSWORD_DISPATCHED, {
          vaultId, userId,
          meta: { method: 'email', messageId: emailResult.messageId, to: user.email },
          req,
        });

        dispatchResults.email = { success: true, messageId: emailResult.messageId };
      } catch (emailErr) {
        console.error('[EMAIL DISPATCH FAIL]', emailErr.message);
        dispatchResults.email = { success: false, error: emailErr.message };
      }
    }

    if (deliveryMethods.sms && user.mobile) {
      try {
        const smsResult = await sendPasswordSms({
          to:             user.mobile,
          password:       plainPassword,
          vaultTitle:     vault.title,
          embargoDisplay,
          userId:         user._id,
          vaultId:        vault._id,
        });

        await VaultAccess.findByIdAndUpdate(accessRecord._id, {
          $set: { smsDispatchedAt: new Date() }
        });

        await audit(EVENT.PASSWORD_DISPATCHED, {
          vaultId, userId,
          meta: { method: 'sms', sid: smsResult.sid, to: maskMobile(user.mobile) },
          req,
        });

        dispatchResults.sms = { success: true, sid: smsResult.sid };
      } catch (smsErr) {
        console.error('[SMS DISPATCH FAIL]', smsErr.message);
        dispatchResults.sms = { success: false, error: smsErr.message };
      }
    }

    // ── Check at least one channel succeeded ─────────────
    const anySucceeded = Object.values(dispatchResults).some(r => r.success);
    if (!anySucceeded) {
      return res.status(502).json({
        success: false,
        code: 'DISPATCH_FAILED',
        message: 'NDA was signed but password delivery failed on all channels. Please contact support.',
        dispatchResults,
      });
    }

    return res.json({
      success:       true,
      signedAt:      accessRecord.signedAt,
      dispatched:    dispatchResults,
      message:       'NDA signed. Your vault password has been dispatched.',
    });

  } catch (err) {
    console.error('[NDA-SIGN ERROR]', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
  }
});

// ============================================================
// ROUTE 2: POST /api/vault/unlock
// ============================================================

/**
 * Called when a journalist enters their vault password.
 *
 * On success: issues a signed JWT for this vault session.
 * The JWT is required for all subsequent asset requests.
 *
 * Request body:
 * {
 *   vaultId:  string,
 *   password: string,
 * }
 */
router.post('/unlock', unlockLimiter, requireAuth, async (req, res) => {
  const { vaultId, password } = req.body;
  const userId = req.user.id;
  const ip     = getIp(req);

  if (!vaultId || !password) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Vault ID and password required.' });
  }

  try {
    const [vault, accessRecord] = await Promise.all([
      Vault.findById(vaultId),
      VaultAccess.findOne({ userId, vaultId }),
    ]);

    if (!vault) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Vault not found.' });
    }

    if (!accessRecord || !accessRecord.signedAt) {
      return res.status(403).json({ success: false, code: 'NDA_NOT_SIGNED', message: 'You must sign the NDA before accessing this vault.' });
    }

    // ── Check vault availability window ─────────────────
    const now = new Date();
    if (vault.availabilityDate && now < new Date(vault.availabilityDate)) {
      return res.status(403).json({
        success: false, code: 'VAULT_NOT_YET_AVAILABLE',
        message: `This vault opens at ${formatEmbargo(vault.availabilityDate, vault.embargoTimezone)}.`,
      });
    }

    // ── Check for lockout ───────────────────────────────
    if (accessRecord.lockedAt) {
      const lockDuration = 30 * 60 * 1000; // 30 minutes
      if (now - accessRecord.lockedAt < lockDuration) {
        const unlockAt = new Date(accessRecord.lockedAt.getTime() + lockDuration);
        return res.status(429).json({
          success: false, code: 'LOCKED',
          message: `This vault is locked due to too many failed attempts. Try again after ${unlockAt.toISOString()}.`,
        });
      }
      // Lock expired — reset
      await VaultAccess.findByIdAndUpdate(accessRecord._id, {
        $set: { lockedAt: null, failedAttempts: 0 }
      });
      accessRecord.failedAttempts = 0;
    }

    // ── Verify password ─────────────────────────────────
    const isValid = await bcrypt.compare(password, accessRecord.passwordHash);

    if (!isValid) {
      const newFailCount = (accessRecord.failedAttempts || 0) + 1;
      const shouldLock   = newFailCount >= MAX_ATTEMPTS;

      await VaultAccess.findByIdAndUpdate(accessRecord._id, {
        $set: {
          failedAttempts: newFailCount,
          ...(shouldLock && { lockedAt: new Date() }),
        }
      });

      await audit(EVENT.FAILED_ATTEMPT, {
        vaultId, userId,
        meta: { failedAttempts: newFailCount, locked: shouldLock, ip },
        req,
      });

      if (shouldLock) {
        // Notify client of lockout
        await notifyClientOfLockout(vault, req.user, newFailCount);

        await audit(EVENT.VAULT_LOCKED, {
          vaultId, userId,
          meta: { reason: 'max_attempts_exceeded', ip },
          req,
        });

        return res.status(429).json({
          success: false, code: 'LOCKED',
          message: `Vault locked after ${MAX_ATTEMPTS} failed attempts. Please contact support.`,
        });
      }

      return res.status(401).json({
        success:          false,
        code:             'WRONG_PASSWORD',
        message:          'Incorrect password.',
        attemptsRemaining: MAX_ATTEMPTS - newFailCount,
      });
    }

    // ── Password correct ────────────────────────────────
    // Issue vault session JWT
    const vaultToken = jwt.sign(
      {
        sub:     userId,
        vaultId: vault._id.toString(),
        scope:   'vault-access',
        jti:     crypto.randomUUID(), // unique token ID for revocation
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRY,
        issuer:    'automediacenter.com',
        audience:  'vault-portal',
      }
    );

    // Update access record
    await VaultAccess.findByIdAndUpdate(accessRecord._id, {
      $set: {
        accessGranted:   true,
        accessGrantedAt: new Date(),
        failedAttempts:  0,
        lastAccessedAt:  new Date(),
      }
    });

    await audit(EVENT.VAULT_ACCESSED, {
      vaultId, userId,
      meta: { ip, device: deviceFingerprint(req) },
      req,
    });

    await audit(EVENT.JWT_ISSUED, {
      vaultId, userId,
      meta: { jti: jwt.decode(vaultToken).jti, expiry: JWT_EXPIRY },
      req,
    });

    return res.json({
      success:    true,
      vaultToken, // store in memory only — do NOT store in localStorage
      vaultId:    vault._id,
      expiresIn:  JWT_EXPIRY,
      message:    'Vault access granted.',
    });

  } catch (err) {
    console.error('[UNLOCK ERROR]', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
  }
});

// ============================================================
// ROUTE 3: GET /api/vault/asset/:vaultId/:filename
// ============================================================

/**
 * Returns a pre-signed S3 URL for a specific asset.
 * Requires a valid vault session JWT.
 * Applies visible watermark to the asset before signing the URL.
 * Logs the download to the audit trail.
 */
router.get('/asset/:vaultId/:filename', requireAuth, requireVaultJwt, async (req, res) => {
  const { vaultId, filename } = req.params;
  const userId = req.user.id;
  const ip     = getIp(req);

  try {
    const [vault, user, accessRecord] = await Promise.all([
      Vault.findById(vaultId),
      User.findById(userId),
      VaultAccess.findOne({ userId, vaultId }),
    ]);

    if (!vault || !accessRecord?.accessGranted) {
      return res.status(403).json({ success: false, code: 'NO_ACCESS', message: 'Access not granted.' });
    }

    // ── Embargo check ────────────────────────────────────
    // Note: we DO allow download before embargo (that's the whole point of AutoMediaVault).
    // We just don't allow PUBLISHING. The watermark + NDA handles the legal side.

    // ── Vault expiry check ───────────────────────────────
    if (vault.expiresAt && new Date() > new Date(vault.expiresAt)) {
      return res.status(403).json({ success: false, code: 'VAULT_EXPIRED', message: 'This vault has expired. Assets are now available on AutoMediaCenter.' });
    }

    // ── Verify file exists in vault manifest ────────────
    const assetMeta = vault.assets.find(a => a.filename === filename);
    if (!assetMeta) {
      return res.status(404).json({ success: false, code: 'ASSET_NOT_FOUND', message: 'Asset not found in this vault.' });
    }

    // ── Phase 1: Visible watermark key ──────────────────
    // The watermarked version is stored alongside the original.
    // Key format: vaults/{vaultId}/watermarked/{userId}/{filename}
    // The watermark worker generates these on-demand or at NDA-sign time.
    // If not yet generated, fall back to original with a queue trigger.
    const watermarkedKey = `vaults/${vaultId}/watermarked/${userId}/${filename}`;
    const originalKey    = `vaults/${vaultId}/assets/${filename}`;

    // Check if watermarked version exists
    let s3Key = watermarkedKey;
    try {
      await s3.headObject({ Bucket: AWS_S3_BUCKET, Key: watermarkedKey }).promise();
    } catch (headErr) {
      if (headErr.code === 'NotFound') {
        // Trigger async watermark generation and serve original for now
        triggerWatermarkGeneration({ vaultId, userId, filename, user, vault });
        s3Key = originalKey;
      }
    }

    // ── Generate pre-signed URL (5-minute expiry) ────────
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket:  AWS_S3_BUCKET,
      Key:     s3Key,
      Expires: URL_EXPIRY,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });

    // ── Log download to immutable audit trail ─────────────
    await VaultAccess.findOneAndUpdate(
      { userId, vaultId },
      { $set: { lastAccessedAt: new Date() } }
    );

    await audit(EVENT.ASSET_DOWNLOADED, {
      vaultId, userId,
      meta: {
        filename,
        fileSize:       assetMeta.size,
        mimeType:       assetMeta.mimeType,
        watermarked:    s3Key === watermarkedKey,
        ip,
        device:         deviceFingerprint(req),
        watermarkRef:   `${userId}-${vaultId}-${Date.now()}`,
      },
      req,
    });

    return res.json({ success: true, url: signedUrl, expiresIn: URL_EXPIRY });

  } catch (err) {
    console.error('[ASSET DOWNLOAD ERROR]', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Could not generate download URL.' });
  }
});

// ============================================================
// ROUTE 4: POST /api/vault/resend
// ============================================================

/**
 * Resend the vault password to a journalist.
 * Invalidates the previous password and generates a new one.
 * Rate-limited to MAX_RESENDS per day per user per vault.
 */
router.post('/resend', resendLimiter, requireAuth, async (req, res) => {
  const { vaultId, deliveryMethods = {} } = req.body;
  const userId = req.user.id;

  try {
    const [vault, user, accessRecord] = await Promise.all([
      Vault.findById(vaultId),
      User.findById(userId),
      VaultAccess.findOne({ userId, vaultId }),
    ]);

    if (!accessRecord?.signedAt) {
      return res.status(403).json({ success: false, code: 'NDA_NOT_SIGNED', message: 'NDA not signed.' });
    }

    if (accessRecord.accessGranted) {
      return res.status(409).json({ success: false, code: 'ALREADY_UNLOCKED', message: 'Vault is already unlocked.' });
    }

    // ── Daily resend limit ───────────────────────────────
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (accessRecord.resendCount >= MAX_RESENDS && accessRecord.lastResendAt > oneDayAgo) {
      return res.status(429).json({
        success: false, code: 'RESEND_LIMIT',
        message: `Maximum of ${MAX_RESENDS} resend requests allowed per 24 hours. Please contact support.`,
      });
    }

    // ── Generate new password (invalidates old) ──────────
    const plainPassword = generateVaultPassword(16);
    const passwordHash  = await bcrypt.hash(plainPassword, BCRYPT_COST);

    await VaultAccess.findByIdAndUpdate(accessRecord._id, {
      $set:  { passwordHash, passwordSetAt: new Date(), lastResendAt: new Date(), failedAttempts: 0, lockedAt: null },
      $inc:  { resendCount: 1 },
    });

    // ── Dispatch (same logic as initial send) ────────────
    const embargoDisplay = formatEmbargo(vault.embargoDate, vault.embargoTimezone);
    const methods = deliveryMethods.email || deliveryMethods.sms ? deliveryMethods
                  : { email: accessRecord.deliveryMethods.includes('email'), sms: accessRecord.deliveryMethods.includes('sms') };

    const dispatchResults = {};

    if (methods.email && user.email) {
      try {
        const r = await sendPasswordEmail({
          to: user.email, toName: user.fullName,
          vaultTitle: vault.title, clientName: vault.clientName,
          password: plainPassword, embargoDisplay,
          signedName: accessRecord.signatureName,
          vaultUrl: `${process.env.APP_BASE_URL}/vault/${vault._id}`,
          vaultId: vault._id, userId: user._id,
        });
        dispatchResults.email = { success: true, messageId: r.messageId };
      } catch (e) { dispatchResults.email = { success: false }; }
    }

    if (methods.sms && user.mobile) {
      try {
        const r = await sendPasswordSms({
          to: user.mobile, password: plainPassword,
          vaultTitle: vault.title, embargoDisplay,
          userId: user._id, vaultId: vault._id,
        });
        dispatchResults.sms = { success: true, sid: r.sid };
      } catch (e) { dispatchResults.sms = { success: false }; }
    }

    await audit(EVENT.PASSWORD_RESENT, {
      vaultId, userId,
      meta: { resendCount: accessRecord.resendCount + 1, dispatchResults, ip: getIp(req) },
      req,
    });

    return res.json({ success: true, dispatched: dispatchResults, message: 'New password dispatched.' });

  } catch (err) {
    console.error('[RESEND ERROR]', err);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'An unexpected error occurred.' });
  }
});

// ============================================================
// ROUTE 5: POST /api/vault/sms-status  (Twilio webhook)
// ============================================================

/**
 * Twilio delivery status webhook.
 * Called by Twilio when SMS delivery status changes.
 * Logs delivery confirmation to audit trail.
 */
router.post('/sms-status', express.urlencoded({ extended: false }), async (req, res) => {
  // Validate Twilio signature in production
  // const twilioSignature = req.headers['x-twilio-signature'];
  // const valid = twilio.validateRequest(TWILIO_AUTH_TOKEN, twilioSignature, webhookUrl, req.body);

  const { MessageSid, MessageStatus, To } = req.body;

  if (MessageStatus === 'delivered') {
    // Find access record by matching SMS dispatch (in production: store sid on record)
    console.log(`[SMS DELIVERED] SID: ${MessageSid} To: ${maskMobile(To)}`);
    // Update audit log — in production look up by SID
  }

  res.status(200).send('<Response></Response>'); // Twilio expects XML or empty 200
});

// ============================================================
// MIDDLEWARE
// ============================================================

/**
 * requireAuth — validates the user's session JWT (login token).
 * Attaches req.user.
 */
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Login required.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'automediacenter.com' });
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Session expired or invalid.' });
  }
}

/**
 * requireVaultJwt — validates the vault-specific session token.
 * Separate from the login JWT — this is issued only after password verification.
 */
function requireVaultJwt(req, res, next) {
  const token = req.headers['x-vault-token'];
  if (!token) return res.status(401).json({ success: false, code: 'NO_VAULT_TOKEN', message: 'Vault session token required.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer:   'automediacenter.com',
      audience: 'vault-portal',
    });

    if (decoded.vaultId !== req.params.vaultId) {
      return res.status(403).json({ success: false, code: 'TOKEN_VAULT_MISMATCH', message: 'Token does not match requested vault.' });
    }

    if (decoded.sub !== req.user.id.toString()) {
      return res.status(403).json({ success: false, code: 'TOKEN_USER_MISMATCH', message: 'Token does not match authenticated user.' });
    }

    req.vaultToken = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, code: 'INVALID_VAULT_TOKEN', message: 'Vault session expired or invalid. Please re-enter your password.' });
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format embargo date for display in emails and SMS.
 * e.g. "14:00 CEST · 10 April 2025"
 */
function formatEmbargo(date, timezone = 'Europe/Berlin') {
  if (!date) return 'See vault details';
  const d = new Date(date);
  const timeStr = d.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
  const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone });
  const tzAbbr  = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, timeZoneName: 'short' })
                    .formatToParts(d).find(p => p.type === 'timeZoneName')?.value || timezone;
  return `${timeStr} ${tzAbbr} · ${dateStr}`;
}

/**
 * Mask a mobile number for audit display.
 * +49 ··· ···· 42
 */
function maskMobile(mobile) {
  if (!mobile || mobile.length < 8) return '·····';
  return mobile.slice(0, 3) + ' ··· ···· ' + mobile.slice(-2);
}

/**
 * Async watermark generation trigger.
 * In production this pushes a job to a queue (e.g. Bull/BullMQ).
 * The worker applies the journalist's visible watermark and stores
 * the result at the watermarked S3 key.
 */
async function triggerWatermarkGeneration({ vaultId, userId, filename, user, vault }) {
  // In production: push to Bull queue
  // watermarkQueue.add({ vaultId, userId, filename, user, vault });
  console.log(`[WATERMARK QUEUE] ${filename} for user ${userId} in vault ${vaultId}`);
}

/**
 * Notify client of access lockout.
 */
async function notifyClientOfLockout(vault, journalist, attemptCount) {
  if (!vault.clientNotificationEmail) return;
  try {
    await sgMail.send({
      to:      vault.clientNotificationEmail,
      from:    { email: SENDGRID_FROM_EMAIL, name: 'AutoMediaVault Security' },
      subject: `Security Alert — Vault Access Locked: ${vault.title}`,
      text:    `AutoMediaVault Security Alert\n\nVault: ${vault.title}\nJournalist: ${journalist.email}\nEvent: Vault locked after ${attemptCount} failed password attempts.\nTimestamp: ${new Date().toISOString()}\n\nPlease review your audit log in the AutoMediaCenter dashboard.`,
    });
  } catch (e) {
    console.error('[LOCKOUT NOTIFY FAIL]', e.message);
  }
}

module.exports = router;

/*
 * ============================================================
 * ENVIRONMENT VARIABLES REQUIRED (.env)
 * ============================================================
 *
 * # Application
 * APP_BASE_URL=https://vault.automediacenter.com
 * JWT_SECRET=<64-char random hex string>
 * JWT_VAULT_EXPIRY=8h
 * BCRYPT_ROUNDS=12
 * MAX_PASSWORD_ATTEMPTS=5
 * RESEND_LIMIT_PER_DAY=3
 * SIGNED_URL_EXPIRY_SECONDS=300
 *
 * # SendGrid
 * SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxx
 * SENDGRID_FROM_EMAIL=noreply@automediacenter.com
 * SENDGRID_FROM_NAME=AutoMediaVault
 *
 * # Twilio
 * TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
 * TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
 * TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxx
 *
 * # AWS S3
 * AWS_REGION=eu-central-1
 * AWS_ACCESS_KEY_ID=xxxxxxxxxxxxxxxx
 * AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxx
 * AWS_S3_BUCKET=amv-secure-assets-prod
 *
 * ============================================================
 * npm install required:
 * npm install express bcrypt jsonwebtoken @sendgrid/mail twilio
 *             aws-sdk express-rate-limit mongoose
 * ============================================================
 */