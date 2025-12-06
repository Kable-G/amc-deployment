/**
 * DEBUG SCRIPT - Check recent downloads and server activity
 */

const mongoose = require('mongoose');
const { AMCInteraction } = require('./models/AMCAnalytics');
require('dotenv').config();

async function debugDownloadTracking() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get current count
        const currentCount = await AMCInteraction.countDocuments({
            interactionType: 'asset_download'
        });
        
        console.log(`📊 Total download records: ${currentCount}`);
        
        // Show recent records with more details
        const recentRecords = await AMCInteraction.find({
            interactionType: 'asset_download'
        }).sort({ timestamp: -1 }).limit(10);
        
        console.log('\n📋 Last 10 download records:');
        recentRecords.forEach((record, index) => {
            const timeStr = record.timestamp.toISOString();
            const userInfo = record.userEmail || 'unknown';
            console.log(`${index + 1}. ${record.assetName} (${record.assetType}) - ${timeStr} - User: ${userInfo}`);
        });
        
        // Check for very recent records (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const veryRecentRecords = await AMCInteraction.find({
            interactionType: 'asset_download',
            timestamp: { $gte: fiveMinutesAgo }
        }).sort({ timestamp: -1 });
        
        console.log(`\n🕐 Downloads in last 5 minutes: ${veryRecentRecords.length}`);
        if (veryRecentRecords.length > 0) {
            veryRecentRecords.forEach((record, index) => {
                console.log(`  ${index + 1}. ${record.assetName} - ${record.timestamp.toISOString()}`);
            });
        } else {
            console.log('  ❌ No downloads recorded in the last 5 minutes');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugDownloadTracking();