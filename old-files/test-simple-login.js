const axios = require('axios');

async function testLogin() {
    try {
        console.log('🔐 Testing simple server login...');
        
        const response = await axios.post('http://localhost:5001/api/v1/auth/login', {
            email: 'admin@automediacenter.com',
            password: 'admin123'
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ Login successful!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ Login failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else if (error.request) {
            console.log('No response received:', error.message);
        } else {
            console.log('Error:', error.message);
        }
    }
}

testLogin();