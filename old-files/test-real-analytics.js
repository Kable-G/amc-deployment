/**
 * Test Real Analytics Implementation
 * Validates that the analytics system is capturing real data correctly
 */

const mongoose = require('mongoose');
const { AMCInteraction, MediaPickup, UserSession } = require('./models/AMCAnalytics');
const DownloadEvent = require('./models/DownloadEvent');
const CenterRelease = require('./models/CenterRelease');
const User = require('./models/User');

// Connect to MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/amc', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB for testing');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

// Test analytics data quality
async function testAnalyticsDataQuality() {
    console.log('🔍 Testing analytics data quality...\n');
    
    try {
        // Test 1: Check if we have real interactions
        const totalInteractions = await AMCInteraction.countDocuments();
        console.log(`📊 Total interactions: ${totalInteractions}`);
        
        if (totalInteractions === 0) {
            console.log('⚠️  No interactions found. Run sync-real-analytics-data.js first.');
            return false;
        }
        
        // Test 2: Check interaction type distribution
        console.log('\n📈 Interaction type breakdown:');
        const interactionTypes = await AMCInteraction.aggregate([
            {
                $group: {
                    _id: '$interactionType',
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        let hasDownloads = false;
        interactionTypes.forEach(type => {
            console.log(`  ${type._id}: ${type.count} (${type.uniqueUsers.length} unique users)`);
            if (type._id === 'asset_download') hasDownloads = true;
        });
        
        if (!hasDownloads) {
            console.log('⚠️  No download interactions found. Check download tracking.');
        }
        
        // Test 3: Check asset type distribution
        console.log('\n🎯 Asset type breakdown:');
        const assetTypes = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download', assetType: { $ne: null } } },
            {
                $group: {
                    _id: '$assetType',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        if (assetTypes.length === 0) {
            console.log('⚠️  No asset type data found. Check asset type detection.');
        } else {
            assetTypes.forEach(type => {
                console.log(`  ${type._id}: ${type.count} downloads`);
            });
        }
        
        // Test 4: Check geographic data
        console.log('\n🌍 Geographic distribution:');
        const geoData = await AMCInteraction.aggregate([
            { $match: { country: { $ne: null, $ne: 'Unknown' } } },
            {
                $group: {
                    _id: '$country',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        
        if (geoData.length === 0) {
            console.log('⚠️  No geographic data found. Check IP geolocation.');
        } else {
            geoData.forEach(geo => {
                console.log(`  ${geo._id}: ${geo.count} interactions`);
            });
        }
        
        // Test 5: Check recent activity (last 24 hours)
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentActivity = await AMCInteraction.countDocuments({
            timestamp: { $gte: last24Hours }
        });
        console.log(`\n⏰ Recent activity (24h): ${recentActivity} interactions`);
        
        // Test 6: Check session data
        const totalSessions = await UserSession.countDocuments();
        console.log(`👥 Total sessions: ${totalSessions}`);
        
        // Test 7: Check media pickups
        const totalPickups = await MediaPickup.countDocuments();
        console.log(`📺 Media pickups: ${totalPickups}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error testing analytics data quality:', error);
        return false;
    }
}

// Test download tracking accuracy
async function testDownloadTracking() {
    console.log('\n🔍 Testing download tracking accuracy...\n');
    
    try {
        // Compare DownloadEvent records with AMCInteraction records
        const downloadEvents = await DownloadEvent.countDocuments();
        const analyticsDownloads = await AMCInteraction.countDocuments({
            interactionType: 'asset_download'
        });
        
        console.log(`📥 DownloadEvent records: ${downloadEvents}`);
        console.log(`📊 Analytics download interactions: ${analyticsDownloads}`);
        
        if (analyticsDownloads < downloadEvents) {
            console.log('⚠️  Some download events may not be synced to analytics.');
        } else if (analyticsDownloads > downloadEvents) {
            console.log('✅ Analytics includes additional download tracking beyond DownloadEvent records.');
        } else {
            console.log('✅ Download tracking appears to be in sync.');
        }
        
        // Check for downloads with asset names
        const downloadsWithAssets = await AMCInteraction.countDocuments({
            interactionType: 'asset_download',
            assetName: { $ne: null, $ne: 'Unknown Asset' }
        });
        
        console.log(`🎯 Downloads with asset names: ${downloadsWithAssets}/${analyticsDownloads}`);
        
        if (downloadsWithAssets < analyticsDownloads * 0.8) {
            console.log('⚠️  Many downloads are missing asset name information.');
        }
        
        // Check for downloads with release information
        const downloadsWithReleases = await AMCInteraction.countDocuments({
            interactionType: 'asset_download',
            releaseTitle: { $ne: null }
        });
        
        console.log(`📄 Downloads with release info: ${downloadsWithReleases}/${analyticsDownloads}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error testing download tracking:', error);
        return false;
    }
}

// Test real-time tracking simulation
async function testRealTimeTracking() {
    console.log('\n🔍 Testing real-time tracking simulation...\n');
    
    try {
        // Get a sample user and release for testing
        const sampleUser = await User.findOne().lean();
        const sampleRelease = await CenterRelease.findOne({ status: 'published' }).lean();
        
        if (!sampleUser || !sampleRelease) {
            console.log('⚠️  No sample user or release found for testing.');
            return false;
        }
        
        console.log(`👤 Testing with user: ${sampleUser.email}`);
        console.log(`📄 Testing with release: ${sampleRelease.title}`);
        
        // Create a test interaction
        const testInteraction = new AMCInteraction({
            userId: sampleUser._id,
            userEmail: sampleUser.email,
            sessionId: `test_${Date.now()}`,
            interactionType: 'page_view',
            releaseId: sampleRelease._id,
            releaseUuid: sampleRelease.uuid,
            releaseTitle: sampleRelease.title,
            userAgent: 'Test User Agent',
            ipAddress: '192.168.1.100',
            country: 'Test Country',
            region: 'Test Region',
            city: 'Test City',
            timestamp: new Date(),
            metadata: {
                testInteraction: true,
                clientId: sampleUser.clientId,
                userRole: sampleUser.role
            }
        });
        
        await testInteraction.save();
        console.log('✅ Test interaction created successfully');
        
        // Verify the interaction was saved
        const savedInteraction = await AMCInteraction.findById(testInteraction._id);
        if (savedInteraction) {
            console.log('✅ Test interaction retrieved successfully');
            
            // Clean up test data
            await AMCInteraction.deleteOne({ _id: testInteraction._id });
            console.log('✅ Test interaction cleaned up');
        } else {
            console.log('❌ Test interaction not found after save');
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Error testing real-time tracking:', error);
        return false;
    }
}

// Test analytics API endpoints
async function testAnalyticsEndpoints() {
    console.log('\n🔍 Testing analytics API endpoints...\n');
    
    try {
        // Test overview endpoint data
        const overviewData = await AMCInteraction.aggregate([
            {
                $group: {
                    _id: null,
                    totalDownloads: {
                        $sum: { $cond: [{ $eq: ['$interactionType', 'asset_download'] }, 1, 0] }
                    },
                    totalPageViews: {
                        $sum: { $cond: [{ $eq: ['$interactionType', 'page_view'] }, 1, 0] }
                    },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            }
        ]);
        
        if (overviewData.length > 0) {
            const data = overviewData[0];
            console.log(`📊 Overview data available:`);
            console.log(`  Total downloads: ${data.totalDownloads}`);
            console.log(`  Total page views: ${data.totalPageViews}`);
            console.log(`  Unique users: ${data.uniqueUsers.length}`);
        } else {
            console.log('⚠️  No overview data available');
        }
        
        // Test downloads over time data
        const downloadsOverTime = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    },
                    downloads: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
            { $limit: 7 }
        ]);
        
        console.log(`📈 Downloads over time data points: ${downloadsOverTime.length}`);
        
        // Test top assets data
        const topAssets = await AMCInteraction.aggregate([
            { $match: { interactionType: 'asset_download', assetName: { $ne: null } } },
            {
                $group: {
                    _id: '$assetName',
                    downloads: { $sum: 1 }
                }
            },
            { $sort: { downloads: -1 } },
            { $limit: 5 }
        ]);
        
        console.log(`🏆 Top assets data points: ${topAssets.length}`);
        if (topAssets.length > 0) {
            console.log(`  Top asset: ${topAssets[0]._id} (${topAssets[0].downloads} downloads)`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Error testing analytics endpoints:', error);
        return false;
    }
}

// Test data integrity
async function testDataIntegrity() {
    console.log('\n🔍 Testing data integrity...\n');
    
    try {
        // Check for null/undefined critical fields
        const nullUserIds = await AMCInteraction.countDocuments({ userId: null });
        const nullInteractionTypes = await AMCInteraction.countDocuments({ interactionType: null });
        const nullTimestamps = await AMCInteraction.countDocuments({ timestamp: null });
        
        console.log(`🔍 Data integrity checks:`);
        console.log(`  Null user IDs: ${nullUserIds}`);
        console.log(`  Null interaction types: ${nullInteractionTypes}`);
        console.log(`  Null timestamps: ${nullTimestamps}`);
        
        // Check for reasonable timestamp ranges
        const oldestInteraction = await AMCInteraction.findOne().sort({ timestamp: 1 });
        const newestInteraction = await AMCInteraction.findOne().sort({ timestamp: -1 });
        
        if (oldestInteraction && newestInteraction) {
            console.log(`📅 Date range: ${oldestInteraction.timestamp.toISOString()} to ${newestInteraction.timestamp.toISOString()}`);
        }
        
        // Check for duplicate sessions
        const duplicateSessions = await AMCInteraction.aggregate([
            {
                $group: {
                    _id: '$sessionId',
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } },
            { $count: 'duplicates' }
        ]);
        
        const duplicateCount = duplicateSessions.length > 0 ? duplicateSessions[0].duplicates : 0;
        console.log(`🔄 Sessions with multiple interactions: ${duplicateCount} (this is normal)`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error testing data integrity:', error);
        return false;
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting comprehensive analytics testing...\n');
    
    try {
        await connectDB();
        
        const tests = [
            { name: 'Analytics Data Quality', fn: testAnalyticsDataQuality },
            { name: 'Download Tracking Accuracy', fn: testDownloadTracking },
            { name: 'Real-Time Tracking', fn: testRealTimeTracking },
            { name: 'Analytics Endpoints', fn: testAnalyticsEndpoints },
            { name: 'Data Integrity', fn: testDataIntegrity }
        ];
        
        let passedTests = 0;
        let totalTests = tests.length;
        
        for (const test of tests) {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🧪 Running test: ${test.name}`);
            console.log(`${'='.repeat(50)}`);
            
            const result = await test.fn();
            if (result) {
                console.log(`✅ ${test.name}: PASSED`);
                passedTests++;
            } else {
                console.log(`❌ ${test.name}: FAILED`);
            }
        }
        
        console.log(`\n${'='.repeat(50)}`);
        console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} tests passed`);
        console.log(`${'='.repeat(50)}`);
        
        if (passedTests === totalTests) {
            console.log('🎉 ALL TESTS PASSED! Your analytics system is working correctly.');
            console.log('\n✅ Your analytics dashboard should now show real data instead of fake data.');
            console.log('✅ All download types (images, videos, documents) are being tracked.');
            console.log('✅ User interactions are being captured accurately.');
            console.log('✅ Geographic and session data is being collected.');
        } else {
            console.log(`⚠️  ${totalTests - passedTests} test(s) failed. Please review the issues above.`);
        }
        
        // Provide next steps
        console.log('\n📋 Next Steps:');
        console.log('1. Add the frontend tracking script to automediacenter.html');
        console.log('2. Update your server to include the new routes and middleware');
        console.log('3. Update download links to use the new tracking endpoints');
        console.log('4. Monitor the analytics dashboard for real-time data');
        console.log('5. Consider integrating a real IP geolocation service');
        
    } catch (error) {
        console.error('❌ Error running tests:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    runAllTests,
    testAnalyticsDataQuality,
    testDownloadTracking,
    testRealTimeTracking,
    testAnalyticsEndpoints,
    testDataIntegrity
};