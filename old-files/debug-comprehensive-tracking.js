const mongoose = require('mongoose');
const AMCInteraction = require('./models/AMCAnalytics');

async function debugComprehensiveTracking() {
    console.log('🔍 COMPREHENSIVE TRACKING DEBUG - FINDING THE 2:1 CULPRIT');
    
    try {
        await mongoose.connect('mongodb://localhost:27017/amc_database');
        console.log('✅ Connected to MongoDB');
        
        // Get the most recent downloads to analyze the pattern
        const recentDownloads = await AMCInteraction.find({
            interactionType: 'asset_download'
        })
        .sort({ timestamp: -1 })
        .limit(20)
        .lean();
        
        console.log('\n📊 RECENT DOWNLOAD RECORDS ANALYSIS:');
        console.log('=====================================');
        
        if (recentDownloads.length === 0) {
            console.log('❌ No download records found');
            return;
        }
        
        // Group by timestamp to find duplicates
        const timestampGroups = {};
        recentDownloads.forEach(download => {
            const timeKey = new Date(download.timestamp).toISOString();
            if (!timestampGroups[timeKey]) {
                timestampGroups[timeKey] = [];
            }
            timestampGroups[timeKey].push(download);
        });
        
        console.log('\n🔍 DUPLICATE ANALYSIS:');
        Object.keys(timestampGroups).forEach(timeKey => {
            const group = timestampGroups[timeKey];
            if (group.length > 1) {
                console.log(`\n⚠️ DUPLICATE FOUND at ${timeKey}:`);
                group.forEach((record, index) => {
                    console.log(`   ${index + 1}. ID: ${record._id}`);
                    console.log(`      User: ${record.userId}`);
                    console.log(`      Session: ${record.sessionId}`);
                    console.log(`      Asset: ${record.assetName || 'Unknown'}`);
                    console.log(`      Source: ${record.metadata?.downloadSource || 'Unknown'}`);
                    console.log(`      Method: ${record.metadata?.downloadMethod || 'Unknown'}`);
                    console.log(`      IP: ${record.ipAddress || 'Unknown'}`);
                    console.log(`      User Agent: ${record.userAgent?.substring(0, 50) || 'Unknown'}...`);
                });
            }
        });
        
        // Analyze patterns
        console.log('\n📈 PATTERN ANALYSIS:');
        console.log('====================');
        
        const sources = {};
        const methods = {};
        const sessions = {};
        
        recentDownloads.forEach(download => {
            const source = download.metadata?.downloadSource || 'Unknown';
            const method = download.metadata?.downloadMethod || 'Unknown';
            const session = download.sessionId || 'Unknown';
            
            sources[source] = (sources[source] || 0) + 1;
            methods[method] = (methods[method] || 0) + 1;
            sessions[session] = (sessions[session] || 0) + 1;
        });
        
        console.log('\n🎯 DOWNLOAD SOURCES:');
        Object.entries(sources).forEach(([source, count]) => {
            console.log(`   ${source}: ${count} records`);
        });
        
        console.log('\n🔧 DOWNLOAD METHODS:');
        Object.entries(methods).forEach(([method, count]) => {
            console.log(`   ${method}: ${count} records`);
        });
        
        console.log('\n🔑 SESSION ANALYSIS:');
        Object.entries(sessions).forEach(([session, count]) => {
            if (count > 1) {
                console.log(`   ⚠️ Session ${session}: ${count} downloads (potential duplicate)`);
            }
        });
        
        // Check for exact duplicates
        console.log('\n🔍 EXACT DUPLICATE CHECK:');
        const duplicateMap = {};
        recentDownloads.forEach(download => {
            const key = `${download.userId}-${download.assetName}-${download.sessionId}`;
            if (!duplicateMap[key]) {
                duplicateMap[key] = [];
            }
            duplicateMap[key].push(download);
        });
        
        Object.entries(duplicateMap).forEach(([key, records]) => {
            if (records.length > 1) {
                console.log(`\n❌ EXACT DUPLICATE: ${key}`);
                console.log(`   Count: ${records.length} identical records`);
                records.forEach((record, index) => {
                    console.log(`   ${index + 1}. Timestamp: ${record.timestamp}`);
                    console.log(`      ID: ${record._id}`);
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Debug error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

if (require.main === module) {
    debugComprehensiveTracking()
        .then(() => {
            console.log('\n🎉 Comprehensive debug completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Debug failed:', error);
            process.exit(1);
        });
}

module.exports = { debugComprehensiveTracking };