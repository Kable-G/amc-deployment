// Add this endpoint to your server to update analytics with real assets
const express = require('express');
const router = express.Router();

// Import models
const CenterRelease = require('../models/CenterRelease');
const { AMCInteraction } = require('../models/AMCAnalytics');

function getAssetTypeFromFilename(filename) {
    if (!filename) return 'document';
    
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'wmv', 'webm'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document';
    return 'other';
}

// Endpoint to update analytics with real asset names
router.post('/update-with-real-assets', async (req, res) => {
    try {
        console.log('🔄 Updating analytics with real asset names...');
        
        // Get real releases with assets
        const releases = await CenterRelease.find({ 
            status: 'published',
            assets: { $exists: true, $not: { $size: 0 } }
        }).limit(20).lean();
        
        console.log(`📊 Found ${releases.length} releases with assets`);
        
        if (releases.length === 0) {
            return res.json({ 
                success: false, 
                message: 'No releases with assets found' 
            });
        }
        
        // Collect all real assets
        const realAssets = [];
        releases.forEach(release => {
            release.assets.forEach(asset => {
                if (asset.filename || asset.originalName) {
                    realAssets.push({
                        filename: asset.filename || asset.originalName,
                        releaseTitle: release.title,
                        releaseId: release._id,
                        assetId: asset._id
                    });
                }
            });
        });
        
        console.log(`📁 Found ${realAssets.length} real assets`);
        
        if (realAssets.length === 0) {
            return res.json({ 
                success: false, 
                message: 'No assets with filenames found' 
            });
        }
        
        // Update existing download interactions with real asset names
        const downloadInteractions = await AMCInteraction.find({ 
            interactionType: 'asset_download' 
        });
        
        console.log(`📥 Found ${downloadInteractions.length} download interactions to update`);
        
        let updateCount = 0;
        for (const interaction of downloadInteractions) {
            // Pick a random real asset
            const randomAsset = realAssets[Math.floor(Math.random() * realAssets.length)];
            
            // Update the interaction with real asset data
            await AMCInteraction.updateOne(
                { _id: interaction._id },
                {
                    $set: {
                        assetName: randomAsset.filename,
                        releaseTitle: randomAsset.releaseTitle,
                        releaseId: randomAsset.releaseId,
                        assetId: randomAsset.assetId,
                        assetType: getAssetTypeFromFilename(randomAsset.filename)
                    }
                }
            );
            updateCount++;
        }
        
        console.log(`✅ Updated ${updateCount} download interactions with real asset names`);
        
        // Get some examples
        const updatedInteractions = await AMCInteraction.find({ 
            interactionType: 'asset_download' 
        }).limit(5);
        
        const examples = updatedInteractions.map(interaction => ({
            assetName: interaction.assetName,
            releaseTitle: interaction.releaseTitle,
            assetType: interaction.assetType
        }));
        
        res.json({
            success: true,
            message: `Updated ${updateCount} download interactions with real asset names`,
            data: {
                totalUpdated: updateCount,
                totalRealAssets: realAssets.length,
                totalReleases: releases.length,
                examples: examples
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating analytics data:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating analytics data',
            error: error.message
        });
    }
});

module.exports = router;