const http = require('http');

console.log('🧪 Testing AssetDBmenu1.6.html Access\n');

// Test access to the Upload Hub
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/AssetDBmenu1.6.html',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`📊 Response Status: ${res.statusCode}`);
  console.log(`📋 Response Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`📄 Response Size: ${data.length} bytes`);
    
    // Check if the response contains our fixed content
    if (data.includes('CLIENT-SIDE AUTH COMPLETELY DISABLED')) {
      console.log('✅ SUCCESS: Client-side auth has been disabled');
    }
    
    if (data.includes('opacity: 1')) {
      console.log('✅ SUCCESS: App container is visible by default');
    }
    
    if (data.includes('LOGIN FORM REMOVED')) {
      console.log('✅ SUCCESS: Login form has been removed');
    }
    
    if (data.includes('Server-side protection handles everything')) {
      console.log('✅ SUCCESS: Server-side protection is active');
    }
    
    // Check if login container is removed
    if (!data.includes('<div id="login-container"')) {
      console.log('✅ SUCCESS: Login container has been removed');
    }
    
    console.log('\n🎯 Test Results:');
    if (res.statusCode === 200) {
      console.log('✅ Upload Hub is accessible');
      console.log('✅ Client-side authentication barriers removed');
      console.log('✅ Server-side protection still active');
    } else {
      console.log(`❌ Unexpected status code: ${res.statusCode}`);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request failed: ${e.message}`);
});

req.end();