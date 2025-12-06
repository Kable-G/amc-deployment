/**
 * Test Download Tracking - Verify that downloads are being tracked in real-time
 */

const mongoose = require('mongoose');
const { AMCInteraction } = require('./models/AMCAnalytics');

async function testDownloadTracking() {
    try {
        console.log('🔍 Testing download tracking...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/amc', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Check recent interactions (last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        
        console.log(`📊 Checking for interactions since ${tenMinutesAgo.toISOString()}`);
        
        const recentInteractions = await AMCInteraction.find({
            timestamp: { $gte: tenMinutesAgo }
        }).sort({ timestamp: -1 });

        console.log(`\n📈 Found ${recentInteractions.length} recent interactions:`);
        
        if (recentInteractions.length === 0) {
            console.log('❌ No recent interactions found!');
            console.log('\n🔧 This means the tracking is not working. Possible issues:');
            console.log('1. Server not restarted after adding middleware');
            console.log('2. Downloads not going through tracked routes');
            console.log('3. Frontend tracking script not loaded');
        } else {
            recentInteractions.forEach((interaction, index) => {
                console.log(`\n${index + 1}. ${interaction.interactionType} at ${interaction.timestamp.toISOString()}`);
                console.log(`   User: ${interaction.userEmail}`);
                console.log(`   Asset: ${interaction.assetName || 'N/A'} (${interaction.assetType || 'N/A'})`);
                console.log(`   Release: ${interaction.releaseTitle || 'N/A'}`);
                console.log(`   Source: ${interaction.metadata?.downloadSource || 'N/A'}`);
            });
        }

        // Check total download interactions
        const totalDownloads = await AMCInteraction.countDocuments({
            interactionType: 'asset_download'
        });
        
        console.log(`\n📥 Total download interactions in database: ${totalDownloads}`);

        // Check downloads by asset type
        const downloadsByType = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download' } },
            { $group: { _id: '$assetType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\n🎯 Downloads by asset type:');
        if (downloadsByType.length === 0) {
            console.log('   No downloads found by asset type');
        } else {
            downloadsByType.forEach(type => {
                console.log(`   ${type._id || 'Unknown'}: ${type.count}`);
            });
        }

        // Check recent downloads specifically
        const recentDownloads = await AMCInteraction.find({
            interactionType: 'asset_download',
            timestamp: { $gte: tenMinutesAgo }
        }).sort({ timestamp: -1 });

        console.log(`\n⬇️ Recent downloads (last 10 minutes): ${recentDownloads.length}`);
        
        if (recentDownloads.length > 0) {
            console.log('✅ Download tracking is working!');
            recentDownloads.forEach((download, index) => {
                console.log(`   ${index + 1}. ${download.assetName} (${download.assetType}) at ${download.timestamp.toISOString()}`);
            });
        } else {
            console.log('❌ No recent downloads tracked');
            console.log('\n🚨 PROBLEM: Downloads are not being tracked!');
            console.log('\n🔧 To fix this:');
            console.log('1. Restart your server to load the new middleware');
            console.log('2. Make sure you download an asset after restarting');
            console.log('3. Run this test again');
        }

        // Test if we can create a manual interaction
        console.log('\n🧪 Testing manual interaction creation...');
        
        const testInteraction = new AMCInteraction({
            userId: new mongoose.Types.ObjectId(),
            userEmail: 'test@example.com',
            sessionId: `test_${Date.now()}`,
            interactionType: 'asset_download',
            assetName: 'test_image.jpg',
            assetType: 'image',
            userAgent: 'Test Agent',
            ipAddress: '127.0.0.1',
            country: 'Test Country',
            region: 'Test Region',
            city: 'Test City',
            timestamp: new Date(),
            metadata: {
                downloadSource: 'test',
                test: true
            }
        });

        await testInteraction.save();
        console.log('✅ Manual test interaction created successfully');

        // Clean up test interaction
        await AMCInteraction.deleteOne({ _id: testInteraction._id });
        console.log('🧹 Test interaction cleaned up');

        console.log('\n📋 SUMMARY:');
        console.log(`   Total interactions: ${recentInteractions.length}`);
        console.log(`   Total downloads: ${totalDownloads}`);
        console.log(`   Recent downloads: ${recentDownloads.length}`);
        
        if (recentDownloads.length > 0) {
            console.log('\n🎉 SUCCESS: Download tracking is working!');
        } else {
            console.log('\n❌ FAILURE: Download tracking is not working');
            console.log('\n🔧 Next steps:');
            console.log('1. Restart your server');
            console.log('2. Download an image from automediacenter.html');
            console.log('3. Run this test again');
        }

    } catch (error) {
        console.error('❌ Error testing download tracking:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run the test
if (require.main === module) {
    testDownloadTracking();
}

module.exports = testDownloadTracking;