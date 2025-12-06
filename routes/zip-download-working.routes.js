const express = require('express');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const CenterRelease = require('../models/CenterRelease');
const router = express.Router();

console.log('📦 Working ZIP Download routes module loaded successfully');

// Track active downloads to prevent duplicates
const activeDownloads = new Map();

// Test route to verify routing works
router.get('/test', (req, res) => {
    console.log('🧪 WORKING ZIP TEST ROUTE HIT - ZIP routes are working!');
    res.json({ message: 'Working ZIP routes are working!', timestamp: new Date().toISOString() });
});

// Complete ZIP Download endpoint with real assets
router.get('/release/:releaseId/zip', async (req, res) => {
    console.log('🚀 WORKING ZIP DOWNLOAD ROUTE HIT!');
    console.log('📋 Request params:', req.params);
    
    const { releaseId } = req.params;
    
    // Check if this release is already being downloaded
    if (activeDownloads.has(releaseId)) {
        console.log('⚠️ Duplicate download request detected for release:', releaseId);
        console.log('🤝 Silently ignoring duplicate request - no error shown to user');
        return res.end(); // Silent termination
    }
    
    // Mark this release as being downloaded
    activeDownloads.set(releaseId, {
        startTime: Date.now(),
        clientIP: req.ip || req.connection.remoteAddress
    });
    console.log('🔒 Marked release as downloading:', releaseId);
    
    try {
        // Get release data by UUID
        console.log('🔍 Looking for release with UUID:', releaseId);
        const release = await CenterRelease.findOne({ uuid: releaseId });
        if (!release) {
            console.log('❌ Release not found for UUID:', releaseId);
            return res.status(404).json({ success: false, error: 'Release not found' });
        }

        console.log('✅ Found release:', release.title);

        // Create safe filename
        const safeTitle = release.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const zipFileName = `${safeTitle}_Media_Assets.zip`;
        
        // Set response headers for ZIP download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        res.setHeader('Cache-Control', 'no-cache');
        
        console.log('📁 Creating ZIP file:', zipFileName);
        
        // Create archiver instance
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });
        
        // Handle archiver errors
        archive.on('error', (err) => {
            console.error('❌ Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to create ZIP file', details: err.message });
            }
        });
        
        // Handle archiver warnings
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('⚠️ Archive warning:', err);
            } else {
                console.error('❌ Archive warning (critical):', err);
                throw err;
            }
        });
        
        // Track progress
        archive.on('progress', (progress) => {
            console.log(`📊 ZIP Progress: ${progress.entries.processed}/${progress.entries.total} files`);
        });
        
        // Pipe archive data to response
        archive.pipe(res);
        
        // Add files to archive
        let filesAdded = 0;
        const assetsIncluded = [];

        console.log('📝 Adding real assets to ZIP...');
        
        // Debug: Log all available fields in the release object
        const releaseObj = release.toObject ? release.toObject() : release;
        console.log('🔍 Available release fields:', Object.keys(releaseObj));
        
        // Check for documents in various possible field names (based on upload form fields)
        const possibleDocFields = [
            'mainReleaseFiles', 'mainReleaseDocuments', 'mainReleaseFile', 'mainReleaseDocument',
            'releaseDocs', 'releaseDocuments', 'documents', 'docs', 'attachments', 'files'
        ];
        let documentsFound = false;
        
        for (const fieldName of possibleDocFields) {
            if (release[fieldName] && Array.isArray(release[fieldName]) && release[fieldName].length > 0) {
                console.log(`📄 Found ${release[fieldName].length} documents in field '${fieldName}':`);
                documentsFound = true;
                
                for (const document of release[fieldName]) {
                    console.log(`   - Document: ${document.originalName || document.name || 'Unknown'} at ${document.path}`);
                    const docPath = path.join(__dirname, '..', 'public', document.path);
                    if (fs.existsSync(docPath)) {
                        const filename = path.basename(document.path);
                        archive.file(docPath, { name: `Documents/${filename}` });
                        assetsIncluded.push(`Documents/${filename}`);
                        filesAdded++;
                        console.log(`✅ Added document: ${filename}`);
                    } else {
                        console.log(`⚠️ Document file not found: ${docPath}`);
                    }
                }
                break; // Only process the first field that contains documents
            }
        }
        
        if (!documentsFound) {
            console.log('⚠️ No documents found in any of these fields:', possibleDocFields);
        }

        // Add images
        if (release.images && release.images.length > 0) {
            console.log(`📸 Adding ${release.images.length} images...`);
            for (const image of release.images) {
                const imagePath = path.join(__dirname, '..', 'public', image.path);
                if (fs.existsSync(imagePath)) {
                    const filename = path.basename(image.path);
                    archive.file(imagePath, { name: `Images/${filename}` });
                    assetsIncluded.push(`Images/${filename}`);
                    filesAdded++;
                    console.log(`✅ Added image: ${filename}`);
                } else {
                    console.log(`⚠️ Image file not found: ${imagePath}`);
                }
            }
        }

        // Add videos
        if (release.videos && release.videos.length > 0) {
            console.log(`🎥 Adding ${release.videos.length} videos...`);
            for (const video of release.videos) {
                const videoPath = path.join(__dirname, '..', 'public', video.path);
                if (fs.existsSync(videoPath)) {
                    const filename = path.basename(video.path);
                    archive.file(videoPath, { name: `Videos/${filename}` });
                    assetsIncluded.push(`Videos/${filename}`);
                    filesAdded++;
                    console.log(`✅ Added video: ${filename}`);
                } else {
                    console.log(`⚠️ Video file not found: ${videoPath}`);
                }
            }
        }

        // Add supplementary documents
        if (release.supplementaryDocs && release.supplementaryDocs.length > 0) {
            console.log(`📋 Adding ${release.supplementaryDocs.length} supplementary documents...`);
            for (const document of release.supplementaryDocs) {
                const docPath = path.join(__dirname, '..', 'public', document.path);
                if (fs.existsSync(docPath)) {
                    const filename = path.basename(document.path);
                    archive.file(docPath, { name: `Documents/${filename}` });
                    assetsIncluded.push(`Documents/${filename}`);
                    filesAdded++;
                    console.log(`✅ Added supplementary document: ${filename}`);
                } else {
                    console.log(`⚠️ Supplementary document file not found: ${docPath}`);
                }
            }
        }

        // Add press release text file (only if description exists)
        if (release.description) {
            const pressReleaseContent = `${release.title}\n\nPublished: ${release.releaseDate}\n\n${release.description}`;
            archive.append(pressReleaseContent, { name: 'Press_Release.txt' });
            assetsIncluded.push('Press_Release.txt');
            filesAdded++;
            console.log('✅ Added press release text');
        }

        // Check if any files were added
        if (filesAdded === 0) {
            archive.destroy();
            console.log('❌ No downloadable assets found for this release');
            return res.status(404).json({
                success: false,
                error: 'No downloadable assets found for this release'
            });
        }

        console.log(`✅ All ${filesAdded} files added to ZIP, finalizing...`);
        
        // Finalize the archive
        await archive.finalize();
        
        console.log('🎉 ZIP download completed successfully!');
        
    } catch (error) {
        console.error('❌ ZIP download error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to create ZIP download',
                details: error.message
            });
        }
    } finally {
        // Always clean up the active download tracking
        if (activeDownloads.has(releaseId)) {
            const downloadInfo = activeDownloads.get(releaseId);
            const duration = Date.now() - downloadInfo.startTime;
            console.log(`🔓 Releasing download lock for ${releaseId} (duration: ${duration}ms)`);
            activeDownloads.delete(releaseId);
        }
    }
});

// Note: The /download-all route is now handled by centerRoutes.js to avoid duplication

module.exports = router;