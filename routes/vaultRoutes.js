// File: routes/vaultRoutes.js

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const VaultAsset = require('../models/VaultAsset');
const VaultAccess     = require('../models/VaultAccess');
const VaultMagicLink  = require('../models/VaultMagicLink');
const User = require('../models/User');
const Notification = require('../models/Notification');
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// ── Email transport (reuses existing Gmail SMTP config) ───────
const mailer = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) === 465 : true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'AutoMediaVault';

// ── Format embargo datetime with timezone ────────────────────
function fmtEmbargoEmail(dateStr, tz) {
    const dt = new Date(dateStr);
    if (!dt || isNaN(dt)) return 'See Media Vault for details';
    const safeTz = tz || 'Europe/Berlin';
    const tzLabel = dt.toLocaleTimeString('en-GB', { timeZone: safeTz, timeZoneName: 'short' }).split(' ').pop();
    const formatted = dt.toLocaleString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: safeTz, hour12: false
    });
    return `${formatted} ${tzLabel}`;
}


// ── Generate or retrieve magic link token for journalist ─────
async function getOrCreateMagicLink(userId, vaultId, vaultAssetUUID, email) {
  // Check for existing active token
  let existing = await VaultMagicLink.findOne({
    userId, vaultId, status: 'active', expiresAt: { $gt: new Date() }
  });
  if (existing) return existing.token;
  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  await VaultMagicLink.create({ token, vaultId, vaultAssetUUID, userId, email });
  return token;
}

// ── Send Media Vault invitation email ────────────────────────
async function sendVaultInvitationEmail({ toEmail, toName, senderCompany, vaultTitle, embargoUntil, timezone, vaultId, magicToken }) {
    if (!process.env.SMTP_USER) {
        console.warn('[VAULT INVITE] SMTP not configured — skipping invitation email');
        return false;
    }

    const embargoStr  = fmtEmbargoEmail(embargoUntil, timezone);
    const baseUrl     = process.env.APP_URL || 'http://44.200.25.168:5000';
    const vaultUrl    = magicToken
      ? `${baseUrl}/api/v1/vault/access?token=${magicToken}`
      : `${baseUrl}/automediavault.html`;
    const recipientName = toName ? `Hi ${toName.split(' ')[0]},` : 'Hi,';
    const senderLabel = senderCompany || 'A media client';

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
          <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.02em;">You have been sent a Media Vault</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 36px;">
          <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">${recipientName}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
            <strong>${senderLabel}</strong> has sent you a Media Vault.
          </p>

          <!-- Media Vault info card -->
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

          <!-- What to do next -->
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">What to do next</p>
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="padding:4px 0;font-size:14px;color:#475569;"><span style="color:#2563eb;font-weight:700;margin-right:8px;">1.</span>Log in to AutoMediaCenter</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#475569;"><span style="color:#2563eb;font-weight:700;margin-right:8px;">2.</span>Navigate to Media Vault</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#475569;"><span style="color:#2563eb;font-weight:700;margin-right:8px;">3.</span>Sign the Non-Disclosure Agreement</td></tr>
            <tr><td style="padding:4px 0;font-size:14px;color:#475569;"><span style="color:#2563eb;font-weight:700;margin-right:8px;">4.</span>Receive your vault password and access the embargoed assets</td></tr>
          </table>

          <!-- CTA button -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#2563eb;border-radius:8px;">
              <a href="${vaultUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">View Media Vault &amp; Sign NDA →</a>
            </td></tr>
          </table>

          <!-- Security notice -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;margin-bottom:8px;">
            <tr><td style="padding:14px 18px;font-size:12px;color:#1e40af;line-height:1.6;">
              All downloads from this Media Vault are watermarked with your journalist identity. The embargo date is legally binding under the NDA you will sign.
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 36px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
            AutoMediaCenter · <a href="https://automediaaenter.com" style="color:#94a3b8;">automediaaenter.com</a><br>
            This invitation was sent because your email address was added to a Media Vault distribution list. Do not forward this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `You have been sent a Media Vault by ${senderLabel}\n\nMedia Vault: ${vaultTitle}\nDo not publish before: ${embargoStr}\n\nTo access the Media Vault, sign the NDA and receive your access password:\n${vaultUrl}\n\nAll downloads are watermarked and logged. The embargo date is legally binding under the NDA.\n\nAutoMediaVault`;

    try {
        await mailer.sendMail({
            from:    `"${FROM_NAME}" <noreply@automediacenter.com>`,
            to:      toEmail,
            subject: `You have been sent a Media Vault by ${senderLabel}`,
            html,
            text
        });
        console.log(`[VAULT INVITE] ✅ Invitation email sent to ${toEmail} for Media Vault: "${vaultTitle}"`);
        return true;
    } catch (err) {
        console.error(`[VAULT INVITE] ❌ Failed to send invitation to ${toEmail}:`, err.message);
        return false;
    }
}

// --- Define Zod Schema for Vault Asset input validation (for req.body text fields) ---
const createVaultAssetSchema = z.object({
    vaultAssetUUID: z.string().uuid({ message: "Invalid Vault Asset UUID format." }),
    title: z.string().min(1, { message: "Vault Name is required." }).max(200),
    brand: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    internalDescription: z.string().optional().nullable(),
    availabilityDate: z.string().refine((dateStr) => !isNaN(new Date(dateStr).getTime()), { message: "Invalid availability date." }),
    availabilityTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Invalid availability time format. Use HH:MM." }),
    availabilityTimezone: z.string().min(1, { message: "Availability timezone is required." }),
    embargoUntil: z.string().refine((dateTimeStr) => !isNaN(new Date(dateTimeStr).getTime()), { message: "Invalid embargo date/time." }),

    requireNDA: z.preprocess(val => String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'yes', z.boolean()).optional().default(false),
    notifyClientOnAccess: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),
    notifyClientOnDownload: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),
    notifyClientOnNda: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),
    watermark: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),
    geoLock: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),
    requireMfaOnAccess: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),

    vaultLegalTermsAck: z.preprocess(val => String(val).toLowerCase() === 'agreed', z.boolean()).optional().default(false),

    clearanceLevel: z.enum(['restricted', 'private', 'global'], { message: "Invalid clearance level." }),
    distributionMethod: z.enum(['notify', 'manual']).optional().default('notify'),
    customNotificationMessage: z.string().optional().nullable(),

    vaultExpirationDays: z.string().optional().refine(val => val === 'never' || (val && /^\d+$/.test(val)), { message: "Invalid expiration value."})
                          .transform(val => {
                              if (val === 'never') return null;
                              if (val && /^\d+$/.test(val)) return parseInt(val, 10);
                              return (val === undefined || val === '') ? 7 : parseInt(val, 10);
                          }).default("7"),

    action: z.enum(['draft', 'publish'], { message: "Invalid action specified." }),
    // vaultPassword: z.string().optional().nullable() // Password field removed from Zod for this state

    invitedUsers: z.array(z.string().email({ message: "Invalid email format in invited users list." })).optional().default([])
});


// --- Multer Configuration ---
const vaultUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'vault_assets');
try {
  if (!fs.existsSync(vaultUploadDir)) {
    fs.mkdirSync(vaultUploadDir, { recursive: true });
    console.log(`Vault upload directory created: ${vaultUploadDir}`);
  } else {
    // console.log(`Vault upload directory already exists: ${vaultUploadDir}`);
  }
} catch (err) {
  console.error("FATAL ERROR: Could not ensure vault upload directory exists.", err);
}
const vaultStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, vaultUploadDir); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const decodedOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safeOriginalName = decodedOriginalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalFilename = uniqueSuffix + '_' + safeOriginalName;
    cb(null, finalFilename);
  }
});
const vaultUpload = multer({
  storage: vaultStorage,
  limits: { fileSize: 1024 * 1024 * 200, files: 80 },
  fileFilter: function (req, file, cb) { cb(null, true); }
}).fields([
    { name: 'teaserImage', maxCount: 1 }, { name: 'ndaDocument', maxCount: 1 },
    { name: 'vaultReleaseDocs', maxCount: 20 }, { name: 'vaultImages', maxCount: 50 },
    { name: 'vaultVideos', maxCount: 10 }, { name: 'vaultSupplementaryDocs', maxCount: 20 }
]);
const handleVaultMulterUpload = (req, res, next) => {
    vaultUpload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('[VAULT_MULTER_ERROR] Multer Error:', err);
            let message = `Vault file upload error: ${err.message}`;
            if (err.code === 'LIMIT_FILE_SIZE') message = 'File too large (Max 200MB).';
            else if (err.code === 'LIMIT_FILE_COUNT') message = 'Too many files for the request or a category.';
            else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = `Unexpected file field: '${err.field}'.`;
            return res.status(400).json({ success: false, error: message, code: err.code });
        } else if (err) {
            console.error('[VAULT_UPLOAD_ERROR] Non-Multer Upload Error:', err);
            return res.status(500).json({ success: false, error: err.message || 'Unknown error during vault file upload.' });
        }
        next();
    });
};

// --- Route to CREATE a new Vault Asset ---
router.post('/assets', handleVaultMulterUpload, authenticate, async (req, res) => {
    console.log('Backend received POST /api/v1/vault/assets (Password functionality removed, invitedUsers processing, detailed JSON response)');
    console.log('🏷️  BRAND DEBUG → req.body.brand:', JSON.stringify(req.body.brand), '| req.body.companyName:', JSON.stringify(req.body.companyName));
    
    const successfullyUploadedPaths = [];
     if (req.files) {
        Object.values(req.files).forEach(fieldArray => {
            fieldArray.forEach(file => successfullyUploadedPaths.push(file.path));
        });
    }

    try {
        const validationResult = createVaultAssetSchema.safeParse(req.body);
        if (!validationResult.success) {
            console.error('Vault Asset text data validation failed (Zod):', validationResult.error.flatten().fieldErrors);
            await cleanupFiles(successfullyUploadedPaths, 'Zod Validation Error');
            return res.status(400).json({
                success: false,
                error: 'Invalid input data for Vault Asset.',
                details: validationResult.error.flatten().fieldErrors
            });
        }
        const validatedTextData = validationResult.data;
        const userId = req.user.id;

        const processFileField = (fileFieldArray) => {
            if (!fileFieldArray || fileFieldArray.length === 0) return [];
            return fileFieldArray.map(file => ({
                originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
                path: path.join('uploads', 'vault_assets', file.filename).replace(/\\/g, '/'),
                mimetype: file.mimetype, size: file.size
            }));
        };
        const processSingleFile = (fileFieldArray) => {
            if (fileFieldArray && fileFieldArray.length > 0) {
                const file = fileFieldArray[0];
                 return {
                    originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
                    path: path.join('uploads', 'vault_assets', file.filename).replace(/\\/g, '/'),
                    mimetype: file.mimetype, size: file.size
                };
            } return null;
        };

        const releaseDocFiles = processFileField(req.files?.vaultReleaseDocs);
        const imageFiles = processFileField(req.files?.vaultImages);
        const videoFiles = processFileField(req.files?.vaultVideos);
        const supplementaryDocFiles = processFileField(req.files?.vaultSupplementaryDocs);
        const teaserImageInfo = processSingleFile(req.files?.teaserImage);
        const ndaDocumentInfo = processSingleFile(req.files?.ndaDocument);

        const invitedEmails = validatedTextData.invitedUsers || [];

        const vaultDataForDb = {
            vaultAssetUUID: validatedTextData.vaultAssetUUID,
            title: validatedTextData.title,
            brand: validatedTextData.brand || null,
            companyName: validatedTextData.companyName || null,
            internalDescription: validatedTextData.internalDescription,
            user: userId,
            availabilityDate: new Date(validatedTextData.availabilityDate),
            availabilityTime: validatedTextData.availabilityTime,
            availabilityTimezone: validatedTextData.availabilityTimezone,
            embargoUntil: new Date(validatedTextData.embargoUntil),
            requireNDA: validatedTextData.requireNDA,
            clearanceLevel: validatedTextData.clearanceLevel,
            vaultReleaseDocs: releaseDocFiles, images: imageFiles, videos: videoFiles, supplementaryDocs: supplementaryDocFiles,
            teaserImage: teaserImageInfo, ndaDocument: ndaDocumentInfo,
            notifyClientOnAccess: validatedTextData.notifyClientOnAccess,
            notifyClientOnDownload: validatedTextData.notifyClientOnDownload,
            notifyClientOnNda: validatedTextData.notifyClientOnNda,
            vaultExpirationDays: validatedTextData.vaultExpirationDays,
            watermarkEnabled: validatedTextData.watermark,
            geoLockEnabled: validatedTextData.geoLock,
            requireMfaOnAccess: validatedTextData.requireMfaOnAccess,
            vaultLegalTermsAcknowledged: validatedTextData.vaultLegalTermsAck,
            invitedUsers: invitedEmails,  // ← SAVE invited journalist emails
            status: validatedTextData.action === 'publish' ? 'active' : 'draft'
            // vaultPassword field intentionally omitted
        };

        console.log('🏷️  BRAND IN DB OBJECT → brand:', JSON.stringify(vaultDataForDb.brand), '| companyName:', JSON.stringify(vaultDataForDb.companyName));

        if (vaultDataForDb.requireNDA && !vaultDataForDb.ndaDocument) {
            console.error('NDA required but no document uploaded.');
            await cleanupFiles(successfullyUploadedPaths, 'NDA Missing');
            return res.status(400).json({
                success: false, error: 'NDA document is mandatory when "Require NDA" is checked.',
                details: { ndaDocument: ['NDA document is required.'] }
            });
        }

        console.log("Attempting VaultAsset.create() (password functionality is disabled in model)...");
        const newVaultAsset = await VaultAsset.create(vaultDataForDb);
        console.log(`VaultAsset saved to DB with _id: ${newVaultAsset._id}`);

        if (invitedEmails.length > 0 && validatedTextData.action === 'publish') {
            console.log(`INFO: Vault published with ${invitedEmails.length} invited journalist(s) saved to DB:`, invitedEmails);

            // ── Create in-app notifications for all invited journalists ──
            const notificationPromises = invitedEmails.map(async (email) => {
                try {
                    const journalist = await User.findOne({ email }).select('_id').lean();
                    if (!journalist) return; // only create for registered users
                    await Notification.create({
                        userId:               journalist._id,
                        type:                 'vault_invite',
                        brand:                newVaultAsset.brand,
                        companyName:          newVaultAsset.companyName,
                        vaultTitle:           newVaultAsset.title,
                        vaultId:              newVaultAsset._id,
                        embargoUntil:         newVaultAsset.embargoUntil,
                        availabilityTimezone: newVaultAsset.availabilityTimezone,
                    });
                    console.log(`[NOTIFICATION] ✅ Created notification for ${email}`);
                } catch (e) {
                    console.error(`[NOTIFICATION] ❌ Failed for ${email}:`, e.message);
                }
            });

            // ── Send invitation emails to all invited journalists ──
            // Fire-and-forget — don't hold the HTTP response
    const senderCompany = validatedTextData.brand || validatedTextData.companyName || 'A media client';
            const emailPromises = invitedEmails.map(async (email) => {
                // Try to get the journalist's name from User model for personalisation
                let toName = null;
                try {
                    const journalist = await User.findOne({ email }).select('firstName lastName name').lean();
                    if (journalist) {
                        toName = journalist.firstName
                            ? `${journalist.firstName} ${journalist.lastName || ''}`.trim()
                            : journalist.name || null;
                    }
                } catch (e) { /* non-fatal */ }

                // Generate magic link token for this journalist
                let magicToken = null;
                try {
                  const journalistUser = await User.findOne({ email: email.toLowerCase() }).select('_id').lean();
                  if (journalistUser) {
                    magicToken = await getOrCreateMagicLink(
                      journalistUser._id,
                      newVaultAsset._id,
                      newVaultAsset.vaultAssetUUID,
                      email
                    );
                    console.log('[MAGIC LINK] ✅ Token generated for', email);
                  } else {
                    console.warn('[MAGIC LINK] ⚠️ No user found for', email, '— sending without magic link');
                  }
                } catch(mlErr) {
                  console.error('[MAGIC LINK] ❌ Failed to generate token:', mlErr.message);
                }
                return sendVaultInvitationEmail({
                    toEmail:      email,
                    toName,
                    senderCompany,
                    vaultTitle:   newVaultAsset.title,
                    embargoUntil: newVaultAsset.embargoUntil,
                    timezone:     newVaultAsset.availabilityTimezone,
                    vaultId:      newVaultAsset._id,
                    magicToken,
                });
            });

            // Run both in background — don't block the HTTP response
            Promise.allSettled(notificationPromises);
            Promise.allSettled(emailPromises).then(results => {
                const sent   = results.filter(r => r.value === true).length;
                const failed = results.filter(r => r.value === false).length;
                console.log(`[VAULT INVITE] Summary: ${sent} sent, ${failed} failed for Media Vault "${newVaultAsset.title}"`);
            });

        } else if (validatedTextData.action === 'draft' && invitedEmails.length > 0) {
            console.log(`INFO: Media Vault saved as draft. ${invitedEmails.length} invited journalist(s) saved. Invitations will be sent on publish.`);
        }

        console.log(`DEBUG: Attempting to send DETAILED (but no password data) 201 status with JSON response for _id: ${newVaultAsset._id}`);
        res.status(201).json({
            success: true,
            message: `Media Vault '${newVaultAsset.title}' (${newVaultAsset.status}) created successfully. Files stored. ${invitedEmails.length} journalist(s) invited.`,
            data: {
                _id: newVaultAsset._id.toString(),
                vaultAssetUUID: newVaultAsset.vaultAssetUUID,
                title: newVaultAsset.title,
                status: newVaultAsset.status
                // You can add more fields from newVaultAsset here if your frontend needs them
                // e.g., availabilityDate: newVaultAsset.availabilityDate,
                // embargoUntil: newVaultAsset.embargoUntil,
                // file counts, etc.
            }
        });
        console.log(`DEBUG: DETAILED (but no password data) JSON response supposedly sent for _id: ${newVaultAsset._id}`);

    } catch (error) {
        console.error('Error in POST /api/v1/vault/assets route:', error);
        await cleanupFiles(successfullyUploadedPaths, 'DB Save Error or Other Exception');
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, error: 'Database Validation Failed', details: Object.values(error.errors).map(val => val.message) });
        }
        if (error.code === 11000) {
             return res.status(409).json({ success: false, error: `Resource conflict.`, details: error.keyValue });
        }
        res.status(500).json({ success: false, error: 'Server error while processing vault asset.' });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/vault/admin/vaults
// Admin-facing vault list for Manage Media Vaults page.
// Returns full VaultAsset documents with populated user email,
// invitedUsers count, availabilityDate, status, createdAt.
// Roles: client_admin, platform_admin
// ─────────────────────────────────────────────────────────────
router.get('/admin/vaults', authenticate, async (req, res) => {
    try {
        const userId   = req.user.id;
        const userRole = req.user.role || '';
        const mongoose = require('mongoose');
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        // Role gate — only admins
        if (!['client_admin', 'platform_admin'].includes(userRole)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }

        const page   = Math.max(1, parseInt(req.query.page)  || 1);
        const limit  = Math.min(50, parseInt(req.query.limit) || 10);
        const skip   = (page - 1) * limit;
        const search = (req.query.title || req.query.search || '').trim();
        const brand  = (req.query.brand  || '').trim();
        const status = (req.query.status || '').trim();

        // Build query
        const query = {};
        if (userRole === 'client_admin') query.user = userObjectId; // client_admin sees only their own
        if (status) query.status = status;
        if (brand)  query.$or = [{ brand: new RegExp(brand, 'i') }, { companyName: new RegExp(brand, 'i') }];
        if (search) {
            const searchRx = new RegExp(search, 'i');
            if (query.$or) {
                // Combine brand + search with AND
                query.$and = [
                    { $or: query.$or },
                    { $or: [{ title: searchRx }, { brand: searchRx }, { companyName: searchRx }] }
                ];
                delete query.$or;
            } else {
                query.$or = [{ title: searchRx }, { brand: searchRx }, { companyName: searchRx }];
            }
        }

        const [vaults, totalItems] = await Promise.all([
            VaultAsset.find(query)
                .populate('user', 'email firstName lastName')
                .select('vaultAssetUUID title brand companyName status availabilityDate availabilityTime availabilityTimezone embargoUntil requireNDA invitedUsers teaserImage images videos vaultReleaseDocs supplementaryDocs vaultExpirationDays createdAt updatedAt firstAccessedAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            VaultAsset.countDocuments(query)
        ]);

        // Fetch access counts for all returned vaults in one query
        const vaultIds = vaults.map(v => v._id);
        const accessCounts = await VaultAccess.aggregate([
            { $match: { vaultId: { $in: vaultIds }, accessGranted: true } },
            { $group: { _id: '$vaultId', count: { $sum: 1 }, firstAccess: { $min: '$accessGrantedAt' } } }
        ]);
        const accessCountMap = {};
        const firstAccessMap = {};
        accessCounts.forEach(a => {
            accessCountMap[a._id.toString()] = a.count;
            firstAccessMap[a._id.toString()] = a.firstAccess || null;
        });

        const totalPages = Math.ceil(totalItems / limit) || 1;

        // Shape response
        const data = vaults.map(v => ({
            _id:             v._id,
            uuid:            v.vaultAssetUUID,
            title:           v.title,
            brand:           v.brand || v.companyName || null,
            companyName:     v.companyName || null,
            status:          v.status || 'unknown',
            sentBy:          v.user?.email || null,
            invitedUsers:    v.invitedUsers || [],
            invitedCount:    (v.invitedUsers || []).length,
            accessCount:     accessCountMap[v._id.toString()] || 0,
            availabilityDate: v.availabilityDate || null,
            availabilityTime: v.availabilityTime || null,
            timezone:        v.availabilityTimezone || 'Europe/Berlin',
            embargoUntil:    v.embargoUntil || null,
            requireNDA:      v.requireNDA || false,
            teaserImage:     v.teaserImage?.path || null,
            assetCounts: {
                docs:   (v.vaultReleaseDocs || []).length + (v.supplementaryDocs || []).length,
                images: (v.images || []).length,
                videos: (v.videos || []).length,
            },
            vaultExpirationDays: v.vaultExpirationDays || null,
            firstAccessedAt: firstAccessMap[v._id.toString()] || v.firstAccessedAt || null,
            createdAt:       v.createdAt,
            updatedAt:       v.updatedAt,
        }));

        res.json({
            success: true,
            data: {
                vaults: data,
                totalItems,
                totalPages,
                currentPage: page,
            }
        });

    } catch (err) {
        console.error('[VAULT] GET /admin/vaults error:', err);
        res.status(500).json({ success: false, error: 'Failed to load vaults' });
    }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/v1/vault/:vaultId/archive
// Soft-archive a vault — sets status to 'archived'.
// Roles: client_admin (own vaults only), platform_admin (all)
// ─────────────────────────────────────────────────────────────
router.patch('/:vaultId/archive', authenticate, async (req, res) => {
    try {
        const userId   = req.user.id;
        const userRole = req.user.role || '';
        const { vaultId } = req.params;

        if (!['client_admin', 'platform_admin'].includes(userRole)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }

        const query = { _id: vaultId };
        if (userRole === 'client_admin') query.user = userId;

        const vault = await VaultAsset.findOneAndUpdate(
            query,
            { $set: { status: 'archived' } },
            { new: true }
        );

        if (!vault) return res.status(404).json({ success: false, error: 'Vault not found or access denied' });

        res.json({ success: true, message: 'Vault archived successfully' });

    } catch (err) {
        console.error('[VAULT] PATCH /:vaultId/archive error:', err);
        res.status(500).json({ success: false, error: 'Failed to archive vault' });
    }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/v1/vault/:vaultId
// Hard-delete a vault and its files.
// Roles: client_admin (own vaults only), platform_admin (all)
// ─────────────────────────────────────────────────────────────
router.delete('/:vaultId', authenticate, async (req, res) => {
    try {
        const userId   = req.user.id;
        const userRole = req.user.role || '';
        const { vaultId } = req.params;

        if (!['client_admin', 'platform_admin'].includes(userRole)) {
            return res.status(403).json({ success: false, error: 'Insufficient permissions' });
        }

        const query = { _id: vaultId };
        if (userRole === 'client_admin') query.user = userId;

        const vault = await VaultAsset.findOne(query);
        if (!vault) return res.status(404).json({ success: false, error: 'Vault not found or access denied' });

        // Collect all file paths for cleanup
        const filePaths = [];
        const addPath = f => { if (f?.path) filePaths.push(path.join(__dirname, '..', 'public', f.path)); };
        addPath(vault.teaserImage);
        addPath(vault.ndaDocument);
        (vault.images || []).forEach(addPath);
        (vault.videos || []).forEach(addPath);
        (vault.vaultReleaseDocs || []).forEach(addPath);
        (vault.supplementaryDocs || []).forEach(addPath);

        await VaultAsset.deleteOne({ _id: vaultId });
        await cleanupFiles(filePaths, 'Vault hard-delete');

        res.json({ success: true, message: 'Vault deleted successfully' });

    } catch (err) {
        console.error('[VAULT] DELETE /:vaultId error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete vault' });
    }
});


// ─────────────────────────────────────────────────────────────
// GET /api/v1/vault/:vaultId/signatories
// Returns all invited journalists with their NDA signing status.
// Roles: client_admin, platform_admin
// ─────────────────────────────────────────────────────────────
router.get('/:vaultId/signatories', authenticate, async (req, res) => {
  try {
    const userId   = req.user.id;
    const userRole = req.user.role || '';
    const { vaultId } = req.params;
    const mongoose = require('mongoose');
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

    if (!['client_admin', 'platform_admin'].includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Fetch vault — check ownership for client_admin
    // Support both MongoDB _id and vaultAssetUUID
    const isUUID = vaultId.includes('-');
    const query = isUUID ? { vaultAssetUUID: vaultId } : { _id: vaultId };
    if (userRole === 'client_admin') query.user = userObjectId;
    const vault = await VaultAsset.findOne(query).select('_id title invitedUsers').lean();
    const resolvedVaultId = vault ? String(vault._id) : vaultId;
    if (!vault) return res.status(404).json({ success: false, error: 'Vault not found or access denied' });

    const invitedUsers = vault.invitedUsers || [];

    // Fetch all VaultAccess records for this vault
    const accessRecords = await VaultAccess.find({ vaultId: resolvedVaultId })
      .populate('userId', 'email firstName lastName name')
      .select('userId signatureName signedAt signingIp signingDevice accessGranted accessGrantedAt lastAccessedAt signedNdaPdfPath')
      .lean();

    // Build signatory records keyed by email
    const sigMap = {};
    accessRecords.forEach(rec => {
      const email = rec.userId?.email;
      if (!email) return;
      sigMap[email] = {
        email,
        signed:          !!rec.signedAt,
        signatureName:   rec.signatureName || null,
        signedAt:        rec.signedAt || null,
        signingIp:       rec.signingIp || null,
        signingDevice:   rec.signingDevice || null,
        accessed:        !!rec.accessGranted,
        accessGrantedAt: rec.accessGrantedAt || null,
        lastAccessedAt:  rec.lastAccessedAt || null,
        signedNdaPdfPath: rec.signedNdaPdfPath || null,
      };
    });

    // Shape response — one entry per invited email
    const signatories = invitedUsers.map(email => sigMap[email] || {
      email,
      signed:          false,
      signatureName:   null,
      signedAt:        null,
      signingIp:       null,
      signingDevice:   null,
      accessed:        false,
      accessGrantedAt: null,
      lastAccessedAt:  null,
      signedNdaPdfPath: null,
    });

    res.json({
      success: true,
      data: {
        vaultId,
        vaultTitle:   vault.title,
        invitedUsers,
        signatories,
        summary: {
          totalInvited: invitedUsers.length,
          totalSigned:  signatories.filter(s => s.signed).length,
          totalAccessed: signatories.filter(s => s.accessed).length,
        }
      }
    });

  } catch (err) {
    console.error('[VAULT] GET /signatories error:', err);
    res.status(500).json({ success: false, error: 'Failed to load signatories' });
  }
});


// ─────────────────────────────────────────────────────────────
// GET /api/v1/vault/access?token=xyz
// Magic link — authenticates journalist and redirects to their vault
// ─────────────────────────────────────────────────────────────
router.get('/access', async (req, res) => {
  const { token } = req.query;
  const baseUrl = process.env.APP_URL || 'http://44.200.25.168:5000';

  if (!token) {
    return res.redirect(`${baseUrl}/automediavault.html?error=missing_token`);
  }

  try {
    const magicLink = await VaultMagicLink.findValid(token);
    if (!magicLink) {
      return res.redirect(`${baseUrl}/automediavault.html?error=invalid_token`);
    }

    // Fetch the journalist user
    const User = require('../models/User');
    const user = await User.findById(magicLink.userId).select('email role firstName lastName name').lean();
    if (!user) {
      return res.redirect(`${baseUrl}/automediavault.html?error=user_not_found`);
    }

    // Issue a JWT for this journalist
    const jwtSecret = process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET;
    const jwtToken = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Mark token as used (but keep active for re-use within 30 days)
    await VaultMagicLink.findByIdAndUpdate(magicLink._id, {
      $set: { usedAt: new Date() }
    });

    console.log(`[MAGIC LINK] ✅ Journalist ${user.email} authenticated via magic link for vault ${magicLink.vaultAssetUUID}`);

    // Redirect to vault page with JWT and vault UUID as URL params
    // The frontend will read these, store the JWT, and open the specific vault
    res.redirect(`${baseUrl}/automediavault.html?magic_token=${jwtToken}&vault=${magicLink.vaultAssetUUID}`);

  } catch (err) {
    console.error('[MAGIC LINK] Error:', err.message);
    res.redirect(`${baseUrl}/automediavault.html?error=server_error`);
  }
});

// --- Helper Function for File Cleanup ---
async function cleanupFiles(filePaths, errorContext = 'Unknown Error') {
    if (!filePaths || filePaths.length === 0) return;
    console.warn(`[FILE_CLEANUP] Initiating cleanup due to: ${errorContext}. Files: ${filePaths.length}`);
    let count = 0;
    const results = await Promise.allSettled(
        filePaths.map(filePath => fs.promises.access(filePath, fs.constants.F_OK)
            .then(() => fs.promises.unlink(filePath).then(() => filePath))
            .catch(err => { if (err.code === 'ENOENT') return null; throw err; })
        )
    );
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) { console.log(`[FILE_CLEANUP] Successfully removed: ${result.value}`); count++; }
        else if (result.status === 'rejected') { console.error(`[FILE_CLEANUP] Failed to remove file:`, result.reason); }
    });
    if (count > 0) console.warn(`[FILE_CLEANUP] Finished cleanup. Removed ${count} potentially orphaned files.`);
}

module.exports = router;