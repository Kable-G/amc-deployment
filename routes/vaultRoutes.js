// File: routes/vaultRoutes.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-bypass'); // FAKE AUTH - Always allows access
const VaultAsset = require('../models/VaultAsset');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Using 'fs' for existsSync/mkdirSync and async cleanup

// --- Define Zod Schema for Vault Asset input validation (for req.body text fields) ---
const createVaultAssetSchema = z.object({
    vaultAssetUUID: z.string().uuid({ message: "Invalid Vault Asset UUID format." }),
    title: z.string().min(1, { message: "Vault Name is required." }).max(200),
    internalDescription: z.string().optional().nullable(),
    availabilityDate: z.string().refine((dateStr) => !isNaN(new Date(dateStr).getTime()), { message: "Invalid availability date." }),
    availabilityTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Invalid availability time format. Use HH:MM." }),
    availabilityTimezone: z.string().min(1, { message: "Availability timezone is required." }),
    embargoUntil: z.string().refine((dateTimeStr) => !isNaN(new Date(dateTimeStr).getTime()), { message: "Invalid embargo date/time." }),

    requireNDA: z.preprocess(val => String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'yes', z.boolean()).optional().default(false),
    notifyClientOnAccess: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),
    notifyClientOnDownload: z.preprocess(val => String(val).toLowerCase() === 'true', z.boolean()).optional().default(false),
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
    { name: 'vaultReleaseDocs', maxCount: 5 }, { name: 'vaultImages', maxCount: 50 },
    { name: 'vaultVideos', maxCount: 10 }, { name: 'vaultSupplementaryDocs', maxCount: 10 }
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
router.post('/assets', handleVaultMulterUpload, auth, async (req, res) => {
    console.log('Backend received POST /api/v1/vault/assets (Password functionality removed, invitedUsers processing, detailed JSON response)');
    
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

        const vaultDataForDb = {
            vaultAssetUUID: validatedTextData.vaultAssetUUID,
            title: validatedTextData.title,
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
            vaultExpirationDays: validatedTextData.vaultExpirationDays,
            watermarkEnabled: validatedTextData.watermark,
            geoLockEnabled: validatedTextData.geoLock,
            requireMfaOnAccess: validatedTextData.requireMfaOnAccess,
            vaultLegalTermsAcknowledged: validatedTextData.vaultLegalTermsAck,
            status: validatedTextData.action === 'publish' ? 'active' : 'draft'
            // vaultPassword field intentionally omitted
        };

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

        const invitedEmails = validatedTextData.invitedUsers || [];
        if (invitedEmails.length > 0 && validatedTextData.action === 'publish') {
            console.log(`INFO: Vault published. Processing ${invitedEmails.length} invited user(s):`, invitedEmails);
            for (const email of invitedEmails) {
                console.log(`  TODO: Process invitation for ${email} for Vault ID ${newVaultAsset._id}`);
                console.log(`  TODO: Send email notification to ${email}`);
            }
        } else if (validatedTextData.action === 'draft' && invitedEmails.length > 0) {
            console.log(`INFO: Vault saved as draft. ${invitedEmails.length} user(s) are noted:`, invitedEmails, "Notifications will be sent upon publishing.");
        }

        console.log(`DEBUG: Attempting to send DETAILED (but no password data) 201 status with JSON response for _id: ${newVaultAsset._id}`);
        res.status(201).json({
            success: true,
            message: `Vault Asset '${newVaultAsset.title}' (${newVaultAsset.status}) processed (NO PASSWORD). File info stored. Invites logged.`,
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