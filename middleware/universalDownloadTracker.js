/**
 * Universal Download Tracker - Captures ALL download events across the entire platform
 * Tracks downloads from: quick view modals, main release pages, PDF headers, direct links, 
 * image downloads, video downloads, document downloads, and any other asset downloads
 */

const { AMCInteraction } = require('../models/AMCAnalytics');
const DownloadEvent = require('../models/DownloadEvent');
const CenterRelease = require('../models/CenterRelease');
const path = require('path');
const fs = require('fs');

// Comprehensive asset type detection with media release support
function detectAssetType(filename, mimeType = null, releaseInfo = null) {
    if (!filename && !mimeType) return 'other';
    
    const name = (filename || '').toLowerCase();
    const mime = (mimeType || '').toLowerCase();
    
    // Image types
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'ico', 'raw', 'psd', 'ai', 'eps'];
    const imageMimes = ['image/', 'application/postscript'];
    
    // Video types
    const videoExts = ['mp4', 'mov', 'avi', 'wmv', 'webm', 'mkv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv', 'mts', 'mxf'];
    const videoMimes = ['video/'];
    
    // Document types (excluding PDFs which might be media releases)
    const documentExts = ['doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'xls', 'xlsx', 'ppt', 'pptx', 'odp', 'ods'];
    const documentMimes = ['application/msword', 'application/vnd.', 'text/'];
    
    // Audio types
    const audioExts = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'aiff', 'au', 'ra'];
    const audioMimes = ['audio/'];
    
    // Archive types
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'dmg', 'iso'];
    const archiveMimes = ['application/zip', 'application/x-rar', 'application/x-7z'];
    
    // Check by file extension
    if (name) {
        const ext = name.split('.').pop();
        if (imageExts.includes(ext)) return 'image';
        if (videoExts.includes(ext)) return 'video';
        if (audioExts.includes(ext)) return 'audio';
        if (archiveExts.includes(ext)) return 'archive';
        
        // Special handling for PDFs - check if it's a media release
        if (ext === 'pdf') {
            // If we have release info and this PDF is in releaseDocs, it's a media release
            if (releaseInfo?.asset?.category === 'document' &&
                releaseInfo?.release?.title) {
                return 'release';
            }
            // Check filename patterns that suggest media release
            const releasePatterns = [
                'press_release', 'media_release', 'news_release', 'announcement',
                'pressemitteilung', 'communique', 'comunicado', 'comunicato'
            ];
            if (releasePatterns.some(pattern => name.includes(pattern))) {
                return 'release';
            }
            // Default PDFs to document type
            return 'document';
        }
        
        if (documentExts.includes(ext)) return 'document';
    }
    
    // Check by MIME type
    if (mime) {
        if (imageMimes.some(m => mime.includes(m))) return 'image';
        if (videoMimes.some(m => mime.includes(m))) return 'video';
        if (audioMimes.some(m => mime.includes(m))) return 'audio';
        if (archiveMimes.some(m => mime.includes(m))) return 'archive';
        
        // Special handling for PDF MIME type
        if (mime.includes('application/pdf')) {
            // If we have release info and this PDF is in releaseDocs, it's a media release
            if (releaseInfo?.asset?.category === 'document' &&
                releaseInfo?.release?.title) {
                return 'release';
            }
            // Default PDFs to document type
            return 'document';
        }
        
        if (documentMimes.some(m => mime.includes(m))) return 'document';
    }
    
    return 'other';
}

// Get file size safely with multiple path attempts
function getFileSize(filePath) {
    if (!filePath) return null;
    
    const pathsToTry = [
        filePath,
        path.join(__dirname, '..', filePath),
        path.join(__dirname, '..', 'public', filePath),
        filePath.startsWith('public/') ? path.join(__dirname, '..', filePath) : path.join(__dirname, '..', 'public', filePath)
    ];
    
    for (const tryPath of pathsToTry) {
        try {
            if (fs.existsSync(tryPath)) {
                const stats = fs.statSync(tryPath);
                console.log(`📏 Found file size: ${tryPath} = ${stats.size} bytes`);
                return stats.size;
            }
        } catch (error) {
            // Continue to next path
        }
    }
    
    console.warn('❌ Could not get file size for any of these paths:', pathsToTry);
    return null;
}

// Enhanced asset info extraction from release
async function getAssetInfoFromRelease(releaseId, assetId, filename, searchPath = null) {
    try {
        let release = null;
        
        // Try to find release by ID first
        if (releaseId) {
            release = await CenterRelease.findById(releaseId).lean();
        }
        
        // If no release found and we have a filename or path, search for it
        if (!release && (filename || searchPath)) {
            const searchTerm = filename || path.basename(searchPath || '');
            release = await CenterRelease.findOne({
                $or: [
                    { 'images.filename': searchTerm },
                    { 'images.originalName': searchTerm },
                    { 'images.path': { $regex: searchTerm, $options: 'i' } },
                    { 'videos.filename': searchTerm },
                    { 'videos.originalName': searchTerm },
                    { 'videos.path': { $regex: searchTerm, $options: 'i' } },
                    { 'releaseDocs.filename': searchTerm },
                    { 'releaseDocs.originalName': searchTerm },
                    { 'releaseDocs.path': { $regex: searchTerm, $options: 'i' } },
                    { 'supplementaryDocs.filename': searchTerm },
                    { 'supplementaryDocs.originalName': searchTerm },
                    { 'supplementaryDocs.path': { $regex: searchTerm, $options: 'i' } },
                    { 'assets.filename': searchTerm },
                    { 'assets.originalName': searchTerm },
                    { 'assets.path': { $regex: searchTerm, $options: 'i' } }
                ]
            }).lean();
        }
        
        if (!release) return null;
        
        // Search through all asset arrays
        const allAssets = [
            ...(release.images || []).map(a => ({ ...a, category: 'image' })),
            ...(release.videos || []).map(a => ({ ...a, category: 'video' })),
            ...(release.releaseDocs || []).map(a => ({ ...a, category: 'document' })),
            ...(release.supplementaryDocs || []).map(a => ({ ...a, category: 'document' })),
            ...(release.assets || []).map(a => ({ ...a, category: 'other' }))
        ];
        
        // Find the specific asset
        let asset = null;
        if (assetId) {
            asset = allAssets.find(a => a._id.toString() === assetId.toString());
        } else if (filename) {
            asset = allAssets.find(a => 
                a.filename === filename || 
                a.originalName === filename ||
                a.path?.includes(filename)
            );
        } else if (searchPath) {
            const searchName = path.basename(searchPath);
            asset = allAssets.find(a => 
                a.filename === searchName || 
                a.originalName === searchName ||
                a.path?.includes(searchName)
            );
        }
        
        return {
            release: {
                id: release._id,
                uuid: release.uuid,
                title: release.title || release.name,
                brand: release.brand,
                clientId: release.clientId
            },
            asset: asset ? {
                id: asset._id,
                name: asset.originalName || asset.filename || filename || 'Unknown Asset',
                type: detectAssetType(asset.originalName || asset.filename || filename),
                size: asset.size || null,
                category: asset.category,
                path: asset.path
            } : null
        };
    } catch (error) {
        console.error('Error getting asset info from release:', error);
        return null;
    }
}

// Get geographic data from IP (mock for now - integrate with real service)
async function getGeographicData(ipAddress) {
    // Mock data - replace with real IP geolocation service
    const regions = ['North America', 'Europe', 'Asia Pacific', 'South America', 'Africa', 'Middle East'];
    const countries = ['USA', 'Germany', 'UK', 'France', 'Japan', 'Canada', 'Australia', 'Brazil', 'India', 'China'];
    const cities = ['New York', 'Berlin', 'London', 'Paris', 'Tokyo', 'Toronto', 'Sydney', 'São Paulo', 'Mumbai', 'Shanghai'];
    
    return {
        country: countries[Math.floor(Math.random() * countries.length)],
        region: regions[Math.floor(Math.random() * regions.length)],
        city: cities[Math.floor(Math.random() * cities.length)]
    };
}

// Main tracking function - called from various download points
async function trackDownload(req, res, downloadInfo) {
    try {
        const {
            filename,
            filePath,
            releaseId,
            assetId,
            downloadSource = 'unknown', // 'quick_view', 'main_page', 'pdf_header', 'direct_link', etc.
            assetType: providedAssetType,
            assetSize: providedAssetSize,
            mimeType
        } = downloadInfo;
        
        console.log(`📥 Tracking download: ${filename} from ${downloadSource}`);
        
        // Extract request information
        const userId = req.user?.id || null;
        const userEmail = req.user?.email || 'anonymous@example.com';
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const referrer = req.get('Referer') || null;
        // Use userId if available, otherwise use a consistent session identifier
        const sessionId = req.user?.id
            ? `user_${req.user.id}`
            : (req.sessionID || req.session?.id || `anon_${req.ip}`);
        
        // Get release and asset information
        let releaseInfo = await getAssetInfoFromRelease(releaseId, assetId, filename, filePath);
        
        // Get file size from multiple sources
        let fileSize = providedAssetSize;
        
        // Try to get size from release info first
        if (!fileSize && releaseInfo?.asset?.size) {
            fileSize = releaseInfo.asset.size;
            console.log(`📏 Using asset size from release info: ${fileSize} bytes`);
        }
        
        // Fall back to filesystem if no size from release
        if (!fileSize && filePath) {
            fileSize = getFileSize(filePath);
        }
        
        // If still no size, try to estimate from existing files with similar names
        if (!fileSize && filename) {
            const estimatedSize = await estimateFileSizeFromSimilar(filename);
            if (estimatedSize) {
                fileSize = estimatedSize;
                console.log(`📏 Using estimated size for ${filename}: ${fileSize} bytes`);
            }
        }
        
        // Determine asset type with release context for media release detection
        const assetType = providedAssetType ||
                         releaseInfo?.asset?.type ||
                         detectAssetType(filename, mimeType, releaseInfo);
        
        // Get asset name
        const assetName = releaseInfo?.asset?.name || filename || 'Unknown Asset';
        
        // Get geographic data
        const geoData = await getGeographicData(ipAddress);
        
        // Create analytics interaction record
        const interaction = new AMCInteraction({
            userId: userId,
            userEmail: userEmail,
            sessionId: sessionId,
            interactionType: 'asset_download',
            
            // Release information
            releaseId: releaseInfo?.release?.id || null,
            releaseUuid: releaseInfo?.release?.uuid || null,
            releaseTitle: releaseInfo?.release?.title || null,
            
            // Asset information
            assetType: assetType,
            assetName: assetName,
            assetPath: filePath || null,
            assetSize: fileSize,
            
            // Technical details
            userAgent: userAgent,
            ipAddress: ipAddress,
            referrer: referrer,
            
            // Geographic data
            country: geoData.country,
            region: geoData.region,
            city: geoData.city,
            
            // Timing
            timestamp: new Date(),
            
            // Metadata
            metadata: {
                downloadSource: downloadSource,
                clientId: req.user?.clientId || releaseInfo?.release?.clientId || null,
                userRole: req.user?.role || 'anonymous',
                realTimeTracking: true,
                mimeType: mimeType || null,
                originalFilePath: filePath,
                assetCategory: releaseInfo?.asset?.category || 'unknown'
            }
        });
        
        // Save interaction to database
        await interaction.save();
        
        // DownloadEvent creation removed - using only AMCInteraction for analytics
        // This prevents duplicate counting in analytics dashboard
        
        console.log(`✅ Successfully tracked download: ${assetName} (${assetType}) from ${downloadSource}`);
        console.log(`🔍 DEBUG: Universal tracker saved AMCInteraction with ID: ${interaction._id}`);
        console.log(`🔍 DEBUG: Universal tracker data:`, JSON.stringify({
            interactionType: interaction.interactionType,
            assetType: interaction.assetType,
            assetName: interaction.assetName,
            releaseTitle: interaction.releaseTitle,
            clientId: interaction.metadata.clientId,
            downloadSource: interaction.metadata.downloadSource,
            timestamp: interaction.timestamp
        }, null, 2));
        
        return {
            success: true,
            message: 'Download tracked successfully',
            data: {
                assetName,
                assetType,
                downloadSource,
                releaseTitle: releaseInfo?.release?.title
            }
        };
        
    } catch (error) {
        console.error('❌ Error tracking download:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Middleware that intercepts all download-related responses
const universalDownloadTracker = (req, res, next) => {
    // Store original methods
    const originalDownload = res.download;
    const originalSendFile = res.sendFile;
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Flag to prevent double tracking - attached to request object
    // Only initialize if not already set (prevents reset on multiple middleware calls)
    if (req._downloadTracked === undefined) {
        req._downloadTracked = false;
    }
    
    // Override res.download
    res.download = function(filePath, filename, options, callback) {
        // Only track if not already tracked
        if (!req._downloadTracked) {
            req._downloadTracked = true;
            
            // Determine download source from URL
            let downloadSource = 'direct_download';
            if (req.originalUrl.includes('/quick-view/')) downloadSource = 'quick_view';
            else if (req.originalUrl.includes('/assets/download/')) downloadSource = 'main_page';
            else if (req.originalUrl.includes('/pdf/')) downloadSource = 'pdf_header';
            else if (req.originalUrl.includes('/vault/')) downloadSource = 'vault';
            
            // Track the download
            trackDownload(req, res, {
                filename: filename || path.basename(filePath),
                filePath: filePath,
                releaseId: req.params.releaseId || req.query.releaseId,
                assetId: req.params.assetId || req.query.assetId,
                downloadSource: downloadSource
            });
        }
        
        // Call original method
        return originalDownload.call(this, filePath, filename, options, callback);
    };
    
    // Override res.sendFile for file serving
    res.sendFile = function(filePath, options, callback) {
        // Only track if not already tracked and this is a download
        if (!req._downloadTracked) {
            const isDownload = res.get('Content-Disposition')?.includes('attachment') ||
                              req.originalUrl.includes('/download') ||
                              req.originalUrl.includes('/assets/') ||
                              filePath.includes('/uploads/');
            
            if (isDownload) {
                req._downloadTracked = true;
                
                let downloadSource = 'file_serve';
                if (req.originalUrl.includes('/uploads/center_assets/')) downloadSource = 'center_assets';
                else if (req.originalUrl.includes('/uploads/vault_assets/')) downloadSource = 'vault_assets';
                else if (req.originalUrl.includes('/uploads/radar_teasers/')) downloadSource = 'radar_teasers';
                
                trackDownload(req, res, {
                    filename: path.basename(filePath),
                    filePath: filePath,
                    releaseId: req.params.releaseId || req.query.releaseId,
                    assetId: req.params.assetId || req.query.assetId,
                    downloadSource: downloadSource
                });
            }
        }
        
        return originalSendFile.call(this, filePath, options, callback);
    };
    
    next();
};

// Express route handlers for specific download endpoints
const trackQuickViewDownload = async (req, res, next) => {
    req.downloadSource = 'quick_view';
    next();
};

const trackMainPageDownload = async (req, res, next) => {
    req.downloadSource = 'main_page';
    next();
};

const trackPDFHeaderDownload = async (req, res, next) => {
    req.downloadSource = 'pdf_header';
    next();
};

const trackDirectLinkDownload = async (req, res, next) => {
    req.downloadSource = 'direct_link';
    next();
};

// Manual tracking function for custom implementations
const manualTrackDownload = async (req, res, downloadInfo) => {
    return await trackDownload(req, res, downloadInfo);
};

// Function to get comprehensive download statistics
const getDownloadStatistics = async (timeframe = '24h', filters = {}) => {
    try {
        let startDate;
        const now = new Date();
        
        switch (timeframe) {
            case '1h':
                startDate = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
        
        const matchFilter = {
            interactionType: 'asset_download',
            timestamp: { $gte: startDate },
            ...filters
        };
        
        const stats = await AMCInteraction.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: null,
                    totalDownloads: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' },
                    assetTypes: { $addToSet: '$assetType' },
                    downloadSources: { $addToSet: '$metadata.downloadSource' },
                    topAssets: {
                        $push: {
                            name: '$assetName',
                            type: '$assetType',
                            source: '$metadata.downloadSource'
                        }
                    },
                    byAssetType: {
                        $push: {
                            type: '$assetType',
                            count: 1
                        }
                    },
                    bySource: {
                        $push: {
                            source: '$metadata.downloadSource',
                            count: 1
                        }
                    }
                }
            }
        ]);
        
        return stats[0] || {
            totalDownloads: 0,
            uniqueUsers: 0,
            assetTypes: [],
            downloadSources: [],
            topAssets: [],
            byAssetType: [],
            bySource: []
        };
        
    } catch (error) {
        console.error('Error getting download statistics:', error);
        return null;
    }
};

// Estimate file size from similar files in uploads directory
async function estimateFileSizeFromSimilar(filename) {
    try {
        const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.pdf', '.docx'];
        
        // Get file extension
        const ext = path.extname(filename.toLowerCase());
        if (!extensions.includes(ext)) return null;
        
        // Look for files with same extension in uploads directories
        const searchDirs = ['center_assets', 'vault_assets', 'radar_teasers'];
        let totalSize = 0;
        let fileCount = 0;
        
        for (const dir of searchDirs) {
            const dirPath = path.join(uploadsDir, dir);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    if (path.extname(file.toLowerCase()) === ext) {
                        try {
                            const filePath = path.join(dirPath, file);
                            const stats = fs.statSync(filePath);
                            totalSize += stats.size;
                            fileCount++;
                            
                            // Stop after checking 10 files for performance
                            if (fileCount >= 10) break;
                        } catch (error) {
                            // Skip files that can't be read
                        }
                    }
                }
                if (fileCount >= 10) break;
            }
        }
        
        if (fileCount > 0) {
            const avgSize = Math.round(totalSize / fileCount);
            console.log(`📏 Estimated size for ${ext} files based on ${fileCount} samples: ${avgSize} bytes`);
            return avgSize;
        }
    } catch (error) {
        console.warn('Error estimating file size:', error.message);
    }
    
    return null;
}

module.exports = {
    universalDownloadTracker,
    trackQuickViewDownload,
    trackMainPageDownload,
    trackPDFHeaderDownload,
    trackDirectLinkDownload,
    manualTrackDownload,
    getDownloadStatistics,
    detectAssetType,
    trackDownload,
    estimateFileSizeFromSimilar
};