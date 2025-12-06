/**
 * Test Download Counting - Verify 1:1 download tracking accuracy
 */

const mongoose = require('mongoose');
const { AMCInteraction } = require('./models/AMCAnalytics');

async function testDownloadCounting() {
    try {
        console.log('🧪 Testing download counting accuracy...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/amc', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Get current counts by asset type
        const currentCounts = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download' } },
            { $group: { _id: '$assetType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log('\n📊 Current download counts by asset type:');
        let totalDownloads = 0;
        currentCounts.forEach(type => {
            const count = type.count;
            totalDownloads += count;
            console.log(`   ${type._id || 'Unknown'}: ${count}`);
        });

        console.log(`\n📈 Total downloads: ${totalDownloads}`);

        // Show recent downloads (last 10)
        const recentDownloads = await AMCInteraction.find({
            interactionType: 'asset_download'
        })
        .sort({ timestamp: -1 })
        .limit(10)
        .select('assetName assetType timestamp userEmail metadata.downloadSource');

        console.log('\n🕒 Recent downloads (last 10):');
        recentDownloads.forEach((download, index) => {
            const time = download.timestamp.toLocaleString();
            const source = download.metadata?.downloadSource || 'unknown';
            console.log(`   ${index + 1}. ${download.assetName} (${download.assetType}) - ${time} - ${source}`);
        });

        // Check for any remaining duplicates
        const duplicateCheck = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download' } },
            {
                $group: {
                    _id: {
                        userId: '$userId',
                        assetName: '$assetName',
                        timeWindow: {
                            $dateToString: {
                                format: '%Y-%m-%d %H:%M',
                                date: '$timestamp'
                            }
                        }
                    },
                    count: { $sum: 1 },
                    timestamps: { $push: '$timestamp' }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        if (duplicateCheck.length > 0) {
            console.log('\n⚠️  Potential duplicates found:');
            duplicateCheck.forEach(dup => {
                console.log(`   ${dup._id.assetName} by ${dup._id.userId} at ${dup._id.timeWindow}: ${dup.count} records`);
            });
        } else {
            console.log('\n✅ No duplicates detected - tracking appears clean!');
        }

        console.log('\n📋 Next steps:');
        console.log('1. Note the current image download count');
        console.log('2. Download exactly 1 image from automediacenter.html');
        console.log('3. Run this script again to verify count increased by exactly 1');
        console.log('4. Check amc-analytics.html to confirm dashboard shows correct count');

    } catch (error) {
        console.error('❌ Error testing download counting:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run the test
if (require.main === module) {
    testDownloadCounting();
}

module.exports = testDownloadCounting;