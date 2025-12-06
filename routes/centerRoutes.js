// File: routes/centerRoutes.js
// THIS IS THE COMPLETE, CORRECTED, AND UNTRUNCATED FILE.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Real authentication for proper user tracking
const CenterRelease = require('../models/CenterRelease');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const { extractText } = require('unpdf');
const { spawn, exec } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

// <<< MODIFICATION: NEW MODELS IMPORTED FOR DOWNLOAD ENDPOINT >>>
// NOTE: We assume assets are sub-documents, so we don't need a separate Asset model here.
const DownloadEvent = require('../models/DownloadEvent');
// <<< END MODIFICATION >>>


// Zod Schema for Creation
const createCenterReleaseSchema = z.object({
    releaseUUID: z.string().uuid({ message: "Invalid Release UUID format." }),
    title: z.string().min(1, { message: "Title is required." }).max(200, { message: "Title cannot exceed 200 characters." }),
    releaseDate: z.string().refine((dateString) => !isNaN(new Date(dateString).getTime()), { message: "Invalid release date format." }),
    releaseTime: z.string().optional().nullable().refine(val => val === null || val === undefined || val === '' || /^\d{2}:\d{2}$/.test(val), { message: "Invalid time format. Use HH:MM or leave empty." }),
    brand: z.string().min(1, { message: "Brand is required." }),
    tags: z.string().optional().nullable(),
    summary: z.string().min(1, { message: "Summary is required." }),
    action: z.enum(['draft', 'publish'], { errorMap: () => ({ message: "Action must be 'draft' or 'publish'." }) }),
    watermark: z.string().optional().nullable(), // Sent as string 'true'/'false' from form
    monitoring: z.string().optional().nullable(),// Sent as string 'true'/'false' from form
    legalTermsAck: z.string().optional().nullable() // Sent as string 'agreed' from form
});

// --- MODIFICATION START: Corrected Zod Schema for Update ---
// Zod Schema for Update (fields are optional)
const updateCenterReleaseSchema = createCenterReleaseSchema.partial().extend({
    action: z.enum(['draft', 'publish', 'update']).optional(),
    filesToDelete: z.string().optional().nullable() // Expecting a JSON stringified array of paths
});
// --- MODIFICATION END ---


// Multer Configuration
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'center_assets');
try { 
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Upload directory created: ${uploadDir}`);
  }
} catch (err) {
  console.error("FATAL ERROR: Could not ensure upload directory exists. Check permissions and path.", err);
  // Consider exiting the process if this fails, as uploads are critical
  // process.exit(1); 
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { 
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'); // Allow . _ -
    const finalFilename = uniqueSuffix + '_' + safeOriginalName;
    cb(null, finalFilename);
  }
});

const centerReleaseUploadFields = [
    { name: 'centerCardTeaserImage', maxCount: 1 }, 
    { name: 'releaseDocs', maxCount: 5 },
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'supplementaryDocs', maxCount: 10 }
];

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 150, files: centerReleaseUploadFields.reduce((acc, field) => acc + field.maxCount, 0) } 
}).fields(centerReleaseUploadFields);

const handleMulterUpload = (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('[MULTER_DEBUG] Multer Error during upload:', err);
            let message = `File upload error: ${err.message}.`;
            if (err.code === 'LIMIT_FILE_SIZE') message = 'File is too large. Max size is 150MB.';
            if (err.code === 'LIMIT_FILE_COUNT') message = 'Too many files uploaded for one or more fields.';
            return res.status(400).json({ success: false, error: message, code: err.code });
        } else if (err) {
            console.error('[MULTER_DEBUG] Unknown Error or FileFilter Error during upload:', err);
            return res.status(400).json({ success: false, error: err.message || 'Invalid file type or upload error.' });
        }
        next();
    });
};

// Function to generate video thumbnail using FFmpeg static binary
async function generateVideoThumbnail(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        console.log(`FFMPEG DEBUG: Starting thumbnail generation`);
        console.log(`FFMPEG DEBUG: Input video: ${videoPath}`);
        console.log(`FFMPEG DEBUG: Output thumbnail: ${outputPath}`);
        console.log(`FFMPEG DEBUG: FFmpeg binary path: ${ffmpegStatic}`);
        
        // Check if input file exists and get its stats
        const fs = require('fs');
        if (!fs.existsSync(videoPath)) {
            const error = new Error(`Video file does not exist: ${videoPath}`);
            console.error(`FFMPEG ERROR: ${error.message}`);
            reject(error);
            return;
        }
        
        const stats = fs.statSync(videoPath);
        console.log(`FFMPEG DEBUG: Video file size: ${stats.size} bytes`);
        console.log(`FFMPEG DEBUG: Video file modified: ${stats.mtime}`);
        
        // Use the static FFmpeg binary
        const ffmpeg = spawn(ffmpegStatic, [
            '-i', videoPath,           // Input video file
            '-ss', '00:00:01',         // Seek to 1 second (to avoid black frames)
            '-vframes', '1',           // Extract only 1 frame
            '-vf', 'scale=320:240',    // Scale to thumbnail size
            '-y',                      // Overwrite output file if it exists
            outputPath                 // Output thumbnail path
        ]);

        let stderr = '';
        let stdout = '';
        
        ffmpeg.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            console.log(`FFMPEG STDERR: ${chunk.trim()}`);
        });
        
        ffmpeg.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            console.log(`FFMPEG STDOUT: ${chunk.trim()}`);
        });

        ffmpeg.on('close', (code) => {
            console.log(`FFMPEG DEBUG: Process closed with code: ${code}`);
            if (code === 0) {
                // Check if output file was created
                if (fs.existsSync(outputPath)) {
                    const outputStats = fs.statSync(outputPath);
                    console.log(`FFMPEG SUCCESS: Thumbnail created, size: ${outputStats.size} bytes`);
                    resolve(outputPath);
                } else {
                    const error = new Error(`FFmpeg succeeded but output file not found: ${outputPath}`);
                    console.error(`FFMPEG ERROR: ${error.message}`);
                    reject(error);
                }
            } else {
                const error = new Error(`FFmpeg failed with code ${code}: ${stderr}`);
                console.error(`FFMPEG ERROR: ${error.message}`);
                reject(error);
            }
        });

        ffmpeg.on('error', (err) => {
            console.error(`FFMPEG SPAWN ERROR: ${err.message}`);
            console.error(`FFMPEG SPAWN ERROR STACK: ${err.stack}`);
            reject(err);
        });
    });
}

// POST /api/v1/center/releases - Create a new Center Release
router.post('/releases', handleMulterUpload, auth, async (req, res) => { 
    console.log('Backend received POST /api/v1/center/releases');
    
    try {
        const validationResult = createCenterReleaseSchema.safeParse(req.body);
        if (!validationResult.success) {
            console.error('Center Release text data validation failed (Zod):', validationResult.error.flatten().fieldErrors);
            return res.status(400).json({
                success: false,
                error: 'Invalid input data. Please check the text fields.',
                details: validationResult.error.flatten().fieldErrors
            });
        }

        const validatedTextData = validationResult.data;
        const {
            releaseUUID, title, releaseDate, releaseTime, brand, tags,
            summary, watermark, monitoring, legalTermsAck, action
        } = validatedTextData;
        const userId = req.user.id;
        const clientId = req.user.clientId;

        if (!clientId && (req.user.role === 'client_user' || req.user.role === 'client_admin')) {
             console.error(`User ${userId} (role: ${req.user.role}) creating Center Release but missing clientId.`);
             return res.status(403).json({ success: false, error: 'User client association is missing.' });
        }

        const processFiles = async (fileField) => {
            if (req.files && req.files[fileField]) {
                const processedFiles = [];
                
                for (const file of req.files[fileField]) {
                    console.log(`PROCESSING FILE: ${file.originalname} (${file.mimetype})`);
                    
                    const fileData = {
                        originalName: file.originalname,
                        path: `/uploads/center_assets/${file.filename}`,
                        mimetype: file.mimetype,
                        size: file.size
                    };
                    
                    // Generate thumbnail for video files - FORCE EXECUTION
                    if (file.mimetype && file.mimetype.startsWith('video/')) {
                        console.log(`🎬 VIDEO DETECTED: ${file.originalname}`);
                        console.log(`🎬 STARTING THUMBNAIL GENERATION...`);
                        
                        try {
                            const videoPath = path.join(uploadDir, file.filename);
                            const thumbnailFilename = `thumb_${file.filename.replace(/\.[^/.]+$/, '')}.jpg`;
                            const thumbnailPath = path.join(uploadDir, thumbnailFilename);
                            
                            console.log(`🎬 Video file: ${videoPath}`);
                            console.log(`🎬 Thumbnail file: ${thumbnailPath}`);
                            console.log(`🎬 Video exists: ${fs.existsSync(videoPath)}`);
                            
                            // Add a small delay to ensure file is fully written
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            await generateVideoThumbnail(videoPath, thumbnailPath);
                            fileData.thumbPath = `/uploads/center_assets/${thumbnailFilename}`;
                            console.log(`🎬 SUCCESS: Thumbnail generated -> ${fileData.thumbPath}`);
                        } catch (thumbError) {
                            console.error(`🎬 ERROR: Thumbnail generation failed for ${file.originalname}:`);
                            console.error(`🎬 ERROR Details:`, thumbError.message);
                            console.error(`🎬 ERROR Stack:`, thumbError.stack);
                            // Continue without thumbnail - frontend will show placeholder
                        }
                    } else {
                        console.log(`📄 NON-VIDEO FILE: ${file.originalname} (${file.mimetype})`);
                    }
                    
                    processedFiles.push(fileData);
                }
                
                return processedFiles;
            }
            return [];
        };

        const releaseDocFiles = await processFiles('releaseDocs');
        const imageFiles = await processFiles('images');
        const videoFiles = await processFiles('videos');
        const supplementaryDocFiles = await processFiles('supplementaryDocs');
        
        let cardTeaserImagePathValue = null;
        let cardTeaserImageMetaValue = null;
        if (req.files && req.files['centerCardTeaserImage'] && req.files['centerCardTeaserImage'][0]) {
            const teaserFile = req.files['centerCardTeaserImage'][0];
            cardTeaserImagePathValue = `/uploads/center_assets/${teaserFile.filename}`;
            cardTeaserImageMetaValue = {
                originalName: teaserFile.originalname,
                path: cardTeaserImagePathValue,
                mimetype: teaserFile.mimetype,
                size: teaserFile.size
            };
        }

        const releaseDataForDb = {
            uuid: releaseUUID, title, releaseDate: new Date(releaseDate),
            releaseTime: (releaseTime && releaseTime.trim() !== '') ? releaseTime : null,
            brand, tags: (tags && tags.trim() !== '') ? tags.split(',').map(tag => tag.trim()) : [],
            summary, 
            status: (() => {
                if (action === 'draft') return 'draft';
                
                const moment = require('moment-timezone');
                const now = moment().tz('Europe/Berlin');
                const releaseDateStr = moment(releaseDate).format('YYYY-MM-DD');
                const releaseTimeStr = (releaseTime && releaseTime.trim() !== '') ? releaseTime : '00:00';
                const releaseDateTime = moment.tz(`${releaseDateStr} ${releaseTimeStr}`, 'YYYY-MM-DD HH:mm', 'Europe/Berlin');
                
                console.log(`[POST CREATE] Scheduled: ${releaseDateTime.format('YYYY-MM-DD HH:mm z')}`);
                console.log(`[POST CREATE] Now: ${now.format('YYYY-MM-DD HH:mm z')}`);
                console.log(`[POST CREATE] DST Active: ${now.isDST() ? 'Yes (CEST)' : 'No (CET)'}`);
                
                return releaseDateTime.isAfter(now) ? 'pending' : 'published';
            })(),
            user: userId,
            clientId: clientId || null, // Allow null for platform_admin users
            cardTeaserImagePath: cardTeaserImagePathValue,
            cardTeaserImageMeta: cardTeaserImageMetaValue,
            releaseDocs: releaseDocFiles, images: imageFiles, videos: videoFiles, supplementaryDocs: supplementaryDocFiles,
            watermarkEnabled: watermark === 'true',
            monitoringEnabled: monitoring === 'true',
            legalTermsAcknowledged: legalTermsAck === 'agreed',
        };
        
        const newRelease = await CenterRelease.create(releaseDataForDb);
        console.log(`DEBUG: New CenterRelease created. Title: '${newRelease.title}', ClientID: ${newRelease.clientId}, UserID: ${newRelease.user}, UUID: ${newRelease.uuid}`);

        res.status(201).json({
            success: true,
            message: `AMC Release '${newRelease.title}' (${releaseDataForDb.status}) processed. File info stored.`,
            data: newRelease 
        });

    } catch (error) { 
        console.error('Error in POST /api/v1/center/releases route:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, error: 'Database Validation Failed (Mongoose)', details: messages });
        }
        res.status(500).json({ success: false, error: 'Server error while processing the release.' });
    }
});


// GET /api/v1/center/releases - List all published Center Releases (for public consumption like automediacenter.html)
router.get('/releases', async (req, res) => {
    console.log('Backend received GET /api/v1/center/releases (public list)');
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 24;
        const skip = (page - 1) * limit;

        // Get current date and time for embargo filtering in Europe/Berlin timezone
        const now = new Date();
        // Convert to Europe/Berlin timezone for comparison
        const berlinTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Berlin"}));
        console.log(`EMBARGO CHECK: Current UTC: ${now.toISOString()}`);
        console.log(`EMBARGO CHECK: Current Berlin time: ${berlinTime.toISOString()}`);

        let queryFilters = { status: { $in: ['published', 'pending'] } };
        
        // Simple but effective embargo filtering - fetch all published releases and filter in JavaScript
        // This ensures compatibility while maintaining exact time precision
        console.log('EMBARGO FILTER: Fetching all published releases for embargo filtering');

        if (req.query.brand) {
            queryFilters.brand = { $regex: req.query.brand, $options: 'i' };
        }

        console.log('EMBARGO FILTER: Query filters:', JSON.stringify(queryFilters, null, 2));

        // Fetch all published releases first, then filter by embargo in JavaScript
        const allPublishedReleases = await CenterRelease.find(queryFilters)
            .sort({ releaseDate: -1, createdAt: -1 })
            .populate('user', 'name')
            .populate('clientId', 'clientName')
            .select('-user.email -updatedBy -createdBy')
            .lean();

        console.log(`EMBARGO FILTER: Found ${allPublishedReleases.length} total published releases`);

        // Filter releases based on exact embargo date/time with auto-update functionality
        const embargoFilteredReleases = [];

        for (const release of allPublishedReleases) {
            try {
                const moment = require('moment-timezone');
                const nowMoment = moment().tz('Europe/Berlin');
                const releaseDateStr = moment(release.releaseDate).format('YYYY-MM-DD');
                const releaseTimeStr = release.releaseTime ? release.releaseTime : '00:00';
                const releaseDateTime = moment.tz(`${releaseDateStr} ${releaseTimeStr}`, 'YYYY-MM-DD HH:mm', 'Europe/Berlin');

                const embargoLifted = releaseDateTime.isSameOrBefore(nowMoment);
                
                console.log(`EMBARGO CHECK: "${release.title}"`);
                console.log(`  Release time: ${releaseDateTime.format('YYYY-MM-DD HH:mm z')}`);
                console.log(`  Current time: ${nowMoment.format('YYYY-MM-DD HH:mm z')}`);
                console.log(`  Embargo lifted: ${embargoLifted}`);
                
                // ✅ NEW: Auto-update status from 'pending' to 'published' when time arrives
                if (release.status === 'pending' && embargoLifted) {
                    console.log(`  🔄 AUTO-UPDATE: Changing status from 'pending' to 'published'`);
                    await CenterRelease.updateOne(
                        { _id: release._id },
                        { $set: { status: 'published' } }
                    );
                    release.status = 'published'; // Update in-memory object too
                }
                
                if (embargoLifted) {
                    embargoFilteredReleases.push(release);
                }
            } catch (error) {
                console.error(`EMBARGO ERROR: Failed to process release "${release.title}":`, error);
            }
        }

        console.log(`EMBARGO RESULT: ${embargoFilteredReleases.length} releases passed embargo filter`);
        // Sort the embargo-filtered releases by release date/time in descending order (newest first)
        // This ensures proper chronological ordering including the release time
        embargoFilteredReleases.sort((a, b) => {
            // Create full datetime objects for accurate comparison
            const getFullDateTime = (release) => {
                const releaseDateStr = new Date(release.releaseDate).toISOString().split('T')[0];
                if (release.releaseTime && release.releaseTime.trim() !== '') {
                    return new Date(`${releaseDateStr}T${release.releaseTime}:00+01:00`);
                } else {
                    return new Date(`${releaseDateStr}T00:00:00+01:00`);
                }
            };
            
            const dateTimeA = getFullDateTime(a);
            const dateTimeB = getFullDateTime(b);
            
            // Sort in descending order (newest first)
            return dateTimeB.getTime() - dateTimeA.getTime();
        });

        console.log(`SORTING: Releases sorted by release date/time in descending order`);

        // Apply pagination to the filtered results
        const paginatedReleases = embargoFilteredReleases.slice(skip, skip + limit);
        const totalReleases = embargoFilteredReleases.length;

        res.status(200).json({
            success: true,
            data: {
                releases: paginatedReleases,
                currentPage: page,
                totalPages: Math.ceil(totalReleases / limit),
                totalItems: totalReleases
            }
        });

    } catch (error) {
        console.error('Error fetching public Center Releases list:', error);
        res.status(500).json({ success: false, error: 'Server error while fetching releases list.' });
    }
});

// GET /api/v1/center/my-releases - List ALL releases for the logged-in client (for manage_releases.html)
router.get('/my-releases', auth, async (req, res) => {
    console.log('🔥 MY-RELEASES ROUTE HIT: GET /api/v1/center/my-releases');
    console.log('🔥 Request method:', req.method);
    console.log('🔥 Request headers:', req.headers);
    console.log('🔥 Request query:', req.query);
    
    try {
        console.log('DEBUG /my-releases route - req.user:', JSON.stringify(req.user, null, 2));

        // Convert clientId to ObjectId if it's a string
        let clientIdForQuery = req.user.clientId;
        if (typeof clientIdForQuery === 'string') {
            const mongoose = require('mongoose');
            clientIdForQuery = new mongoose.Types.ObjectId(clientIdForQuery);
        }

        if (!clientIdForQuery && (req.user.role === 'client_user' || req.user.role === 'client_admin')) {
            console.error('Error in /my-releases: User not associated with a client. User:', req.user);
            return res.status(403).json({ success: false, error: 'User not associated with a client.' });
        }

        let queryFilters = {};
        if (req.user.role === 'client_user' || req.user.role === 'client_admin') {
            queryFilters.clientId = clientIdForQuery;
            console.log(`DEBUG /my-releases: Querying with clientId: ${clientIdForQuery}`);
        } else if (req.user.role !== 'platform_admin') {
             console.error('Error in /my-releases: User role not permitted. User:', req.user);
             return res.status(403).json({ success: false, error: 'Access denied due to user role.' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        if (req.query.title) queryFilters.title = { $regex: req.query.title, $options: 'i' };
        if (req.query.brand) queryFilters.brand = { $regex: req.query.brand, $options: 'i' };
        if (req.query.status && ['published', 'draft', 'archived', 'pending'].includes(req.query.status)) { // Validate status against Mongoose enum
            queryFilters.status = req.query.status;
        }

        console.log('DEBUG /my-releases: Mongoose find queryFilters:', JSON.stringify(queryFilters));

        const releases = await CenterRelease.find(queryFilters)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('uuid title brand status updatedAt releaseDate releaseTime cardTeaserImagePath clientId user')
            .populate('user', 'email name')
            .lean();

        console.log(`DEBUG /my-releases: Found ${releases.length} releases from DB with current filters.`);

        // ✅ NEW: Auto-update status from 'pending' to 'published' when scheduled time has passed
        const now = new Date();
        for (const release of releases) {
            if (release.status === 'pending') {
                try {
                    const moment = require('moment-timezone');
                    const nowMoment = moment().tz('Europe/Berlin');
                    const releaseDateStr = moment(release.releaseDate).format('YYYY-MM-DD');
                    const releaseTimeStr = release.releaseTime ? release.releaseTime : '00:00';
                    const releaseDateTime = moment.tz(`${releaseDateStr} ${releaseTimeStr}`, 'YYYY-MM-DD HH:mm', 'Europe/Berlin');
                    
                    // Check if embargo has lifted
                    if (releaseDateTime.isSameOrBefore(nowMoment)) {
                        console.log(`🔄 AUTO-UPDATE: "${release.title}" - Changing 'pending' → 'published'`);
                        
                        // Update in database
                        await CenterRelease.updateOne(
                            { _id: release._id },
                            { $set: { status: 'published' } }
                        );
                        
                        // Update in-memory object
                        release.status = 'published';
                    }
                } catch (updateError) {
                    console.error(`❌ Error auto-updating status for "${release.title}":`, updateError);
                }
            }
        }

        const totalReleases = await CenterRelease.countDocuments(queryFilters);

        console.log(`✅ SUCCESS: Returning ${releases.length} releases for user ${req.user.email}`);

        res.status(200).json({
            success: true,
            data: {
                releases,
                currentPage: page,
                totalPages: Math.ceil(totalReleases / limit),
                totalReleases
            }
        });
    } catch (error) {
        console.error('❌ Error fetching "my-releases":', error);
        res.status(500).json({ success: false, error: 'Server error while fetching your releases.' });
    }
});


// GET /api/v1/center/releases/:uuid (get single PUBLISHED release by UUID for public/detail view on AssetDBmenu1.6)
router.get('/releases/:uuid', auth, async (req, res) => {
    const requestedUuid = req.params.uuid;
    console.log(`Backend received GET for specific public /api/v1/center/releases/${requestedUuid}`);
    try {
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(requestedUuid)) {
            return res.status(400).json({ success: false, error: 'Invalid Release UUID format.' });
        }
        
        // Get current date and time for embargo filtering
        const now = new Date();
        console.log(`EMBARGO CHECK (Single): Current UTC: ${now.toISOString()} for UUID: ${requestedUuid}`);

        // First find the release by UUID and published status
        const release = await CenterRelease.findOne({
            uuid: requestedUuid,
            status: 'published'
        })
            .populate('user', 'name')
            .populate('clientId', 'clientName')
            .lean();
            
        if (!release) {
            console.log(`EMBARGO BLOCK: Release ${requestedUuid} not found`);
            return res.status(404).json({ success: false, error: 'Published release not found.' });
        }

        // Check embargo in JavaScript for exact time precision
        try {
            let releaseDateTime;
            const releaseDateStr = new Date(release.releaseDate).toISOString().split('T')[0];
            
            if (release.releaseTime && release.releaseTime.trim() !== '') {
                // Use ISO 8601 format with Berlin timezone offset (+01:00)
                releaseDateTime = new Date(`${releaseDateStr}T${release.releaseTime}:00+01:00`);
            } else {
                // No time specified, use midnight Berlin time
                releaseDateTime = new Date(`${releaseDateStr}T00:00:00+01:00`);
            }

            const embargoLifted = releaseDateTime <= now;
            
            const releaseTimeStr = release.releaseTime ?
                `${releaseDateStr} ${release.releaseTime} Berlin` :
                `${releaseDateStr} 00:00 Berlin`;
            
            console.log(`EMBARGO CHECK (Single): "${release.title}"`);
            console.log(`  Release time: ${releaseTimeStr} (${releaseDateTime.toISOString()})`);
            console.log(`  Current time: ${now.toISOString()}`);
            console.log(`  Embargo lifted: ${embargoLifted}`);

            if (!embargoLifted) {
                console.log(`EMBARGO BLOCK: Release ${requestedUuid} embargo not yet lifted`);
                return res.status(404).json({ success: false, error: 'Published release not found or not yet available.' });
            }

            console.log(`EMBARGO PASS: "${release.title}" - Status: ${release.status}`);
        } catch (error) {
            console.error(`EMBARGO ERROR (Single): Failed to process release "${release.title}":`, error);
            return res.status(404).json({ success: false, error: 'Published release not found or not yet available.' });
        }
        
        res.status(200).json({ success: true, data: release });
    } catch (error) {
        console.error(`Error fetching Center Release by UUID (${requestedUuid}):`, error);
        res.status(500).json({ success: false, error: 'Server error while fetching release.' });
    }
});

// GET /api/v1/center/releases/foredit/:uuid - Fetch a single release (any status) for editing by owner/admin
router.get('/releases/foredit/:uuid', auth, async (req, res) => {
    const requestedUuid = req.params.uuid;
    console.log(`Backend received GET /api/v1/center/releases/foredit/${requestedUuid}`);
    try {
        console.log('DEBUG /releases/foredit/:uuid route - req.user:', JSON.stringify(req.user, null, 2));

        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(requestedUuid)) {
            return res.status(400).json({ success: false, error: 'Invalid Release UUID format.' });
        }

        let query = { uuid: requestedUuid };

        if (req.user.role === 'client_user' || req.user.role === 'client_admin') {
            if (!req.user.clientId) {
                console.error('Error in /releases/foredit/:uuid: User not associated with a client. User:', req.user);
                return res.status(403).json({ success: false, error: 'User not associated with a client.' });
            }
            query.clientId = req.user.clientId;
            console.log(`DEBUG /releases/foredit/:uuid: Querying with clientId: ${req.user.clientId} and uuid: ${requestedUuid}`);
        } 
        else if (req.user.role !== 'platform_admin') {
             console.error('Error in /releases/foredit/:uuid: User role not permitted for this action. User:', req.user);
             return res.status(403).json({ success: false, error: 'Access denied.' });
        } else {
            console.log(`DEBUG /releases/foredit/:uuid: Platform admin access, querying only by uuid: ${requestedUuid}`);
        }
        
        console.log('DEBUG /releases/foredit/:uuid: Mongoose findOne query:', JSON.stringify(query));

        const release = await CenterRelease.findOne(query); 

        if (!release) {
             console.log(`DEBUG /releases/foredit/:uuid: Release not found with query: ${JSON.stringify(query)}`);
            return res.status(404).json({ success: false, error: 'Release not found or you do not have permission to edit it.' });
        }
        
        console.log(`DEBUG /releases/foredit/:uuid: Release found: ${release.title}`);
        const releaseDataForForm = release.toObject(); 
        
        if (releaseDataForForm.releaseDate) {
            const d = new Date(releaseDataForForm.releaseDate);
            releaseDataForForm.releaseDateFormatted = d.toISOString().split('T')[0];
        }

        if (releaseDataForForm.tags && Array.isArray(releaseDataForForm.tags)) {
            releaseDataForForm.tagsString = releaseDataForForm.tags.join(', ');
        } else {
            releaseDataForForm.tagsString = '';
        }
        
        releaseDataForForm.watermark = releaseDataForForm.watermarkEnabled; 
        releaseDataForForm.monitoring = releaseDataForForm.monitoringEnabled;
        releaseDataForForm.legalTermsAck = releaseDataForForm.legalTermsAcknowledged;

        res.status(200).json({ success: true, data: releaseDataForForm });

    } catch (error) {
        console.error(`Error fetching Center Release for editing by UUID (${requestedUuid}):`, error);
        res.status(500).json({ success: false, error: 'Server error while fetching release for editing.' });
    }
});

// PUT /api/v1/center/releases/:uuid - Update an existing Center Release
router.put('/releases/:uuid', handleMulterUpload, auth, async (req, res) => {
    const requestedUuid = req.params.uuid;
    console.log(`Backend received PUT /api/v1/center/releases/${requestedUuid}`);
    console.log('DEBUG PUT req.body:', req.body);
    console.log('DEBUG PUT req.files:', req.files);
    
    try {
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(requestedUuid)) {
            return res.status(400).json({ success: false, error: 'Invalid Release UUID format.' });
        }

        const validationResult = updateCenterReleaseSchema.safeParse(req.body);
        if (!validationResult.success) {
            console.error('Validation failed:', validationResult.error.flatten().fieldErrors);
            return res.status(400).json({ success: false, error: 'Invalid input data.', details: validationResult.error.flatten().fieldErrors });
        }
        const validatedData = validationResult.data;

        let release = await CenterRelease.findOne({ uuid: requestedUuid });
        if (!release) return res.status(404).json({ success: false, error: 'Release not found.' });
        // Check permissions: platform_admin can edit any release, others can only edit their own client's releases
        if (req.user.role !== 'platform_admin') {
            if (!req.user.clientId || !release.clientId || release.clientId.toString() !== req.user.clientId.toString()) {
                return res.status(403).json({ success: false, error: 'Forbidden.' });
            }
        }

        // --- START OF CRITICAL FILE HANDLING LOGIC ---

        // 1. Handle files marked for deletion
        if (validatedData.filesToDelete) {
            try {
                const pathsToDelete = JSON.parse(validatedData.filesToDelete);
                console.log('Attempting to delete files:', pathsToDelete);

                const deleteFileFromDisk = (filePath) => {
                    if (!filePath) return;
                    const fullPath = path.join(__dirname, '..', 'public', filePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                        console.log(`SUCCESS: Deleted file from disk: ${fullPath}`);
                    } else {
                        console.warn(`WARN: File not found for deletion on disk: ${fullPath}`);
                    }
                };
                
                // Filter out the files to be deleted from the database record
                ['releaseDocs', 'images', 'videos', 'supplementaryDocs'].forEach(field => {
                    release[field] = release[field].filter(fileObj => {
                        if (pathsToDelete.includes(fileObj.path)) {
                            deleteFileFromDisk(fileObj.path);
                            return false; // Remove from array
                        }
                        return true; // Keep in array
                    });
                });

                // Handle card teaser image deletion
                if (release.cardTeaserImagePath && pathsToDelete.includes(release.cardTeaserImagePath)) {
                    deleteFileFromDisk(release.cardTeaserImagePath);
                    release.cardTeaserImagePath = null;
                    release.cardTeaserImageMeta = null;
                    console.log('Card teaser image deleted from release');
                }
            } catch (jsonErr) {
                console.error("Error parsing filesToDelete JSON:", jsonErr);
                return res.status(400).json({ success: false, error: "Invalid format for filesToDelete." });
            }
        }

        // 2. Handle NEW file uploads (Additive)
        const processAndAddNewFiles = async (fileField) => {
            if (req.files && req.files[fileField]) {
                const newFiles = [];
                
                for (const file of req.files[fileField]) {
                    console.log(`🔄 UPDATE: Processing file: ${file.originalname} (${file.mimetype})`);
                    
                    const fileData = {
                        originalName: file.originalname,
                        path: `/uploads/center_assets/${file.filename}`,
                        mimetype: file.mimetype,
                        size: file.size
                    };
                    
                    // Generate thumbnail for video files - FORCE EXECUTION
                    if (file.mimetype && file.mimetype.startsWith('video/')) {
                        console.log(`🔄🎬 UPDATE VIDEO DETECTED: ${file.originalname}`);
                        console.log(`🔄🎬 STARTING UPDATE THUMBNAIL GENERATION...`);
                        
                        try {
                            const videoPath = path.join(uploadDir, file.filename);
                            const thumbnailFilename = `thumb_${file.filename.replace(/\.[^/.]+$/, '')}.jpg`;
                            const thumbnailPath = path.join(uploadDir, thumbnailFilename);
                            
                            console.log(`🔄🎬 Video file: ${videoPath}`);
                            console.log(`🔄🎬 Thumbnail file: ${thumbnailPath}`);
                            console.log(`🔄🎬 Video exists: ${fs.existsSync(videoPath)}`);
                            
                            // Add a small delay to ensure file is fully written
                            await new Promise(resolve => setTimeout(resolve, 100));
                            
                            await generateVideoThumbnail(videoPath, thumbnailPath);
                            fileData.thumbPath = `/uploads/center_assets/${thumbnailFilename}`;
                            console.log(`🔄🎬 SUCCESS: Update thumbnail generated -> ${fileData.thumbPath}`);
                        } catch (thumbError) {
                            console.error(`🔄🎬 ERROR: Update thumbnail generation failed for ${file.originalname}:`);
                            console.error(`🔄🎬 ERROR Details:`, thumbError.message);
                            console.error(`🔄🎬 ERROR Stack:`, thumbError.stack);
                            // Continue without thumbnail - frontend will show placeholder
                        }
                    } else {
                        console.log(`🔄📄 UPDATE NON-VIDEO FILE: ${file.originalname} (${file.mimetype})`);
                    }
                    
                    newFiles.push(fileData);
                }
                
                release[fileField].push(...newFiles); // Add new files to the existing array
                console.log(`🔄 Added ${newFiles.length} new file(s) to '${fileField}'`);
            }
        };
        await processAndAddNewFiles('releaseDocs');
        await processAndAddNewFiles('images');
        await processAndAddNewFiles('videos');
        await processAndAddNewFiles('supplementaryDocs');

        // 3. Handle Card Teaser Image update (Replacement)
        if (req.files && req.files['centerCardTeaserImage']) {
            const newTeaserFile = req.files['centerCardTeaserImage'][0];
            const newTeaserPath = `/uploads/center_assets/${newTeaserFile.filename}`;
            if (release.cardTeaserImagePath) {
                const oldTeaserFullPath = path.join(__dirname, '..', 'public', release.cardTeaserImagePath);
                if (fs.existsSync(oldTeaserFullPath)) fs.unlinkSync(oldTeaserFullPath);
            }
            release.cardTeaserImagePath = newTeaserPath;
            release.cardTeaserImageMeta = { originalName: newTeaserFile.originalname, path: newTeaserPath, mimetype: newTeaserFile.mimetype, size: newTeaserFile.size };
        }
        
        // 4. Update text fields and other data
        if (validatedData.title !== undefined) release.title = validatedData.title;
        if (validatedData.brand !== undefined) release.brand = validatedData.brand;
        if (validatedData.releaseDate !== undefined) release.releaseDate = new Date(validatedData.releaseDate);
        if (validatedData.releaseTime !== undefined) release.releaseTime = (validatedData.releaseTime && validatedData.releaseTime.trim() !== '') ? validatedData.releaseTime : null;
        if (validatedData.tags !== undefined) release.tags = (validatedData.tags && validatedData.tags.trim() !== '') ? validatedData.tags.split(',').map(tag => tag.trim()) : [];
        if (validatedData.summary !== undefined) release.summary = validatedData.summary;
        if (validatedData.action === 'publish') {
            const moment = require('moment-timezone');
            const now = moment().tz('Europe/Berlin');
            const releaseDateStr = moment(release.releaseDate).format('YYYY-MM-DD');
            const releaseTimeStr = (release.releaseTime && release.releaseTime.trim() !== '') ? release.releaseTime : '00:00';
            const releaseDateTime = moment.tz(`${releaseDateStr} ${releaseTimeStr}`, 'YYYY-MM-DD HH:mm', 'Europe/Berlin');
            
            console.log(`[PUT UPDATE] Scheduled: ${releaseDateTime.format('YYYY-MM-DD HH:mm z')}`);
            console.log(`[PUT UPDATE] Now: ${now.format('YYYY-MM-DD HH:mm z')}`);
            console.log(`[PUT UPDATE] DST Active: ${now.isDST() ? 'Yes (CEST)' : 'No (CET)'}`);
            
            release.status = releaseDateTime.isAfter(now) ? 'pending' : 'published';
            
        } else if (validatedData.action === 'draft') {
            release.status = 'draft';
        }
        if (validatedData.watermark !== undefined) release.watermarkEnabled = validatedData.watermark === 'true';
        if (validatedData.monitoring !== undefined) release.monitoringEnabled = validatedData.monitoring === 'true';
        if (validatedData.legalTermsAck !== undefined) release.legalTermsAcknowledged = validatedData.legalTermsAck === 'agreed';
        
        release.updatedBy = req.user.id;

        await release.save();

        console.log(`SUCCESS: Release '${release.title}' updated.`);
        res.status(200).json({
            success: true,
            message: `Release '${release.title}' updated successfully.`,
            data: release 
        });

    } catch (error) {
        console.error(`Error in PUT /api/v1/center/releases/${requestedUuid}:`, error);
        res.status(500).json({ success: false, error: 'Server error while updating the release.' });
    }
});


// DELETE /api/v1/center/releases/:uuid - Soft-delete a release by archiving it
router.delete('/releases/:uuid', auth, async (req, res) => {
    const requestedUuid = req.params.uuid;
    console.log(`Backend received ARCHIVE (DELETE) /api/v1/center/releases/${requestedUuid}`);
    try {
        const releaseToArchive = await CenterRelease.findOne({ uuid: requestedUuid });
        if (!releaseToArchive) return res.status(404).json({ success: false, error: 'Release not found.' });
        // Check permissions: platform_admin can archive any release, others can only archive their own client's releases
        if (req.user.role !== 'platform_admin') {
            if (!req.user.clientId || !releaseToArchive.clientId || releaseToArchive.clientId.toString() !== req.user.clientId.toString()) {
                return res.status(403).json({ success: false, error: 'Forbidden.' });
            }
        }
        releaseToArchive.status = 'archived';
        releaseToArchive.updatedBy = req.user.id;
        await releaseToArchive.save();
        res.status(200).json({ success: true, message: `Release '${releaseToArchive.title}' archived successfully.` });
    } catch (error) {
        console.error(`Error archiving release ${requestedUuid}:`, error);
        res.status(500).json({ success: false, error: 'Server error while archiving release.' });
    }
});

// <<< MODIFICATION: NEW DOWNLOAD AND LOGGING ENDPOINT >>>
// GET /api/v1/center/assets/download/:assetId
router.get('/assets/download/:assetId', async (req, res) => {
    try {
        const assetId = req.params.assetId;
        
        // --- THE FIX ---
        // Find the parent release document that contains the asset sub-document.
        const release = await CenterRelease.findOne({
            $or: [
                { 'releaseDocs._id': assetId },
                { 'images._id': assetId },
                { 'videos._id': assetId },
                { 'supplementaryDocs._id': assetId },
                { 'cardTeaserImageMeta._id': assetId }
            ]
        });

        if (!release) {
            console.error(`Download failed: Could not find any release containing asset with ID: ${assetId}`);
            return res.status(404).json({ success: false, error: 'Asset not found within any release.' });
        }

        // Now, find the specific asset object within the release's arrays.
        const asset = [
            ...(release.releaseDocs || []),
            ...(release.images || []),
            ...(release.videos || []),
            ...(release.supplementaryDocs || []),
            ...(release.cardTeaserImageMeta ? [release.cardTeaserImageMeta] : [])
        ].find(doc => doc._id.toString() === assetId);

        if (!asset) {
            console.error(`Download failed: Found release "${release.title}" but asset metadata for ID ${assetId} is missing.`);
            return res.status(404).json({ success: false, error: 'Asset metadata mismatch within the release.' });
        }
        
        // Simple file serving - tracking is handled by universalDownloadTracker middleware
        const fileName = asset.originalName || `asset-${assetId}`;
        const filePath = path.join(__dirname, '..', 'public', asset.path);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found on disk: ${filePath}`);
            return res.status(404).json({ success: false, error: 'File not found on server.' });
        }

        // Get file stats
        const fileStats = fs.statSync(filePath);
        
        // ANALYTICS TRACKING - Creates records for amc-analytics.html dashboard
        try {
            const { AMCInteraction } = require('../models/AMCAnalytics'); // <-- fix path

            // Figure out which bucket this asset belongs to
            const isReleaseDoc =
                Array.isArray(release.releaseDocs) &&
                release.releaseDocs.some(d => d._id.toString() === assetId);

            const isSupplementaryDoc =
                Array.isArray(release.supplementaryDocs) &&
                release.supplementaryDocs.some(d => d._id.toString() === assetId);

            const isImage =
                (Array.isArray(release.images) &&
                 release.images.some(i => i._id.toString() === assetId)) ||
                (release.cardTeaserImageMeta &&
                 release.cardTeaserImageMeta._id &&
                 release.cardTeaserImageMeta._id.toString() === assetId);

            const isVideo =
                Array.isArray(release.videos) &&
                release.videos.some(v => v._id.toString() === assetId);

            let assetType = 'other';
            if (isImage) assetType = 'image';
            else if (isVideo) assetType = 'video';
            else if (isReleaseDoc || isSupplementaryDoc) assetType = 'document';

            const mongoose = require('mongoose');
            const interaction = new AMCInteraction({
                userId: req.user?.id || new mongoose.Types.ObjectId(),
                userEmail: req.user?.email || 'anonymous@example.com',
                sessionId: req.sessionID || `session_${Date.now()}`,
                interactionType: 'asset_download',

                releaseId: release._id,
                releaseUuid: release.uuid,
                releaseTitle: release.title,

                assetType,
                assetName: fileName,
                assetPath: filePath,
                assetSize: fileStats.size,

                userAgent: req.get('User-Agent') || 'unknown',
                ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
                referrer: req.get('Referer') || null,

                country: 'Germany',
                region: 'Europe',
                city: 'Berlin',

                timestamp: new Date(),
                metadata: {
                    downloadSource: 'main_page',
                    clientId: req.user?.clientId || release.clientId || null,
                    userRole: req.user?.role || 'anonymous',
                    realTimeTracking: true,
                    mimeType: asset.mimetype || null,
                    isReleaseDoc,
                    isSupplementaryDoc
                }
            });

            await interaction.save();
            console.log(`✅ ANALYTICS TRACKED: ${fileName} (${interaction.assetType}) - Will show in dashboard`);
            console.log(`🔍 DEBUG: AMCInteraction saved with ID: ${interaction._id}`);
            console.log(`🔍 DEBUG: Interaction data:`, JSON.stringify({
                interactionType: interaction.interactionType,
                assetType: interaction.assetType,
                assetName: interaction.assetName,
                releaseTitle: interaction.releaseTitle,
                clientId: interaction.metadata.clientId,
                timestamp: interaction.timestamp
            }, null, 2));
        } catch (trackError) {
            console.error('❌ Analytics tracking failed:', trackError);
        }

        // Set basic headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', asset.mimetype || 'application/octet-stream');
        res.setHeader('Content-Length', fileStats.size);
        
        // Use res.download for proper file download - universalDownloadTracker will handle analytics
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error("❌ Error serving file for download:", err);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: 'Error downloading file.' });
                }
            } else {
                console.log(`✅ SUCCESS: File downloaded - ${fileName} (${fileStats.size} bytes)`);
            }
        });

    } catch (error) {
        console.error('General download endpoint error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Server error during download process.' });
        }
    }
});
// <<< END MODIFICATION >>>

// Helper function to convert plain text to formatted HTML with better formatting preservation
function formatTextToHtml(plainText) {
    if (!plainText) return '';
    
    return plainText
        // Split by double line breaks to create paragraphs
        .split(/\n\s*\n/)
        .map(paragraph => {
            // Clean up the paragraph and wrap in <p> tags
            const cleanParagraph = paragraph
                .trim()
                .replace(/\n/g, ' ') // Replace single line breaks with spaces
                .replace(/\s+/g, ' '); // Replace multiple spaces with single space
            
            return cleanParagraph ? `<p>${cleanParagraph}</p>` : '';
        })
        .filter(p => p) // Remove empty paragraphs
        .join('\n');
}

// Improved function to format text from unpdf with better structure preservation
function formatUnpdfTextToHtml(unpdfResult) {
    if (!unpdfResult || !unpdfResult.text || !Array.isArray(unpdfResult.text)) {
        return '';
    }
    
    return unpdfResult.text
        .map(pageText => {
            if (!pageText) return '';
            
            // Split by double line breaks for paragraphs, but preserve single line breaks within paragraphs
            return pageText
                .split(/\n\s*\n/)
                .map(paragraph => {
                    const cleanParagraph = paragraph
                        .trim()
                        .replace(/\n/g, '<br>') // Preserve line breaks as HTML breaks
                        .replace(/\s+/g, ' '); // Replace multiple spaces with single space
                    
                    return cleanParagraph ? `<p>${cleanParagraph}</p>` : '';
                })
                .filter(p => p)
                .join('\n');
        })
        .filter(pageHtml => pageHtml)
        .join('\n\n'); // Separate pages with double line breaks
}

// GET /api/v1/center/releases/:uuid/extract-pdf-text - Extract text from PDF media release
router.get('/releases/:uuid/extract-pdf-text', async (req, res) => {
    const requestedUuid = req.params.uuid;
    console.log(`Backend received GET /api/v1/center/releases/${requestedUuid}/extract-pdf-text`);
    
    try {
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(requestedUuid)) {
            return res.status(400).json({ success: false, error: 'Invalid Release UUID format.' });
        }

        const release = await CenterRelease.findOne({ uuid: requestedUuid, status: 'published' });
        if (!release) {
            return res.status(404).json({ success: false, error: 'Published release not found.' });
        }

        // Check if text has already been extracted
        if (release.pdfTextExtracted && release.extractedPdfText) {
            return res.status(200).json({
                success: true,
                data: {
                    extractedText: release.extractedPdfText,
                    cached: true
                }
            });
        }

        // Find the first PDF in releaseDocs
        const pdfDoc = release.releaseDocs.find(doc => doc.mimetype === 'application/pdf');
        if (!pdfDoc) {
            return res.status(404).json({ success: false, error: 'No PDF media release found for this release.' });
        }

        // Extract text from PDF
        const pdfPath = path.join(__dirname, '..', 'public', pdfDoc.path);
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ success: false, error: 'PDF file not found on server.' });
        }

        try {
            const dataBuffer = fs.readFileSync(pdfPath);
            
            // Try unpdf first (better formatting preservation)
            try {
                const uint8Array = new Uint8Array(dataBuffer);
                const unpdfResult = await extractText(uint8Array);
                const formattedText = formatUnpdfTextToHtml(unpdfResult);

                // Save formatted text to database
                release.extractedPdfText = formattedText;
                release.pdfTextExtracted = true;
                await release.save();

                console.log(`SUCCESS: PDF text extracted with unpdf for release: ${release.title}`);
                res.status(200).json({
                    success: true,
                    data: {
                        extractedText: formattedText,
                        cached: false,
                        method: 'unpdf'
                    }
                });
                return;
            } catch (unpdfError) {
                console.warn('unpdf extraction failed, falling back to pdf-parse:', unpdfError.message);
            }
            
            // Fallback to pdf-parse if unpdf fails
            const pdfData = await pdf(dataBuffer);
            const rawText = pdfData.text;
            
            // Convert plain text to formatted HTML
            const formattedText = formatTextToHtml(rawText);

            // Save formatted text to database
            release.extractedPdfText = formattedText;
            release.pdfTextExtracted = true;
            await release.save();

            console.log(`SUCCESS: PDF text extracted with pdf-parse fallback for release: ${release.title}`);
            res.status(200).json({
                success: true,
                data: {
                    extractedText: formattedText,
                    cached: false,
                    method: 'pdf-parse'
                }
            });

        } catch (pdfError) {
            console.error('Error extracting PDF text:', pdfError);
            res.status(500).json({ success: false, error: 'Failed to extract text from PDF.' });
        }

    } catch (error) {
        console.error(`Error in PDF text extraction for ${requestedUuid}:`, error);
        res.status(500).json({ success: false, error: 'Server error while extracting PDF text.' });
    }
});

// POST /api/v1/center/releases/:uuid/regenerate-thumbnails - Regenerate video thumbnails for existing release
router.post('/releases/:uuid/regenerate-thumbnails', auth, async (req, res) => {
    const requestedUuid = req.params.uuid;
    console.log(`Backend received POST /api/v1/center/releases/${requestedUuid}/regenerate-thumbnails`);
    
    try {
        if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(requestedUuid)) {
            return res.status(400).json({ success: false, error: 'Invalid Release UUID format.' });
        }

        const release = await CenterRelease.findOne({ uuid: requestedUuid });
        if (!release) {
            return res.status(404).json({ success: false, error: 'Release not found.' });
        }

        // Check permissions
        // Check permissions: platform_admin can regenerate thumbnails for any release, others only for their own client's releases
        if (req.user.role !== 'platform_admin') {
            if (!req.user.clientId || !release.clientId || release.clientId.toString() !== req.user.clientId.toString()) {
                return res.status(403).json({ success: false, error: 'Forbidden.' });
            }
        }

        let thumbnailsGenerated = 0;
        let thumbnailsFailed = 0;

        // Process all videos in the release
        for (let i = 0; i < release.videos.length; i++) {
            const video = release.videos[i];
            
            // Skip if thumbnail already exists
            if (video.thumbPath) {
                console.log(`Thumbnail already exists for video: ${video.originalName}`);
                continue;
            }

            // Only process video files
            if (video.mimetype && video.mimetype.startsWith('video/')) {
                try {
                    const videoPath = path.join(__dirname, '..', 'public', video.path);
                    
                    // Check if video file exists
                    if (!fs.existsSync(videoPath)) {
                        console.warn(`Video file not found: ${videoPath}`);
                        thumbnailsFailed++;
                        continue;
                    }

                    const filename = path.basename(video.path);
                    const thumbnailFilename = `thumb_${filename.replace(/\.[^/.]+$/, '')}.jpg`;
                    const thumbnailPath = path.join(uploadDir, thumbnailFilename);
                    
                    await generateVideoThumbnail(videoPath, thumbnailPath);
                    
                    // Update the video object with thumbnail path
                    release.videos[i].thumbPath = `/uploads/center_assets/${thumbnailFilename}`;
                    thumbnailsGenerated++;
                    
                    console.log(`Thumbnail generated for existing video: ${video.originalName}`);
                } catch (thumbError) {
                    console.warn(`Failed to generate thumbnail for existing video ${video.originalName}:`, thumbError.message);
                    thumbnailsFailed++;
                }
            }
        }

        // Save the updated release
        if (thumbnailsGenerated > 0) {
            await release.save();
        }

        res.status(200).json({
            success: true,
            message: `Thumbnail regeneration completed for release: ${release.title}`,
            data: {
                thumbnailsGenerated,
                thumbnailsFailed,
                totalVideos: release.videos.length
            }
        });

    } catch (error) {
        console.error(`Error regenerating thumbnails for ${requestedUuid}:`, error);
        res.status(500).json({ success: false, error: 'Server error while regenerating thumbnails.' });
    }
});

// GET /api/v1/center/releases/:uuid/download-all - Download all assets for a release
router.get('/releases/:uuid/download-all', async (req, res) => {
    const requestedUuid = req.params.uuid;
    console.log(`🚀 CENTER DOWNLOAD-ALL ROUTE HIT for UUID: ${requestedUuid}`);
    
    try {
        // Get release data by UUID
        const release = await CenterRelease.findOne({ uuid: requestedUuid, status: 'published' });
        if (!release) {
            return res.status(404).json({ success: false, error: 'Release not found' });
        }

        console.log(`📦 Download for release "${release.title}" initiated.`);
        
        // Redirect to the ZIP download endpoint
        res.redirect(`/api/v1/zip/release/${requestedUuid}/zip`);
        
    } catch (error) {
        console.error('❌ Center download-all error:', error);
        res.status(500).json({
            error: 'Failed to initiate download',
            details: error.message
        });
    }
});

module.exports = router;