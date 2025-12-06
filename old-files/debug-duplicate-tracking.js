/**
 * Debug Duplicate Tracking - Find why downloads are being counted multiple times
 */

const mongoose = require('mongoose');
const { AMCInteraction } = require('./models/AMCAnalytics');

async function debugDuplicateTracking() {
    try {
        console.log('🔍 Debugging duplicate tracking issue...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/amc', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Check recent interactions (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        console.log(`📊 Checking for interactions since ${fiveMinutesAgo.toISOString()}`);
        
        const recentInteractions = await AMCInteraction.find({
            timestamp: { $gte: fiveMinutesAgo }
        }).sort({ timestamp: -1 });

        console.log(`\n📈 Found ${recentInteractions.length} recent interactions:`);
        
        if (recentInteractions.length === 0) {
            console.log('❌ No recent interactions found!');
        } else {
            // Group by timestamp to find duplicates
            const groupedByTime = {};
            
            recentInteractions.forEach((interaction) => {
                const timeKey = interaction.timestamp.toISOString();
                if (!groupedByTime[timeKey]) {
                    groupedByTime[timeKey] = [];
                }
                groupedByTime[timeKey].push(interaction);
            });

            console.log('\n🔍 Analyzing for duplicates:');
            
            Object.entries(groupedByTime).forEach(([timeKey, interactions]) => {
                if (interactions.length > 1) {
                    console.log(`\n⚠️  DUPLICATE FOUND at ${timeKey}:`);
                    interactions.forEach((interaction, index) => {
                        console.log(`   ${index + 1}. ${interaction.interactionType} - ${interaction.assetName || 'N/A'}`);
                        console.log(`      Source: ${interaction.metadata?.downloadSource || 'N/A'}`);
                        console.log(`      Session: ${interaction.sessionId}`);
                        console.log(`      User: ${interaction.userEmail}`);
                        console.log(`      Metadata: ${JSON.stringify(interaction.metadata)}`);
                    });
                } else {
                    console.log(`✅ Single interaction at ${timeKey}: ${interactions[0].interactionType}`);
                }
            });

            // Check for same asset downloaded multiple times in short period
            const downloads = recentInteractions.filter(i => i.interactionType === 'asset_download');
            
            if (downloads.length > 0) {
                console.log(`\n📥 Recent downloads (${downloads.length}):`);
                
                const downloadsByAsset = {};
                downloads.forEach(download => {
                    const assetKey = download.assetName || 'Unknown';
                    if (!downloadsByAsset[assetKey]) {
                        downloadsByAsset[assetKey] = [];
                    }
                    downloadsByAsset[assetKey].push(download);
                });

                Object.entries(downloadsByAsset).forEach(([assetName, assetDownloads]) => {
                    if (assetDownloads.length > 1) {
                        console.log(`\n🚨 DUPLICATE DOWNLOADS for "${assetName}": ${assetDownloads.length} times`);
                        assetDownloads.forEach((download, index) => {
                            console.log(`   ${index + 1}. ${download.timestamp.toISOString()}`);
                            console.log(`      Source: ${download.metadata?.downloadSource || 'N/A'}`);
                            console.log(`      Method: ${download.metadata?.downloadMethod || 'N/A'}`);
                            console.log(`      Session: ${download.sessionId}`);
                        });
                    } else {
                        console.log(`✅ Single download: ${assetName}`);
                    }
                });
            }
        }

        // Check total image downloads
        const totalImageDownloads = await AMCInteraction.countDocuments({
            interactionType: 'asset_download',
            assetType: 'image'
        });
        
        console.log(`\n📊 Total image downloads in database: ${totalImageDownloads}`);

        // Check for different tracking sources
        const downloadSources = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download' } },
            { $group: { _id: '$metadata.downloadSource', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\n🎯 Downloads by source:');
        downloadSources.forEach(source => {
            console.log(`   ${source._id || 'Unknown'}: ${source.count}`);
        });

        // Check for tracking methods
        const trackingMethods = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download' } },
            { $group: { _id: '$metadata.downloadMethod', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\n🔧 Downloads by method:');
        trackingMethods.forEach(method => {
            console.log(`   ${method._id || 'Unknown'}: ${method.count}`);
        });

        console.log('\n📋 DIAGNOSIS:');
        if (recentInteractions.some(group => Object.values(groupedByTime).some(g => g.length > 1))) {
            console.log('🚨 PROBLEM: Multiple tracking systems are running simultaneously!');
            console.log('   This is causing the same download to be counted multiple times.');
            console.log('\n🔧 SOLUTIONS:');
            console.log('   1. Remove duplicate tracking middleware');
            console.log('   2. Disable old tracking system');
            console.log('   3. Clean up duplicate records');
        } else {
            console.log('✅ No obvious duplicates found in recent data');
        }

    } catch (error) {
        console.error('❌ Error debugging tracking:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run the debug
if (require.main === module) {
    debugDuplicateTracking();
}

module.exports = debugDuplicateTracking;