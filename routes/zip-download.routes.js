const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const CenterRelease = require('../models/CenterRelease');
const auth = require('../middleware/auth-bypass'); // FAKE AUTH - Always allows access

console.log('📦 ZIP Download routes module loaded successfully');

// Test route to verify routing works
router.get('/test', (req, res) => {
    console.log('🧪 TEST ROUTE HIT - ZIP routes are working!');
    res.json({ message: 'ZIP routes are working!', timestamp: new Date().toISOString() });
});

// ZIP Download endpoint for "Download All" functionality
router.get('/release/:releaseId/zip', auth, async (req, res) => {
    console.log('🚀 ZIP DOWNLOAD ROUTE HIT!');
    console.log('📋 Request params:', req.params);
    console.log('🔗 Full URL:', req.url);
    console.log('👤 User:', req.user);
    
    try {
        const { releaseId } = req.params;
        console.log('🔍 Looking for release with UUID:', releaseId);
        
        // Get release data by UUID (not MongoDB _id)
        const release = await CenterRelease.findOne({ uuid: releaseId });
        if (!release) {
            return res.status(404).json({ success: false, error: 'Release not found' });
        }

        // Track download attempt
        const downloadData = {
            userId: req.user?.email || 'anonymous',
            userLevel: req.user?.level || 1,
            releaseId: release._id,
            releaseTitle: release.title,
            downloadType: 'download_all_zip',
            timestamp: new Date().toISOString(),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        console.log('ZIP Download initiated:', downloadData);

        // Create safe filename
        const safeTitle = release.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        const zipFilename = `${safeTitle}_Media_Assets.zip`;

        // Set response headers for direct download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Handle archive errors
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Failed to create ZIP archive' });
            }
        });

        // Track when archive is finalized
        archive.on('end', () => {
            console.log('ZIP download completed:', {
                ...downloadData,
                fileSize: `${(archive.pointer() / 1024 / 1024).toFixed(2)}MB`,
                downloadCompleted: true
            });
        });

        // Pipe archive to response
        archive.pipe(res);

        // Add files to archive
        let filesAdded = 0;
        const assetsIncluded = [];

        // Add images
        if (release.images && release.images.length > 0) {
            for (const image of release.images) {
                const imagePath = path.join(__dirname, '..', 'public', image.path);
                if (fs.existsSync(imagePath)) {
                    const filename = path.basename(image.path);
                    archive.file(imagePath, { name: `Images/${filename}` });
                    assetsIncluded.push(filename);
                    filesAdded++;
                }
            }
        }

        // Add videos
        if (release.videos && release.videos.length > 0) {
            for (const video of release.videos) {
                const videoPath = path.join(__dirname, '..', 'public', video.path);
                if (fs.existsSync(videoPath)) {
                    const filename = path.basename(video.path);
                    archive.file(videoPath, { name: `Videos/${filename}` });
                    assetsIncluded.push(filename);
                    filesAdded++;
                }
            }
        }

        // Add documents
        if (release.documents && release.documents.length > 0) {
            for (const document of release.documents) {
                const docPath = path.join(__dirname, '..', 'public', document.path);
                if (fs.existsSync(docPath)) {
                    const filename = path.basename(document.path);
                    archive.file(docPath, { name: `Documents/${filename}` });
                    assetsIncluded.push(filename);
                    filesAdded++;
                }
            }
        }

        // Add press release text file
        if (release.description) {
            const pressReleaseContent = `${release.title}\n\n${release.description}`;
            archive.append(pressReleaseContent, { name: 'Press_Release.txt' });
            assetsIncluded.push('Press_Release.txt');
            filesAdded++;
        }

        // Check if any files were added
        if (filesAdded === 0) {
            archive.destroy();
            return res.status(404).json({ 
                success: false, 
                error: 'No downloadable assets found for this release' 
            });
        }

        // Update tracking data with assets
        downloadData.assetsIncluded = assetsIncluded;
        downloadData.totalFiles = filesAdded;

        // Finalize the archive
        archive.finalize();

    } catch (error) {
        console.error('ZIP download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Failed to create download' });
        }
    }
});

module.exports = router;