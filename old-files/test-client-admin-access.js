// Test script to verify client admin access
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/automediacenter');

const User = require('./models/User');

async function testClientAdminAccess() {
    try {
        console.log('🔍 Testing Client Admin Access...\n');
        
        // Find the client admin user
        const user = await User.findOne({ email: 'clientadmin@test.com' }).select('-password');
        
        if (!user) {
            console.log('❌ Client admin user not found');
            return;
        }
        
        console.log('✅ User found:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Client ID: ${user.clientId}`);
        
        // Generate a JWT token (same as login process)
        const tokenPayload = {
            user: {
                id: user._id,
                role: user.role,
                clientId: user.clientId
            }
        };
        
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '8h' });
        console.log(`\n🔑 Generated JWT Token: ${token.substring(0, 50)}...`);
        
        // Test page access rules
        const protectedPages = [
            'AssetDBmenu1.6.html',
            'manage_releases.html', 
            'radar_history.html',
            'radar_analytics.html'
        ];
        
        const pageAccessRules = {
            'AssetDBmenu1.6.html': ['client_user', 'client_admin', 'platform_admin'],
            'manage_releases.html': ['client_user', 'client_admin', 'platform_admin'],
            'radar_history.html': ['client_user', 'client_admin', 'platform_admin'],
            'radar_analytics.html': ['client_user', 'client_admin', 'platform_admin']
        };
        
        console.log('\n📋 Testing Page Access:');
        protectedPages.forEach(page => {
            const allowedRoles = pageAccessRules[page] || [];
            const hasAccess = allowedRoles.includes(user.role);
            const status = hasAccess ? '✅ ALLOWED' : '❌ DENIED';
            console.log(`   ${page}: ${status}`);
        });
        
        // Check if user has clientId (required for client users)
        if (user.role === 'client_admin' && user.clientId) {
            console.log('\n✅ Client admin has valid clientId - should have full access to client pages');
        } else if (user.role === 'client_admin' && !user.clientId) {
            console.log('\n⚠️  WARNING: Client admin missing clientId - access may be restricted');
        }
        
        console.log('\n🎯 Expected Result: Client admin should have access to ALL protected pages listed above.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        mongoose.connection.close();
    }
}

testClientAdminAccess();