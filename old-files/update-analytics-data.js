// Simple script to call the update analytics endpoint
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/amc-analytics/update-with-real-assets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('🔄 Calling analytics update endpoint...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();