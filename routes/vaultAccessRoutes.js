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
const PDFDocument  = require('pdfkit');
const fs           = require('fs');
const fspath       = require('path');
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
  port:   parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) === 465 : true,
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
    const view      = req.query.view || 'received'; // 'received' | 'sent'

    // Build query based on role and view
    let query;
    if (userRole === 'platform_admin') {
      if (view === 'sent') {
        // Sent: vaults created by this user
        query = { status: 'active', user: userId };
      } else {
        // Received: all active vaults (platform admin sees everything)
        query = { status: 'active' };
      }
    } else if (userRole === 'client_admin' || userRole === 'client_user') {
      if (view === 'sent') {
        // Sent: vaults they created
        query = { status: 'active', user: userId };
      } else {
        // Received: vaults they were invited to
        query = { status: 'active', invitedUsers: userEmail };
      }
    } else {
      // media_user — always received view only
      query = { status: 'active', invitedUsers: userEmail };
    }
    // Fetch vaults matching the role-based query
    const vaults = await VaultAsset.find(query)
      .select('_id vaultAssetUUID title embargoUntil availabilityDate availabilityTime availabilityTimezone requireNDA images videos vaultReleaseDocs supplementaryDocs teaserImage clearanceLevel vaultExpirationDays invitedUsers brand companyName')
      .sort({ createdAt: -1 })
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
        minutesLeft:      access?.lockedAt ? (() => {
          const lockAge = Date.now() - new Date(access.lockedAt).getTime();
          const remaining = Math.ceil((30 * 60 * 1000 - lockAge) / 60000);
          return remaining > 0 ? remaining : 0;
        })() : 0,
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
    const _vaultTz = vault.availabilityTimezone || 'UTC';
    const _tzLabel = vault.embargoUntil ? (() => { try { return new Date(vault.embargoUntil).toLocaleTimeString('en-GB', { timeZone: _vaultTz, timeZoneName: 'short' }).split(' ').pop(); } catch(e) { return 'UTC'; } })() : '';
    const embargoDate = vault.embargoUntil
      ? new Date(vault.embargoUntil).toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: _vaultTz, hour12: false }) + ' ' + _tzLabel
      : 'See vault details';

    // Send password via nodemailer (Gmail SMTP)
    const emailSent = true; // Password delivered in combined NDA email below


    // Generate signed NDA PDF, email journalist and optionally notify creator
    try {
      const _etz = vault.availabilityTimezone || 'UTC';
      const _etzLabel = vault.embargoUntil ? (() => { try { return new Date(vault.embargoUntil).toLocaleTimeString('en-GB', { timeZone: _etz, timeZoneName: 'short' }).split(' ').pop(); } catch(e) { return 'UTC'; } })() : '';
      const embargoStr = vault.embargoUntil
        ? new Date(vault.embargoUntil).toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: _etz, hour12: false }) + ' ' + _etzLabel
        : 'As specified in the vault';

      const signedAtStr = now.toLocaleString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });

      // Generate PDF in memory
      const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header bar
        doc.rect(0, 0, doc.page.width, 80).fill('#1e293b');
        doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold')
           .text('AUTOMEDIACENTER', 50, 28, { characterSpacing: 1.5 });
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
           .text('Non-Disclosure Agreement', 50, 46);
        doc.fillColor('#0f172a');

        doc.moveDown(3.5);
        doc.fontSize(15).font('Helvetica-Bold').fillColor('#0f172a')
           .text('SIGNED NDA CERTIFICATE', { align: 'center' });
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica').fillColor('#64748b')
           .text('This document certifies that the following party has agreed to the Non-Disclosure Agreement', { align: 'center' });
        doc.text('governing access to the Media Vault described below.', { align: 'center' });

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('MEDIA VAULT');
        doc.moveDown(0.3);
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text(vault.title);
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica').fillColor('#dc2626')
           .text('EMBARGO DATE: ' + embargoStr, { font: 'Helvetica-Bold' });
        doc.moveDown(1);

        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('SIGNATORY DETAILS');
        doc.moveDown(0.5);
        const rows = [
          ['Full Name',       signatureName],
          ['Email Address',   userEmail],
          ['Signed At',       signedAtStr],
          ['IP Address',      ip],
          ['Device / Browser', ua.substring(0, 80)],
        ];
        rows.forEach(([label, value]) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text(label + ':');
          doc.fontSize(10).font('Helvetica').fillColor('#0f172a').text(value);
          doc.moveDown(0.4);
        });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('AGREED TERMS');
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(
          '1. CONFIDENTIALITY. The signatory agrees to keep all content accessed through this Media Vault strictly confidential and not to disclose, publish, broadcast, or otherwise make available any content to any third party prior to the embargo date and time specified above.\n\n' +
          '2. EMBARGO. The signatory agrees not to publish, broadcast, or otherwise make public any content from this Media Vault before the embargo date and time. Breach of embargo constitutes a material breach of this agreement.\n\n' +
          '3. PERMITTED USE. Content from this Media Vault may only be used for editorial, journalistic, or media purposes directly related to the subject matter of the vault. Commercial use is prohibited without express written consent.\n\n' +
          '4. WATERMARKING & TRACKING. The signatory acknowledges that all downloaded assets are watermarked with their identity, IP address, and timestamp. All access and download activity is logged as part of an immutable audit record.\n\n' +
          '5. LIABILITY. Breach of this agreement may result in legal action. The signatory accepts full liability for any loss or damage caused by unauthorised disclosure or pre-embargo publication.\n\n' +
          '6. GOVERNING LAW. This agreement is governed by the laws of the jurisdiction in which AutoMediaCenter operates.',
          { lineGap: 3 }
        );

        doc.moveDown(1.5);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('DIGITAL SIGNATURE');
        doc.moveDown(0.5);
        doc.fontSize(20).font('Helvetica-Oblique').fillColor('#1e293b').text(signatureName);
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
           .text('Digitally signed on ' + signedAtStr);
        doc.moveDown(0.2);
        doc.text('Recorded by AutoMediaCenter at IP address ' + ip);

        doc.moveDown(2);
        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
           .text('This document was automatically generated by AutoMediaCenter · automediacenter.com', { align: 'center' });
        doc.text('It constitutes a legally binding record of the NDA signed by the above party.', { align: 'center' });

        doc.end();
      });

      // Save PDF to disk
      const ndaDir = fspath.join(__dirname, '..', 'uploads', 'vault_assets', 'nda_signed');
      if (!fs.existsSync(ndaDir)) fs.mkdirSync(ndaDir, { recursive: true });
      const pdfFilename = 'nda_' + vaultId + '_' + userId + '_' + Date.now() + '.pdf';
      const pdfPath = fspath.join(ndaDir, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);

      // Store PDF path on VaultAccess record
      await VaultAccess.findOneAndUpdate(
        { userId, vaultId },
        { $set: { signedNdaPdfPath: 'uploads/vault_assets/nda_signed/' + pdfFilename } }
      );

      const pdfAttachment = {
        filename: 'NDA_Signed_' + vault.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40) + '.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      };

      // Generate magic link for vault access
      let vaultMagicUrl = process.env.APP_URL + '/automediavault.html';
      try {
        const VaultMagicLink = require('../models/VaultMagicLink');
        const crypto = require('crypto');
        let ml = await VaultMagicLink.findOne({ userId, vaultId, status: 'active', expiresAt: { $gt: new Date() } });
        if (!ml) {
          const tok = crypto.randomBytes(32).toString('hex');
          await VaultMagicLink.create({ token: tok, vaultId, vaultAssetUUID: vault.vaultAssetUUID || vaultId, userId, email: userEmail });
          ml = { token: tok };
        }
        vaultMagicUrl = (process.env.APP_URL || 'http://44.200.25.168:5000') + '/api/v1/vault/access?token=' + ml.token;
      } catch(mlErr) { console.error('[VAULT] Magic link error:', mlErr.message); }

      // Send combined email: NDA confirmation + password + signed PDF
      await mailer.sendMail({
        from: '"AutoMediaVault" <noreply@automediacenter.com>',
        to: userEmail,
        subject: 'NDA signed & vault access — ' + vault.title,
        html: '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:580px;margin:0 auto;">' +
          '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">' +
          '<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">' +
          '<tr><td style="background:#1e293b;padding:28px 36px;">' +
          '<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;">AutoMediaCenter</p>' +
          '<p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Your vault is ready</p>' +
          '</td></tr>' +
          '<tr><td style="padding:32px 36px;">' +
          '<p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">Hi ' + userName + ',</p>' +
          '<p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">Your NDA has been recorded. Use the password below to unlock the vault. Your signed NDA is attached to this email for your records.</p>' +

          // Vault info
          '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">' +
          '<tr><td style="padding:20px 24px;">' +
          '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">MEDIA VAULT</p>' +
          '<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#0f172a;">' + vault.title + '</p>' +
          '<p style="margin:0;font-size:13px;font-weight:600;color:#dc2626;">Embargo: ' + embargoStr + '</p>' +
          '</td></tr></table>' +

          // Password
          '<table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px;text-align:center;">' +
          '<tr><td style="padding:20px 24px;">' +
          '<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#3b82f6;">Media Vault Access Password</p>' +
          '<p style="margin:0;font-size:30px;font-weight:700;letter-spacing:0.12em;color:#0f172a;font-family:Courier New,monospace;">' + plainPassword + '</p>' +
          '</td></tr></table>' +

          // CTA button
          '<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">' +
          '<tr><td style="background:#2563eb;border-radius:8px;">' +
          '<a href="' + vaultMagicUrl + '" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Open Media Vault →</a>' +
          '</td></tr></table>' +

          // Security notice
          '<table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border-left:3px solid #2563eb;border-radius:0 6px 6px 0;margin-bottom:24px;">' +
          '<tr><td style="padding:14px 18px;font-size:12px;color:#1e40af;line-height:1.6;">' +
          'All downloads are watermarked with your identity. The embargo date is legally binding under the NDA you signed. Do not publish before the embargo lifts.' +
          '</td></tr></table>' +

          '<p style="margin:0;font-size:11px;color:#94a3b8;">AutoMediaCenter · automediacenter.com · Do not forward this email.</p>' +
          '</td></tr>' +
          '<tr><td style="padding:16px 36px;border-top:1px solid #f1f5f9;">' +
          '<p style="margin:0;font-size:11px;color:#94a3b8;">Signed NDA attached · ' + signedAtStr + '</p>' +
          '</td></tr>' +
          '</table></td></tr></table></div>',
        attachments: [pdfAttachment]
      });
      console.log('[VAULT] Combined NDA + password email sent to journalist: ' + userEmail);

      // Email PDF to creator if NDA notification enabled
      if (vault.notifyClientOnNda) {
        const creator = await User.findById(vault.user).select('email firstName name').lean();
        if (creator && creator.email) {
          const creatorName = creator.firstName || creator.name || creator.email;
          const journalistName = userName || userEmail;
          await mailer.sendMail({
            from: '"AutoMediaVault" <noreply@automediacenter.com>',
            to: creator.email,
            subject: 'NDA signed — ' + vault.title,
            html: '<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;">' +
              '<div style="background:#1e293b;padding:24px 28px;border-radius:8px 8px 0 0;">' +
              '<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">AutoMediaCenter</p>' +
              '<h1 style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">NDA Signed</h1>' +
              '</div>' +
              '<div style="background:#ffffff;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">' +
              '<p style="margin:0 0 16px;font-size:14px;color:#475569;">Hi ' + creatorName + ',</p>' +
              '<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;"><strong>' + journalistName + '</strong> has signed the NDA for your Media Vault:</p>' +
              '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px 18px;margin:0 0 20px;">' +
              '<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0f172a;">' + vault.title + '</p>' +
              '<p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#dc2626;">Embargo: ' + embargoStr + '</p>' +
              '<p style="margin:0 0 4px;font-size:12px;color:#64748b;">Signed by: ' + journalistName + ' (' + userEmail + ')</p>' +
              '<p style="margin:0 0 4px;font-size:12px;color:#64748b;">Signed at: ' + signedAtStr + '</p>' +
              '<p style="margin:0;font-size:12px;color:#64748b;">IP address: ' + ip + '</p>' +
              '</div>' +
              '<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">The signed NDA PDF is attached to this email for your records. The vault password has been dispatched to the journalist.</p>' +
              '</div></div>',
            attachments: [pdfAttachment]
          });
          console.log('[VAULT] NDA notification + PDF sent to creator: ' + creator.email);
        }
      }

    } catch (pdfErr) {
      console.error('[VAULT] PDF generation/send error:', pdfErr.message);
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

    // Check lockout — auto-unlock after 30 minutes
    if (access.lockedAt) {
      const lockAge = Date.now() - new Date(access.lockedAt).getTime();
      const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
      if (lockAge < LOCK_DURATION_MS) {
        const minutesLeft = Math.ceil((LOCK_DURATION_MS - lockAge) / 60000);
        return res.status(429).json({
          success: false,
          error: `Too many failed attempts. Vault locked for ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'}. Or request a new password below.`,
          locked: true,
          minutesLeft,
          autoUnlockAt: new Date(new Date(access.lockedAt).getTime() + LOCK_DURATION_MS).toISOString()
        });
      }
      // Auto-unlock — 30 minutes have passed
      await VaultAccess.findOneAndUpdate(
        { userId, vaultId },
        { $set: { lockedAt: null, failedAttempts: 0 } }
      );
      access.lockedAt = null;
      access.failedAttempts = 0;
      console.log('[VAULT] Auto-unlocked vault access after 30 min timeout for userId:', userId);
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


// ─────────────────────────────────────────────────────────────
// POST /api/v1/vault/resend-password
// Re-generates and re-sends the vault password to the journalist.
// Only works if journalist has already signed the NDA.
// ─────────────────────────────────────────────────────────────
router.post('/resend-password', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { vaultId } = req.body;

    if (!vaultId) return res.status(400).json({ success: false, error: 'vaultId required' });

    const vault = await VaultAsset.findById(vaultId).lean();
    if (!vault || vault.status !== 'active') {
      return res.status(404).json({ success: false, error: 'Vault not found or not active' });
    }

    const access = await VaultAccess.findOne({ userId, vaultId });
    if (!access || !access.signedAt) {
      return res.status(403).json({ success: false, error: 'NDA not signed for this vault' });
    }

    const user = await User.findById(userId).select('email name firstName lastName').lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const userEmail = user.email;
    const userName  = user.name || user.firstName || userEmail;

    // Generate new password
    const plainPassword = generateVaultPassword();
    const passwordHash  = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);

    await VaultAccess.findOneAndUpdate(
      { userId, vaultId },
      { $set: { passwordHash, passwordSetAt: new Date(), resendCount: (access.resendCount || 0) + 1, lastResendAt: new Date(), lockedAt: null, failedAttempts: 0 } }
    );

    const _rtz = vault.availabilityTimezone || 'UTC';
    const _rtzLabel = vault.embargoUntil ? (() => { try { return new Date(vault.embargoUntil).toLocaleTimeString('en-GB', { timeZone: _rtz, timeZoneName: 'short' }).split(' ').pop(); } catch(e) { return 'UTC'; } })() : '';
    const embargoStr = vault.embargoUntil
      ? new Date(vault.embargoUntil).toLocaleString('en-GB', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone: _rtz, hour12: false }) + ' ' + _rtzLabel
      : 'See vault details';

    // Generate magic link
    let vaultMagicUrl = (process.env.APP_URL || 'http://44.200.25.168:5000') + '/automediavault.html';
    try {
      const VaultMagicLink = require('../models/VaultMagicLink');
      const crypto = require('crypto');
      let ml = await VaultMagicLink.findOne({ userId, vaultId, status: 'active', expiresAt: { $gt: new Date() } });
      if (!ml) {
        const tok = crypto.randomBytes(32).toString('hex');
        await VaultMagicLink.create({ token: tok, vaultId, vaultAssetUUID: vault.vaultAssetUUID || vaultId, userId, email: userEmail });
        ml = { token: tok };
      }
      vaultMagicUrl = (process.env.APP_URL || 'http://44.200.25.168:5000') + '/api/v1/vault/access?token=' + ml.token;
    } catch(mlErr) { console.error('[RESEND] Magic link error:', mlErr.message); }

    await mailer.sendMail({
      from: `"${FROM_NAME}" <noreply@automediacenter.com>`,
      to: userEmail,
      subject: `Your new vault password — ${vault.title}`,
      html: '<div style="font-family:-apple-system,sans-serif;max-width:580px;margin:0 auto;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">' +
        '<table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">' +
        '<tr><td style="background:#0f172a;padding:24px 32px;">' +
        '<p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.06em;color:#64748b;">AutoMediaCenter</p>' +
        '<p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.02em;">New Media Vault Password</p>' +
        '</td></tr>' +
        '<tr><td style="padding:32px 36px;">' +
        '<p style="margin:0 0 20px;font-size:15px;color:#334155;">Hi ' + userName + ',</p>' +
        '<p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">Here is your new password for the vault below. Your previous password has been invalidated.</p>' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">' +
        '<tr><td style="padding:16px 20px;">' +
        '<p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">MEDIA VAULT</p>' +
        '<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">' + vault.title + '</p>' +
        '<p style="margin:0;font-size:13px;font-weight:600;color:#dc2626;">Embargo: ' + embargoStr + '</p>' +
        '</td></tr></table>' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px;text-align:center;">' +
        '<tr><td style="padding:20px 24px;">' +
        '<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#3b82f6;">New Media Vault Access Password</p>' +
        '<p style="margin:0;font-size:30px;font-weight:700;letter-spacing:0.12em;color:#0f172a;font-family:Courier New,monospace;">' + plainPassword + '</p>' +
        '</td></tr></table>' +
        '<table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">' +
        '<tr><td style="background:#2563eb;border-radius:8px;">' +
        '<a href="' + vaultMagicUrl + '" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Open Media Vault →</a>' +
        '</td></tr></table>' +
        '<p style="margin:0;font-size:11px;color:#94a3b8;">AutoMediaCenter · automediacenter.com · Do not forward this email.</p>' +
        '</td></tr></table></td></tr></table></div>'
    });

    console.log('[VAULT] Password resent to:', userEmail, 'for vault:', vault.title);
    res.json({ success: true, message: 'New password sent to your email.' });

  } catch (err) {
    console.error('[VAULT] Resend password error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to resend password' });
  }
});

module.exports = router;