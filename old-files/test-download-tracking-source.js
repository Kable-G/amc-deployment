/**
 * Test script to identify the source of duplicate download tracking
 * With middleware disabled, any tracking must be coming from frontend or routes
 */

const mongoose = require('mongoose');
const { AMCInteraction } = require('./models/AMCAnalytics');
require('dotenv').config();

async function testDownloadTrackingSource() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get current count of download interactions
        const beforeCount = await AMCInteraction.countDocuments({
            interactionType: 'asset_download'
        });
        
        console.log(`📊 Current download interactions in database: ${beforeCount}`);
        console.log('\n🧪 TEST INSTRUCTIONS:');
        console.log('1. With middleware DISABLED, go to http://localhost:5000/automediacenter.html');
        console.log('2. Download exactly 1 file');
        console.log('3. Come back here and press Enter to check results');
        console.log('\n⚠️  If downloads are still being tracked, the frontend is the duplicate source!');
        
        // Wait for user input
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', async () => {
            try {
                // Get new count
                const afterCount = await AMCInteraction.countDocuments({
                    interactionType: 'asset_download'
                });
                
                const newRecords = afterCount - beforeCount;
                
                console.log(`\n📊 Download interactions after test: ${afterCount}`);
                console.log(`🔢 New records created: ${newRecords}`);
                
                if (newRecords === 0) {
                    console.log('✅ NO TRACKING - Middleware was the only source');
                    console.log('💡 Solution: Re-enable middleware with proper duplicate prevention');
                } else if (newRecords === 1) {
                    console.log('✅ PERFECT 1:1 TRACKING - Frontend is working correctly');
                    console.log('💡 Problem was in the middleware - keep it disabled or fix it');
                } else if (newRecords === 2) {
                    console.log('❌ STILL 2:1 DUPLICATION - Frontend has duplicate tracking');
                    console.log('💡 Solution: Fix frontend tracking in amc-analytics-tracker.js');
                } else {
                    console.log(`❌ UNEXPECTED RATIO ${newRecords}:1 - Multiple tracking sources active`);
                    console.log('💡 Solution: Investigate all tracking sources');
                }
                
                // Show recent records
                const recentRecords = await AMCInteraction.find({
                    interactionType: 'asset_download',
                    timestamp: { $gte: new Date(Date.now() - 60000) } // Last minute
                }).sort({ timestamp: -1 }).limit(10);
                
                if (recentRecords.length > 0) {
                    console.log('\n📋 Recent download records:');
                    recentRecords.forEach((record, index) => {
                        console.log(`${index + 1}. ${record.assetName} (${record.assetType}) - ${record.timestamp.toISOString()}`);
                        console.log(`   Source: ${record.metadata?.downloadSource || 'unknown'}`);
                        console.log(`   User: ${record.userEmail}`);
                    });
                }
                
                process.exit(0);
            } catch (error) {
                console.error('❌ Error checking results:', error);
                process.exit(1);
            }
        });
        
    } catch (error) {
        console.error('❌ Error connecting to database:', error);
        process.exit(1);
    }
}

testDownloadTrackingSource();