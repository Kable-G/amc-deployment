/**
 * Comprehensive Download Routes - Handles all download scenarios across the platform
 * Covers: Quick view downloads, PDF header downloads, direct asset links, bulk downloads, etc.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { manualTrackDownload } = require('../middleware/universalDownloadTracker');
const CenterRelease = require('../models/CenterRelease');

// @route   GET /api/v1/downloads/quick-view/:assetId
// @desc    Download asset from quick view modal
// @access  Private
router.get('/quick-view/:assetId', auth, async (req, res) => {
    try {
        const { assetId } = req.params;
        console.log(`📱 Quick view download request for asset: ${assetId}`);

        // Find the release containing this asset
        const release = await CenterRelease.findOne({
            $or: [
                { 'images._id': assetId },
                { 'videos._id': assetId },
                { 'releaseDocs._id': assetId },
                { 'supplementaryDocs._id': assetId },
                { 'cardTeaserImageMeta._id': assetId }
            ]
        });

        if (!release) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }

        // Find the specific asset
        const allAssets = [
            ...(release.images || []).map(a => ({ ...a, category: 'image' })),
            ...(release.videos || []).map(a => ({ ...a, category: 'video' })),
            ...(release.releaseDocs || []).map(a => ({ ...a, category: 'document' })),
            ...(release.supplementaryDocs || []).map(a => ({ ...a, category: 'document' })),
            ...(release.cardTeaserImageMeta ? [{ ...release.cardTeaserImageMeta, category: 'image' }] : [])
        ];
        
        const asset = allAssets.find(a => a._id.toString() === assetId);
        if (!asset) {
            return res.status(404).json({ success: false, error: 'Asset metadata not found' });
        }

        const filePath = path.join(__dirname, '..', 'public', asset.path);
        const fileName = asset.originalName || `asset-${assetId}`;

        // Check file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found on server' });
        }

        const fileStats = fs.statSync(filePath);

        // Track download
        await manualTrackDownload(req, res, {
            filename: fileName,
            filePath: filePath,
            releaseId: release._id,
            assetId: assetId,
            downloadSource: 'quick_view',
            assetType: asset.category,
            assetSize: fileStats.size,
            mimeType: asset.mimetype
        });
        
        console.log(`🔍 DEBUG: Quick view download tracked via manualTrackDownload for ${fileName}`);

        // Set headers and download
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', asset.mimetype || 'application/octet-stream');
        res.setHeader('X-Download-Source', 'quick_view');
        
        res.download(filePath, fileName);

    } catch (error) {
        console.error('❌ Quick view download error:', error);
        res.status(500).json({ success: false, error: 'Server error during download' });
    }
});

// @route   GET /api/v1/downloads/pdf-header/:assetId
// @desc    Download asset from PDF header/toolbar
// @access  Private
router.get('/pdf-header/:assetId', auth, async (req, res) => {
    try {
        const { assetId } = req.params;
        console.log(`📄 PDF header download request for asset: ${assetId}`);

        // Similar logic but with different tracking source
        const release = await CenterRelease.findOne({
            $or: [
                { 'releaseDocs._id': assetId },
                { 'supplementaryDocs._id': assetId }
            ]
        });

        if (!release) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        const allDocs = [
            ...(release.releaseDocs || []),
            ...(release.supplementaryDocs || [])
        ];
        
        const document = allDocs.find(doc => doc._id.toString() === assetId);
        if (!document) {
            return res.status(404).json({ success: false, error: 'Document metadata not found' });
        }

        const filePath = path.join(__dirname, '..', 'public', document.path);
        const fileName = document.originalName || `document-${assetId}`;

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found on server' });
        }

        const fileStats = fs.statSync(filePath);

        // Track download
        await manualTrackDownload(req, res, {
            filename: fileName,
            filePath: filePath,
            releaseId: release._id,
            assetId: assetId,
            downloadSource: 'pdf_header',
            assetType: 'document',
            assetSize: fileStats.size,
            mimeType: document.mimetype
        });
        
        console.log(`🔍 DEBUG: PDF header download tracked via manualTrackDownload for ${fileName}`);

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', document.mimetype || 'application/pdf');
        res.setHeader('X-Download-Source', 'pdf_header');
        
        res.download(filePath, fileName);

    } catch (error) {
        console.error('❌ PDF header download error:', error);
        res.status(500).json({ success: false, error: 'Server error during download' });
    }
});

// @route   GET /api/v1/downloads/direct/:releaseUuid/:filename
// @desc    Direct download link for assets by filename
// @access  Private
router.get('/direct/:releaseUuid/:filename', auth, async (req, res) => {
    try {
        const { releaseUuid, filename } = req.params;
        console.log(`🔗 Direct download request for: ${filename} in release: ${releaseUuid}`);

        const release = await CenterRelease.findOne({ uuid: releaseUuid });
        if (!release) {
            return res.status(404).json({ success: false, error: 'Release not found' });
        }

        // Search for asset by filename
        const allAssets = [
            ...(release.images || []).map(a => ({ ...a, category: 'image' })),
            ...(release.videos || []).map(a => ({ ...a, category: 'video' })),
            ...(release.releaseDocs || []).map(a => ({ ...a, category: 'document' })),
            ...(release.supplementaryDocs || []).map(a => ({ ...a, category: 'document' }))
        ];

        const asset = allAssets.find(a => 
            a.originalName === filename || 
            a.filename === filename ||
            a.path?.includes(filename)
        );

        if (!asset) {
            return res.status(404).json({ success: false, error: 'Asset not found' });
        }

        const filePath = path.join(__dirname, '..', 'public', asset.path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'File not found on server' });
        }

        const fileStats = fs.statSync(filePath);

        // Track download
        await manualTrackDownload(req, res, {
            filename: filename,
            filePath: filePath,
            releaseId: release._id,
            assetId: asset._id,
            downloadSource: 'direct_link',
            assetType: asset.category,
            assetSize: fileStats.size,
            mimeType: asset.mimetype
        });
        
        console.log(`🔍 DEBUG: Direct link download tracked via manualTrackDownload for ${filename}`);

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', asset.mimetype || 'application/octet-stream');
        res.setHeader('X-Download-Source', 'direct_link');
        
        res.download(filePath, filename);

    } catch (error) {
        console.error('❌ Direct download error:', error);
        res.status(500).json({ success: false, error: 'Server error during download' });
    }
});

// @route   POST /api/v1/downloads/bulk
// @desc    Bulk download multiple assets as ZIP (DISABLED - requires archiver package)
// @access  Private
router.post('/bulk', auth, async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'Bulk download feature temporarily disabled. Install archiver package to enable.'
    });
});

// @route   GET /api/v1/downloads/image-preview/:assetId
// @desc    Download high-resolution image from preview
// @access  Private
router.get('/image-preview/:assetId', auth, async (req, res) => {
    try {
        const { assetId } = req.params;
        console.log(`🖼️ Image preview download request for: ${assetId}`);

        const release = await CenterRelease.findOne({
            $or: [
                { 'images._id': assetId },
                { 'cardTeaserImageMeta._id': assetId }
            ]
        });

        if (!release) {
            return res.status(404).json({ success: false, error: 'Image not found' });
        }

        const allImages = [
            ...(release.images || []),
            ...(release.cardTeaserImageMeta ? [release.cardTeaserImageMeta] : [])
        ];

        const image = allImages.find(img => img._id.toString() === assetId);
        if (!image) {
            return res.status(404).json({ success: false, error: 'Image metadata not found' });
        }

        const filePath = path.join(__dirname, '..', 'public', image.path);
        const fileName = image.originalName || `image-${assetId}`;

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'Image file not found' });
        }

        const fileStats = fs.statSync(filePath);

        // DISABLED: Manual tracking - preventing 2:1 duplication
        // await manualTrackDownload(req, res, { ... });

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', image.mimetype || 'image/jpeg');
        res.setHeader('X-Download-Source', 'image_preview');
        
        res.download(filePath, fileName);

    } catch (error) {
        console.error('❌ Image preview download error:', error);
        res.status(500).json({ success: false, error: 'Server error during image download' });
    }
});

// @route   GET /api/v1/downloads/video-stream/:assetId
// @desc    Download video file from video player
// @access  Private
router.get('/video-stream/:assetId', auth, async (req, res) => {
    try {
        const { assetId } = req.params;
        console.log(`🎥 Video download request for: ${assetId}`);

        const release = await CenterRelease.findOne({
            'videos._id': assetId
        });

        if (!release) {
            return res.status(404).json({ success: false, error: 'Video not found' });
        }

        const video = release.videos.find(vid => vid._id.toString() === assetId);
        if (!video) {
            return res.status(404).json({ success: false, error: 'Video metadata not found' });
        }

        const filePath = path.join(__dirname, '..', 'public', video.path);
        const fileName = video.originalName || `video-${assetId}`;

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'Video file not found' });
        }

        const fileStats = fs.statSync(filePath);

        // Track download
        await manualTrackDownload(req, res, {
            filename: fileName,
            filePath: filePath,
            releaseId: release._id,
            assetId: assetId,
            downloadSource: 'video_player',
            assetType: 'video',
            assetSize: fileStats.size,
            mimeType: video.mimetype
        });
        
        console.log(`🔍 DEBUG: Video download tracked via manualTrackDownload for ${fileName}`);

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', video.mimetype || 'video/mp4');
        res.setHeader('X-Download-Source', 'video_player');
        
        res.download(filePath, fileName);

    } catch (error) {
        console.error('❌ Video download error:', error);
        res.status(500).json({ success: false, error: 'Server error during video download' });
    }
});

// @route   GET /api/v1/downloads/stats
// @desc    Get download statistics for analytics
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        const { getDownloadStatistics } = require('../middleware/universalDownloadTracker');
        
        const stats = await getDownloadStatistics(timeframe);
        
        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Download stats error:', error);
        res.status(500).json({ success: false, error: 'Server error fetching download stats' });
    }
});

module.exports = router;