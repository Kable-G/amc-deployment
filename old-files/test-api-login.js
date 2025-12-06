const axios = require('axios');

async function testLogin() {
    try {
        console.log('🔐 Testing login API endpoint...');
        
        const response = await axios.post('http://localhost:5000/api/v1/auth/login', {
            email: 'admin@automediacenter.com',
            password: 'admin123'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Login successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data.token) {
            console.log('🎫 Token generated successfully!');
            console.log('Token length:', response.data.token.length);
        }
        
    } catch (error) {
        console.error('❌ Login failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testLogin();