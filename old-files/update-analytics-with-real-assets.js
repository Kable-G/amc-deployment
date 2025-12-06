// Update analytics data with real asset names from actual releases
const mongoose = require('mongoose');

// Import models
require('./models/CenterRelease');
require('./models/AMCAnalytics');

const CenterRelease = mongoose.model('CenterRelease');
const AMCInteraction = mongoose.model('AMCInteraction');

async function updateAnalyticsWithRealAssets() {
    try {
        console.log('🔄 Fetching real releases and their assets...');
        
        // Get real releases with assets
        const releases = await CenterRelease.find({ 
            status: 'published',
            assets: { $exists: true, $not: { $size: 0 } }
        }).limit(10).lean();
        
        console.log(`📊 Found ${releases.length} releases with assets`);
        
        if (releases.length === 0) {
            console.log('❌ No releases with assets found.');
            return;
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
            console.log('❌ No assets with filenames found.');
            return;
        }
        
        // Update existing download interactions with real asset names
        console.log('🔄 Updating download interactions with real asset names...');
        
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
        
        // Show some examples
        const updatedInteractions = await AMCInteraction.find({ 
            interactionType: 'asset_download' 
        }).limit(5);
        
        console.log('\n📋 Sample updated interactions:');
        updatedInteractions.forEach((interaction, index) => {
            console.log(`  ${index + 1}. ${interaction.assetName} from "${interaction.releaseTitle}"`);
        });
        
    } catch (error) {
        console.error('❌ Error updating analytics data:', error);
    }
}

function getAssetTypeFromFilename(filename) {
    if (!filename) return 'document';
    
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'wmv', 'webm'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return 'document';
    return 'other';
}

// Export the function so it can be called from the server
module.exports = { updateAnalyticsWithRealAssets };

// If run directly, execute the function
if (require.main === module) {
    // Connect to MongoDB
    mongoose.connect('mongodb://localhost:27017/amc_platform', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('📡 Connected to MongoDB');
        return updateAnalyticsWithRealAssets();
    }).then(() => {
        console.log('🎉 Analytics update completed!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
}