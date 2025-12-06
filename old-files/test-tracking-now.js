/**
 * IMMEDIATE TEST - Check if tracking is working
 */

const mongoose = require('mongoose');
const { AMCInteraction } = require('./models/AMCAnalytics');
require('dotenv').config();

async function testTracking() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get current count
        const currentCount = await AMCInteraction.countDocuments({
            interactionType: 'asset_download'
        });
        
        console.log(`📊 Current download records: ${currentCount}`);
        
        // Show recent records
        const recentRecords = await AMCInteraction.find({
            interactionType: 'asset_download'
        }).sort({ timestamp: -1 }).limit(5);
        
        console.log('\n📋 Last 5 download records:');
        recentRecords.forEach((record, index) => {
            console.log(`${index + 1}. ${record.assetName} (${record.assetType}) - ${record.timestamp.toISOString()}`);
        });
        
        // Create a test record to verify tracking works
        console.log('\n🧪 Creating test record...');
        const testRecord = new AMCInteraction({
            userId: new mongoose.Types.ObjectId(),
            userEmail: 'test@example.com',
            sessionId: `test_${Date.now()}`,
            interactionType: 'asset_download',
            
            assetType: 'image',
            assetName: 'test-image.jpg',
            assetPath: '/test/path',
            assetSize: 12345,
            
            userAgent: 'Test Agent',
            ipAddress: '127.0.0.1',
            
            country: 'Germany',
            region: 'Europe',
            city: 'Berlin',
            
            timestamp: new Date(),
            
            metadata: {
                downloadSource: 'test',
                realTimeTracking: true
            }
        });
        
        await testRecord.save();
        console.log('✅ Test record created successfully');
        
        // Check new count
        const newCount = await AMCInteraction.countDocuments({
            interactionType: 'asset_download'
        });
        
        console.log(`📊 New download records: ${newCount}`);
        console.log(`🔢 Difference: +${newCount - currentCount}`);
        
        if (newCount > currentCount) {
            console.log('✅ TRACKING IS WORKING - Database accepts new records');
        } else {
            console.log('❌ TRACKING PROBLEM - No new records created');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testTracking();