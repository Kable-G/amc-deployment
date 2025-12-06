// Simple script to check what releases exist in the database
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/center/releases',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🔍 Checking what releases exist...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log(`Found ${jsonData.data ? jsonData.data.length : 0} releases`);
      
      if (jsonData.data && jsonData.data.length > 0) {
        console.log('\nFirst few releases:');
        jsonData.data.slice(0, 3).forEach((release, index) => {
          console.log(`${index + 1}. ${release.title || release.name} (Status: ${release.status})`);
          console.log(`   Assets: ${release.assets ? release.assets.length : 0}`);
          if (release.assets && release.assets.length > 0) {
            console.log(`   Sample assets: ${release.assets.slice(0, 2).map(a => a.filename || a.originalName || 'unnamed').join(', ')}`);
          }
        });
      } else {
        console.log('No releases found in database');
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();