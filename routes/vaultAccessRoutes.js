// routes/vaultAccessRoutes.js
//
// Handles the journalist-facing vault access flow:
//   GET  /api/v1/vault/my-vaults   → fetch vaults assigned to this journalist
//   POST /api/v1/vault/nda-sign    → sign NDA, generate + dispatch password
//   POST /api/v1/vault/unlock      → verify password, issue vault JWT
//
// Mount in server.js alongside existing vaultRoutes:
//   const vaultAccessRoutes = require('./routes/vaultAccessRoutes');
//   app.use('/api/v1/vault', vaultAccessRoutes);
//
// Dependencies — already in your .env:
//   JWT_SECRET          (already used by your auth system)
//   JWT_VAULT_EXPIRY    e.g. 8h
//   SMTP_HOST           e.g. smtp.gmail.com
//   SMTP_PORT           e.g. 587
//   SMTP_USER           e.g. gregkable@gmail.com
//   SMTP_PASS           your Gmail app password
//   SENDGRID_FROM_NAME  e.g. AutoMediaVault  (display name only)
//   MAX_PWD_ATTEMPTS    e.g. 5  (default 5)

'use strict';

const express      = require('express');
const router       = express.Router();
const crypto       = require('crypto');
const bcrypt       = require('bcrypt');
const jwt          = require('jsonwebtoken');
const nodemailer   = require('nodemailer');
const { authenticate } = require('../middleware/authMiddleware');
const VaultAsset   = require('../models/VaultAsset');
const VaultAccess  = require('../models/VaultAccess');
const VaultAuditLog = require('../models/VaultAuditLog');
const User         = require('../models/User');

// ── Config ────────────────────────────────────────────────────
const BCRYPT_ROUNDS  = 12;
const JWT_EXPIRY     = process.env.JWT_VAULT_EXPIRY || '8h';
const MAX_ATTEMPTS   = parseInt(process.env.MAX_PWD_ATTEMPTS) || 5;
const FROM_NAME      = process.env.SENDGRID_FROM_NAME || 'AutoMediaVault';

// Reuse your existing Gmail SMTP transport
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── Helpers ───────────────────────────────────────────────────

/**
 * Cryptographically secure alphanumeric password.
 * 14 chars — strong enough, short enough to type from SMS.
 * Excludes visually ambiguous characters: 0/O, 1/l/I.
 */
function generateVaultPassword(length = 14) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const bytes = crypto.randomBytes(length * 3);
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    const idx = bytes[i] % chars.length;
    if (bytes[i] < Math.floor(256 / chars.length) * chars.length) {
      result += chars[idx];
    }
  }
  while (result.length < length) {
    result += chars[crypto.randomInt(chars.length)];
  }
  return result;
}

/** Get real client IP behind proxy */
function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

/** Write immutable audit entry — never throws, failure logged to stderr */
async function audit(event, { vaultId, userId, meta = {}, req } = {}) {
  try {
    await VaultAuditLog.create({
      event, vaultId, userId, meta,
      ip: req ? getIp(req) : meta.ip,
      ua: req?.headers?.['user-agent'],
    });
  } catch (err) {
    console.error('[VAULT_AUDIT_FAIL]', event, err.message);
  }
}

/**
 * Determine the journalist's access state for a given vault.
 * Returns: 'nda' | 'ready' | 'open' | 'pending'
 */
function resolveCardState(vault, access) {
  const now = new Date();

  // Vault not yet open
  const opensDt = buildOpenDatetime(vault);
  if (opensDt && opensDt > now) return 'pending';

  // No access record at all — NDA required or just not started
  if (!access) return vault.requireNDA ? 'nda' : 'ready';

  // Has an access record
  if (access.accessGranted) return 'open';
  if (access.passwordHash)  return 'ready';   // NDA signed, password sent
  return 'nda';                               // started but not signed yet
}

/** Build a JS Date from vault's availabilityDate + availabilityTime + timezone */
function buildOpenDatetime(vault) {
  if (!vault.availabilityDate) return null;
  try {
    const dateStr = vault.availabilityDate.toISOString().split('T')[0];
    const timeStr = vault.availabilityTime || '00:00';
    // Parse as UTC then note: this is approximate without full tz library.
    // For production, replace with date-fns-tz or luxon.
    return new Date(`${dateStr}T${timeStr}:00Z`);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/vault/my-vaults
// Returns vaults the authenticated user is permitted to see:
//   - media_user: only vaults where their email is in invitedUsers
//   - client_admin / platform_admin: vaults they created (by userId)
// ─────────────────────────────────────────────────────────────
router.get('/my-vaults', authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const userRole = req.user.role || '';

    // Get user's email for journalist filtering
    const user = await User.findById(userId).select('email').lean();
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    const userEmail = user.email;

    // Build query based on role
    let query;
    if (userRole === 'platform_admin') {
      // Platform admin sees all active vaults
      query = { status: 'active' };
    } else if (userRole === 'client_admin' || userRole === 'client_user') {
      // Client admin/user sees vaults they created
      query = { status: 'active', user: userId };
    } else {
      // media_user — only vaults they were explicitly invited to
      query = { status: 'active', invitedUsers: userEmail };
    }
    // Fetch vaults matching the role-based query
    const vaults = await VaultAsset.find(query)
      .select('_id vaultAssetUUID title embargoUntil availabilityDate availabilityTime availabilityTimezone requireNDA images videos vaultReleaseDocs supplementaryDocs teaserImage clearanceLevel vaultExpirationDays invitedUsers brand companyName')
      .lean();

    if (!vaults.length) {
      return res.json({ success: true, data: [] });
    }

    // Fetch all access records for this user in one query
    const vaultIds = vaults.map(v => v._id);
    const accessRecords = await VaultAccess.find({
      userId,
      vaultId: { $in: vaultIds }
    }).lean();

    // Index access records by vaultId for O(1) lookup
    const accessMap = {};
    accessRecords.forEach(a => { accessMap[a.vaultId.toString()] = a; });

    // Shape response for frontend card renderer
    const data = vaults.map(vault => {
      const access = accessMap[vault._id.toString()] || null;
      const state  = resolveCardState(vault, access);
      const opensDt = buildOpenDatetime(vault);

      return {
        _id:           vault._id,
        uuid:          vault.vaultAssetUUID,
        title:         vault.title,
        embargoUntil:  vault.embargoUntil,
        vaultOpens:    opensDt,
        requireNDA:    vault.requireNDA,
        assetCounts: {
          images: vault.images?.length       || 0,
          videos: vault.videos?.length       || 0,
          docs:   (vault.vaultReleaseDocs?.length || 0)
                + (vault.supplementaryDocs?.length || 0),
        },
        teaserImage: vault.teaserImage?.path || null,
        brand:       vault.brand       || null,
        companyName: vault.companyName || null,
        timezone:    vault.availabilityTimezone || 'Europe/Berlin',
        state,
        // Access-state details the frontend card needs
        ndaSignedAt:      access?.signedAt        || null,
        lastAccessedAt:   access?.lastAccessedAt  || null,
        accessGrantedAt:  access?.accessGrantedAt || null,
        isLocked:         access?.lockedAt ? true : false,
      };
    });

    res.json({ success: true, data });

  } catch (err) {
    console.error('[VAULT] GET /my-vaults error:', err);
    res.status(500).json({ success: false, error: 'Failed to load vaults' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/vault/nda-sign
// Body: { vaultId, signatureName, deliveryMethods: ['email'] }
// Signs the NDA, generates a password, dispatches via SendGrid.
// ─────────────────────────────────────────────────────────────
router.post('/nda-sign', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { vaultId, signatureName, deliveryMethods = ['email'] } = req.body;

    if (!vaultId || !signatureName || signatureName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'vaultId and signatureName are required' });
    }

    // Validate vault exists and is active
    const vault = await VaultAsset.findById(vaultId).lean();
    if (!vault || vault.status !== 'active') {
      return res.status(404).json({ success: false, error: 'Vault not found or not active' });
    }

    // Fetch journalist details for email
    const user = await User.findById(userId).select('email name firstName lastName').lean();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const userEmail = user.email;
    const userName  = user.name || user.firstName || userEmail;

    // Check for existing access record — prevent re-signing
    let access = await VaultAccess.findOne({ userId, vaultId });
    if (access?.accessGranted) {
      return res.json({ success: true, alreadyGranted: true, message: 'Access already granted' });
    }

    // Generate and hash password
    const plainPassword = generateVaultPassword();
    const passwordHash  = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

    const now = new Date();
    const ip  = getIp(req);
    const ua  = req.headers['user-agent'] || '';

    // Upsert access record
    access = await VaultAccess.findOneAndUpdate(
      { userId, vaultId },
      {
        $set: {
          signatureName:   signatureName.trim(),
          signedAt:        now,
          signingIp:       ip,
          signingDevice:   ua.substring(0, 200),
          passwordHash,
          passwordSetAt:   now,
          deliveryMethods: Array.isArray(deliveryMethods) ? deliveryMethods : ['email'],
          emailDispatchedAt: null,
          accessGranted:   false,
          failedAttempts:  0,
          lockedAt:        null,
        }
      },
      { upsert: true, new: true }
    );

    // Audit: NDA signed
    await audit(VaultAuditLog.EVENTS.NDA_SIGNED, {
      vaultId, userId,
      meta: { signatureName: signatureName.trim(), ip, ua: ua.substring(0, 200) },
      req
    });

    // Format embargo datetime for email
    const embargoDate = vault.embargoUntil
      ? new Date(vault.embargoUntil).toLocaleString('en-GB', {
          day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        })
      : 'See vault details';

    // Send password via nodemailer (Gmail SMTP)
    let emailSent = false;
    if (deliveryMethods.includes('email') && process.env.SMTP_USER) {
      try {
        await mailer.sendMail({
          to:      userEmail,
          from:    `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
          subject: `Your vault access password — ${vault.title}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
              <div style="background: #ffd000; padding: 24px 28px 20px; border-radius: 8px 8px 0 0;">
                <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(0,0,0,0.6);">AutoMediaVault</p>
                <h1 style="margin: 6px 0 0; font-size: 22px; font-weight: 800; color: rgba(0,0,0,0.75);">Your vault is ready</h1>
              </div>
              <div style="background: #ffffff; padding: 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">Hi ${userName},</p>
                <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                  Your NDA has been recorded for <strong>${vault.title}</strong>. Use the password below to unlock the vault.
                </p>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px 20px; margin: 0 0 20px; text-align: center;">
                  <p style="margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8;">Vault Access Password</p>
                  <p style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.12em; color: #0f172a; font-family: 'Courier New', monospace;">${plainPassword}</p>
                </div>

                <div style="background: #fef2f2; border-left: 3px solid #dc2626; padding: 10px 14px; border-radius: 0 4px 4px 0; margin: 0 0 20px;">
                  <p style="margin: 0; font-size: 12px; font-weight: 700; color: #dc2626;">
                    ⚠ Do not publish before: ${embargoDate}
                  </p>
                </div>

                <p style="margin: 0 0 6px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  By accessing this vault you confirm your agreement to the NDA signed on ${now.toUTCString()}.
                  All downloads are logged, watermarked, and traceable.
                </p>
                <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                  AutoMediaVault · automediacenter.com · Do not forward this email.
                </p>
              </div>
            </div>
          `
        });
        emailSent = true;
        await VaultAccess.findOneAndUpdate(
          { userId, vaultId },
          { $set: { emailDispatchedAt: new Date() } }
        );
        await audit(VaultAuditLog.EVENTS.PASSWORD_DISPATCHED, {
          vaultId, userId,
          meta: { method: 'email', to: userEmail },
          req
        });
      } catch (emailErr) {
        console.error('[VAULT] Email error:', emailErr.message);
        // Don't fail the request — password is set, email failed silently
      }
    }

    res.json({
      success: true,
      message: emailSent
        ? 'NDA recorded. Password dispatched to your email.'
        : 'NDA recorded. Password dispatch pending — check your email shortly.',
      emailSent,
    });

  } catch (err) {
    console.error('[VAULT] POST /nda-sign error:', err);
    res.status(500).json({ success: false, error: 'Failed to process NDA signing' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/vault/unlock
// Body: { vaultId, password }
// Verifies password, issues vault-specific JWT.
// ─────────────────────────────────────────────────────────────
router.post('/unlock', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { vaultId, password } = req.body;

    if (!vaultId || !password) {
      return res.status(400).json({ success: false, error: 'vaultId and password are required' });
    }

    const access = await VaultAccess.findOne({ userId, vaultId });

    if (!access || !access.passwordHash) {
      return res.status(403).json({ success: false, error: 'No access record found. Please sign the NDA first.' });
    }

    // Check lockout
    if (access.lockedAt) {
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. This vault has been locked. Contact support.',
        locked: true
      });
    }

    const valid = await bcrypt.compare(password, access.passwordHash);

    if (!valid) {
      const newAttempts = (access.failedAttempts || 0) + 1;
      const shouldLock  = newAttempts >= MAX_ATTEMPTS;

      await VaultAccess.findOneAndUpdate(
        { userId, vaultId },
        {
          $set: {
            failedAttempts: newAttempts,
            ...(shouldLock ? { lockedAt: new Date() } : {})
          }
        }
      );

      await audit(VaultAuditLog.EVENTS.FAILED_ATTEMPT, {
        vaultId, userId,
        meta: { attempt: newAttempts, locked: shouldLock },
        req
      });

      if (shouldLock) {
        await audit(VaultAuditLog.EVENTS.VAULT_LOCKED, { vaultId, userId, req });
        return res.status(429).json({
          success: false,
          error: 'Too many failed attempts. Vault locked.',
          locked: true
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Incorrect password.',
        attemptsRemaining: MAX_ATTEMPTS - newAttempts
      });
    }

    // Password correct — grant access
    const now = new Date();
    await VaultAccess.findOneAndUpdate(
      { userId, vaultId },
      {
        $set: {
          accessGranted:    true,
          accessGrantedAt:  now,
          lastAccessedAt:   now,
          failedAttempts:   0,
          lockedAt:         null,
        }
      }
    );

    // Issue vault-specific JWT
    const vaultToken = jwt.sign(
      { userId, vaultId, type: 'vault_access' },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    await audit(VaultAuditLog.EVENTS.VAULT_UNLOCKED, { vaultId, userId, req });

    res.json({
      success: true,
      vaultToken,
      message: 'Vault unlocked successfully'
    });

  } catch (err) {
    console.error('[VAULT] POST /unlock error:', err);
    res.status(500).json({ success: false, error: 'Failed to unlock vault' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/vault/:vaultId/assets
// Returns vault metadata + asset list for an unlocked vault.
// Requires accessGranted: true in vault_access.
// ─────────────────────────────────────────────────────────────
router.get('/:vaultId/assets', authenticate, async (req, res) => {
  try {
    const userId  = req.user.id;
    const { vaultId } = req.params;

    // Confirm access granted
    const access = await VaultAccess.findOne({ userId, vaultId }).lean();
    if (!access || !access.accessGranted) {
      return res.status(403).json({ success: false, error: 'Access not granted for this vault' });
    }

    // Fetch vault
    const vault = await VaultAsset.findById(vaultId)
      .select('title embargoUntil availabilityTimezone images videos vaultReleaseDocs supplementaryDocs teaserImage vaultExpirationDays watermarkEnabled companyName brand')
      .lean();

    if (!vault) {
      return res.status(404).json({ success: false, error: 'Vault not found' });
    }

    // Update last accessed time
    await VaultAccess.findOneAndUpdate(
      { userId, vaultId },
      { $set: { lastAccessedAt: new Date() } }
    );

    // Audit access
    await audit(VaultAuditLog.EVENTS.VAULT_ACCESSED, { vaultId, userId, req });

    // Format file size helper
    const fmtSize = bytes => bytes > 1048576
      ? (bytes / 1048576).toFixed(1) + ' MB'
      : (bytes / 1024).toFixed(0) + ' KB';

    // Clean display name — strip Multer timestamp prefix (e.g. 1773494040754-663677450_)
    // Pattern: one or more digits, dash, one or more digits, underscore at start
    const cleanName = raw => {
      if (!raw) return raw;
      return raw.replace(/^\d+-\d+_/, '');
    };

    // Build public URL for a stored path
    // Files are at: uploads/vault_assets/filename
    // Served via: /uploads/vault_assets/filename
    const toUrl = path => path ? '/' + path.replace(/\\/g, '/') : null;

    res.json({
      success: true,
      data: {
        vaultId,
        title:         vault.title,
        embargoUntil:  vault.embargoUntil,
        timezone:      vault.availabilityTimezone,
        watermarked:   vault.watermarkEnabled,
        companyName:   vault.companyName,
        brand:         vault.brand,
        documents: [
          ...(vault.vaultReleaseDocs || []).map(f => ({
            name: cleanName(f.originalName),
            url:  toUrl(f.path),
            size: fmtSize(f.size),
            mime: f.mimetype,
            type: 'doc'
          })),
          ...(vault.supplementaryDocs || []).map(f => ({
            name: cleanName(f.originalName),
            url:  toUrl(f.path),
            size: fmtSize(f.size),
            mime: f.mimetype,
            type: 'doc'
          }))
        ],
        images: (vault.images || []).map(f => ({
          name: cleanName(f.originalName),
          url:  toUrl(f.path),
          size: fmtSize(f.size),
          mime: f.mimetype
        })),
        videos: (vault.videos || []).map(f => ({
          name: cleanName(f.originalName),
          url:  toUrl(f.path),
          size: fmtSize(f.size),
          mime: f.mimetype
        }))
      }
    });

  } catch (err) {
    console.error('[VAULT] GET /assets error:', err);
    res.status(500).json({ success: false, error: 'Failed to load vault assets' });
  }
});

module.exports = router;