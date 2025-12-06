const axios = require('axios');

async function testHealth() {
    try {
        console.log('🏥 Testing server health...');
        
        const response = await axios.get('http://localhost:5000/health', {
            timeout: 5000
        });
        
        console.log('✅ Health check successful!');
        console.log('Status:', response.status);
        console.log('Response:', response.data);
        
    } catch (error) {
        console.log('❌ Health check failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else if (error.request) {
            console.log('No response received:', error.code || error.message);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testHealth();