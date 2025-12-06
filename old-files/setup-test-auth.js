// setup-test-auth.js
// Script to create test users and clients for authentication testing

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Client = require('./models/Client');
require('dotenv').config();

async function setupTestAuth() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/automediaplatform');
        console.log('✅ Connected to MongoDB');

        // Create test clients first
        console.log('\n📋 Creating test clients...');
        
        // Clear existing test clients
        await Client.deleteMany({ clientName: { $in: ['Test Client Corp', 'Demo Media Group', 'Sample Industries'] } });
        
        const testClients = [
            {
                clientName: 'Test Client Corp',
                contactPerson: 'John Smith',
                contactEmail: 'john@testclient.com',
                isActive: true
            },
            {
                clientName: 'Demo Media Group',
                contactPerson: 'Sarah Johnson',
                contactEmail: 'sarah@demomedia.com',
                isActive: true
            },
            {
                clientName: 'Sample Industries',
                contactPerson: 'Mike Wilson',
                contactEmail: 'mike@sampleind.com',
                isActive: true
            }
        ];

        const createdClients = await Client.insertMany(testClients);
        console.log(`✅ Created ${createdClients.length} test clients`);

        // Check if existing test user needs to be updated
        console.log('\n👥 Checking existing test user...');
        const existingTestUser = await User.findOne({ email: 'test@example.com' });
        
        if (existingTestUser) {
            console.log('✅ Found existing test user: test@example.com');
            
            // Update existing user to have proper role and client association
            if (existingTestUser.role === 'user') {
                existingTestUser.role = 'client_user';
                existingTestUser.clientId = createdClients[0]._id; // Associate with Test Client Corp
                await existingTestUser.save();
                console.log('✅ Updated existing test user to client_user role with Test Client Corp');
            }
        }

        // Create additional test users for authentication levels
        console.log('\n👥 Creating additional authentication test users...');
        
        // Clear existing auth test users (but preserve test@example.com)
        await User.deleteMany({
            email: {
                $in: [
                    'public@test.com',
                    'clientadmin@test.com',
                    'admin@test.com'
                ]
            }
        });

        const authTestUsers = [
            // Level 1: Public User (media_user role)
            {
                email: 'public@test.com',
                password: 'password123',
                name: 'Public Test User',
                role: 'media_user'
                // No clientId - can only access public pages
            },
            
            // Level 2: Client Admin (different from your existing client user)
            {
                email: 'clientadmin@test.com',
                password: 'password123',
                name: 'Client Admin User',
                role: 'client_admin',
                clientId: createdClients[1]._id // Demo Media Group
            },
            
            // Level 3: Platform Admin
            {
                email: 'admin@test.com',
                password: 'password123',
                name: 'Platform Admin User',
                role: 'platform_admin'
                // No clientId - has access to everything
            }
        ];

        const createdAuthUsers = await User.insertMany(authTestUsers);
        console.log(`✅ Created ${createdAuthUsers.length} additional authentication test users`);

        // Display test credentials
        console.log('\n🔑 AUTHENTICATION TEST CREDENTIALS:');
        console.log('=====================================');
        
        console.log('\n🏠 YOUR EXISTING ACCOUNT (PRESERVED):');
        console.log('Email: test@example.com');
        console.log('Password: password123');
        console.log('Role: client_user (updated from "user")');
        console.log('Client: Test Client Corp');
        console.log('Access: Public pages + Upload dashboard + Your existing data');
        
        console.log('\n📱 LEVEL 1 - PUBLIC USER (media_user):');
        console.log('Email: public@test.com');
        console.log('Password: password123');
        console.log('Access: Public pages only');
        
        console.log('\n👨‍💼 LEVEL 2 - CLIENT ADMIN:');
        console.log('Email: clientadmin@test.com');
        console.log('Password: password123');
        console.log('Client: Demo Media Group');
        console.log('Access: Public pages + Upload dashboard + Management');
        
        console.log('\n🔧 LEVEL 3 - PLATFORM ADMIN:');
        console.log('Email: admin@test.com');
        console.log('Password: password123');
        console.log('Access: Everything (full platform control)');
        
        console.log('\n=====================================');
        console.log('🎯 Use these credentials in login-test-mongodb.html');
        console.log('🌐 Backend API: http://localhost:5000/api/v1/auth/login');
        console.log('💡 Your existing test@example.com account is preserved with all data!');
        
        // Test JWT token generation for one user
        console.log('\n🧪 Testing JWT token generation...');
        const jwt = require('jsonwebtoken');
        const testUser = createdAuthUsers.find(u => u.email === 'clientadmin@test.com');
        
        const payload = {
            user: {
                id: testUser._id,
                role: testUser.role,
                clientId: testUser.clientId ? testUser.clientId.toString() : null
            }
        };
        
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        console.log('✅ JWT token generation successful');
        console.log('Token length:', token.length);
        
        console.log('\n🚀 Setup complete! You can now test authentication.');
        
    } catch (error) {
        console.error('❌ Error setting up test authentication:', error);
        
        if (error.code === 11000) {
            console.log('💡 Note: Some test data may already exist. This is normal.');
        }
    } finally {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');
    }
}

// Run the setup
if (require.main === module) {
    setupTestAuth();
}

module.exports = setupTestAuth;