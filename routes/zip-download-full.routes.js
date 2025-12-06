const express = require('express');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');
const router = express.Router();

console.log('📦 Full ZIP Download routes module loaded successfully');

// Test route to verify routing works
router.get('/test', (req, res) => {
    console.log('🧪 FULL ZIP TEST ROUTE HIT - ZIP routes are working!');
    res.json({ message: 'Full ZIP routes are working!', timestamp: new Date().toISOString() });
});

// Complete ZIP Download endpoint with archiver
router.get('/release/:releaseId/zip', async (req, res) => {
    console.log('🚀 FULL ZIP DOWNLOAD ROUTE HIT!');
    console.log('📋 Request params:', req.params);
    
    const { releaseId } = req.params;
    
    try {
        // Set response headers for ZIP download
        const zipFileName = `AMC_Release_${releaseId}_${Date.now()}.zip`;
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
        
        // For testing, create some sample files
        console.log('📝 Adding sample files to ZIP...');
        
        // Add sample text files
        archive.append('This is a sample image file for release ' + releaseId, { 
            name: 'Images/sample_image_info.txt' 
        });
        
        archive.append('This is a sample video file for release ' + releaseId, { 
            name: 'Videos/sample_video_info.txt' 
        });
        
        archive.append('This is a sample document for release ' + releaseId, { 
            name: 'Documents/sample_document.txt' 
        });
        
        // Add release metadata
        const metadata = {
            releaseId: releaseId,
            downloadedAt: new Date().toISOString(),
            downloadedBy: 'AutoMediaCenter User',
            version: '1.0.0',
            totalFiles: 3,
            folders: ['Images', 'Videos', 'Documents']
        };
        
        archive.append(JSON.stringify(metadata, null, 2), { 
            name: 'release_metadata.json' 
        });
        
        console.log('✅ All files added to ZIP, finalizing...');
        
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
    }
});

// ZIP download with database integration (for future use)
router.get('/release/:releaseId/zip-db', async (req, res) => {
    console.log('🗄️ DATABASE ZIP DOWNLOAD ROUTE HIT!');
    console.log('📋 Request params:', req.params);
    
    const { releaseId } = req.params;
    
    try {
        // TODO: Add database connection and real file fetching
        // const Release = require('../models/Release');
        // const release = await Release.findById(releaseId);
        
        res.json({
            success: true,
            message: 'Database ZIP endpoint reached (not yet implemented)',
            releaseId: releaseId,
            timestamp: new Date().toISOString(),
            note: 'This endpoint will fetch real files from database'
        });
        
    } catch (error) {
        console.error('❌ Database ZIP error:', error);
        res.status(500).json({ 
            error: 'Database ZIP download failed', 
            details: error.message 
        });
    }
});

module.exports = router;