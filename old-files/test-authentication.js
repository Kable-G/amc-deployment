// test-authentication.js
// Simple script to test the authentication system

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api/v1';

async function testAuthentication() {
    console.log('🧪 Testing Authentication System\n');

    const testUsers = [
        {
            email: 'public@test.com',
            password: 'password123',
            expectedRole: 'media_user',
            shouldAccessAssetDB: false
        },
        {
            email: 'testuser@example.com',
            password: 'password123',
            expectedRole: 'client_admin',
            shouldAccessAssetDB: true
        },
        {
            email: 'clientadmin@test.com',
            password: 'password123',
            expectedRole: 'client_admin',
            shouldAccessAssetDB: true
        },
        {
            email: 'admin@test.com',
            password: 'password123',
            expectedRole: 'platform_admin',
            shouldAccessAssetDB: true
        }
    ];

    for (const user of testUsers) {
        console.log(`\n📧 Testing: ${user.email}`);
        console.log(`Expected Role: ${user.expectedRole}`);
        console.log(`Should Access AssetDB: ${user.shouldAccessAssetDB ? 'YES' : 'NO'}`);
        console.log('─'.repeat(50));

        try {
            // Test login
            const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: user.email,
                    password: user.password
                })
            });

            const loginData = await loginResponse.json();

            if (loginData.success) {
                console.log('✅ Login successful');
                console.log(`   User: ${loginData.user.name}`);
                console.log(`   Role: ${loginData.user.role}`);
                console.log(`   Client ID: ${loginData.user.clientId || 'None'}`);
                
                // Verify role matches expected
                if (loginData.user.role === user.expectedRole) {
                    console.log('✅ Role matches expected');
                } else {
                    console.log(`❌ Role mismatch! Expected: ${user.expectedRole}, Got: ${loginData.user.role}`);
                }

                // Test token validity
                const token = loginData.token;
                const userInfoResponse = await fetch(`${API_BASE_URL}/auth-test/user-info`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (userInfoResponse.ok) {
                    const userInfo = await userInfoResponse.json();
                    console.log('✅ Token is valid');
                    console.log(`   User Level: ${userInfo.data.userLevel || 'Not specified'}`);
                } else {
                    console.log('❌ Token validation failed');
                }

            } else {
                console.log(`❌ Login failed: ${loginData.error}`);
            }

        } catch (error) {
            console.log(`❌ Test failed: ${error.message}`);
        }
    }

    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Make sure your server is running: node server.js');
    console.log('2. Test in browser: http://localhost:5000/login-test-mongodb.html');
    console.log('3. Try accessing: http://localhost:5000/AssetDBmenu1.6.html');
    console.log('   - As public@test.com: Should get Access Denied');
    console.log('   - As testuser@example.com: Should work properly');
}

// Run the test
testAuthentication().catch(console.error);