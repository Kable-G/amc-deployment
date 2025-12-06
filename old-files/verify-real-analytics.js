// Script to verify if analytics data is real or just arbitrary
const http = require('http');

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          resolve({ error: 'Parse error', raw: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

async function verifyAnalytics() {
  console.log('🔍 VERIFYING ANALYTICS DATA AUTHENTICITY...\n');
  
  try {
    // Test 1: Check top assets multiple times to see if rankings are consistent
    console.log('📊 TEST 1: Checking top assets consistency...');
    const topAssets1 = await makeRequest('/api/v1/amc-analytics/top-assets?limit=5');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    const topAssets2 = await makeRequest('/api/v1/amc-analytics/top-assets?limit=5');
    
    if (topAssets1.data && topAssets2.data) {
      console.log('First call top assets:');
      topAssets1.data.forEach((asset, i) => {
        console.log(`  ${i+1}. ${asset.assetName} - ${asset.downloads} downloads`);
      });
      
      console.log('\nSecond call top assets:');
      topAssets2.data.forEach((asset, i) => {
        console.log(`  ${i+1}. ${asset.assetName} - ${asset.downloads} downloads`);
      });
      
      // Check if rankings are identical
      const identical = JSON.stringify(topAssets1.data) === JSON.stringify(topAssets2.data);
      console.log(`\n✅ Rankings consistent: ${identical ? 'YES' : 'NO'}`);
      
      if (!identical) {
        console.log('❌ PROBLEM: Rankings change between calls - this suggests random data!');
      }
    }
    
    // Test 2: Check if download counts make sense
    console.log('\n📈 TEST 2: Checking download count distribution...');
    const overview = await makeRequest('/api/v1/amc-analytics/overview');
    
    if (overview.data) {
      console.log(`Total downloads: ${overview.data.kpis.totalDownloads.value}`);
      console.log(`Unique users: ${overview.data.kpis.uniqueUsers.value}`);
      console.log(`Top asset: ${overview.data.kpis.topAsset.value} (${overview.data.kpis.topAsset.downloads} downloads)`);
      
      // Check if top asset downloads make sense relative to total
      const topAssetDownloads = overview.data.kpis.topAsset.downloads;
      const totalDownloads = overview.data.kpis.totalDownloads.value;
      const percentage = (topAssetDownloads / totalDownloads * 100).toFixed(2);
      
      console.log(`Top asset represents ${percentage}% of total downloads`);
      
      if (percentage > 50) {
        console.log('⚠️  WARNING: Top asset has unusually high percentage - might be artificial');
      } else if (percentage < 1) {
        console.log('⚠️  WARNING: Top asset has unusually low percentage - might be artificial');
      } else {
        console.log('✅ Download distribution looks realistic');
      }
    }
    
    // Test 3: Check time-based data for patterns
    console.log('\n📅 TEST 3: Checking time-based patterns...');
    const downloadsOverTime = await makeRequest('/api/v1/amc-analytics/downloads-over-time?dateRange=7');
    
    if (downloadsOverTime.data && downloadsOverTime.data.length > 0) {
      console.log('Downloads over last 7 days:');
      downloadsOverTime.data.forEach(day => {
        const date = `${day.date.year}-${day.date.month}-${day.date.day}`;
        console.log(`  ${date}: ${day.downloads} downloads, ${day.uniqueUsers} users`);
      });
      
      // Check if there's variation in daily downloads
      const downloadCounts = downloadsOverTime.data.map(d => d.downloads);
      const allSame = downloadCounts.every(count => count === downloadCounts[0]);
      
      if (allSame && downloadCounts[0] > 0) {
        console.log('❌ PROBLEM: All days have identical download counts - this is artificial!');
      } else if (downloadCounts.every(count => count === 0)) {
        console.log('❌ PROBLEM: No downloads recorded - data might not be real!');
      } else {
        console.log('✅ Daily variation looks realistic');
      }
    }
    
    // Test 4: Check if asset names correspond to real releases
    console.log('\n🎯 TEST 4: Checking asset-release correlation...');
    const topReleases = await makeRequest('/api/v1/amc-analytics/top-releases?limit=3');
    
    if (topReleases.data && topReleases.data.length > 0) {
      console.log('Top releases by downloads:');
      topReleases.data.forEach((release, i) => {
        console.log(`  ${i+1}. "${release.releaseTitle}" - ${release.downloads} downloads`);
      });
      
      // Check if release titles look real
      const hasRealTitles = topReleases.data.some(release => 
        release.releaseTitle && 
        release.releaseTitle.length > 10 && 
        !release.releaseTitle.includes('test') &&
        !release.releaseTitle.includes('demo')
      );
      
      if (hasRealTitles) {
        console.log('✅ Release titles look authentic');
      } else {
        console.log('❌ PROBLEM: Release titles look artificial or test data');
      }
    }
    
    console.log('\n🎯 FINAL ASSESSMENT:');
    console.log('The analytics system is using real asset names from actual releases,');
    console.log('but the interaction data (download counts, timestamps) was generated');
    console.log('artificially to populate the analytics. This means:');
    console.log('');
    console.log('✅ REAL: Asset names, release titles, release IDs');
    console.log('🔄 SIMULATED: Download counts, user interactions, timestamps');
    console.log('');
    console.log('This is a common approach for demo/development systems where you need');
    console.log('realistic data structure but don\'t have actual user interaction history.');
    
  } catch (error) {
    console.error('Error during verification:', error.message);
  }
}

verifyAnalytics();