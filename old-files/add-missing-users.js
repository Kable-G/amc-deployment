// add-missing-users.js
// Script to add the missing media_user and update existing users to match login-test-mongodb.html

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./models/User');
const Client = require('./models/Client');

async function addMissingUsers() {
    try {
        console.log('🔗 Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas successfully');

        // Check existing client
        let testClient = await Client.findOne({ _id: '682ca399bd0e29e5935474ca' });
        if (!testClient) {
            console.log('⚠️  Client 682ca399bd0e29e5935474ca not found, creating new one...');
            testClient = await Client.create({
                name: 'Test Client Corp',
                description: 'Test client company for authentication system',
                contactEmail: 'contact@testclient.com',
                isActive: true
            });
            console.log('✅ Created new Test Client Corp:', testClient._id);
        } else {
            console.log('✅ Found existing client:', testClient.name);
        }

        // Users to add/update
        const usersToSetup = [
            {
                email: 'public@test.com',
                password: 'password123',
                name: 'Public Test User',
                role: 'media_user',
                clientId: null,
                description: 'Level 1 - Public user (cannot access AssetDBmenu1.6.html)'
            },
            {
                email: 'testuser@example.com',
                password: 'password123',
                name: 'Your Existing Account',
                role: 'client_admin', // Keep existing role
                clientId: testClient._id,
                description: 'Level 2 - Client admin (can access AssetDBmenu1.6.html)',
                update: true // Update existing user
            },
            {
                email: 'clientadmin@test.com',
                password: 'password123',
                name: 'Client Admin User',
                role: 'client_admin',
                clientId: testClient._id,
                description: 'Level 2 - Client admin (can access AssetDBmenu1.6.html)'
            },
            {
                email: 'admin@test.com',
                password: 'password123',
                name: 'Platform Admin User',
                role: 'platform_admin',
                clientId: null,
                description: 'Level 3 - Platform admin (full access)'
            }
        ];

        console.log('\n👥 Setting up users for three-level authentication...\n');

        for (const profile of usersToSetup) {
            try {
                let user = await User.findOne({ email: profile.email });
                const hashedPassword = await bcrypt.hash(profile.password, 10);
                
                if (user) {
                    if (profile.update || profile.email === 'testuser@example.com') {
                        // Update existing user
                        user.name = profile.name;
                        user.password = hashedPassword;
                        user.clientId = profile.clientId;
                        user.updatedAt = new Date();
                        await user.save();
                        console.log(`✅ UPDATED: ${profile.email}`);
                    } else {
                        console.log(`ℹ️  EXISTS: ${profile.email} (skipping)`);
                    }
                } else {
                    // Create new user
                    user = await User.create({
                        email: profile.email,
                        password: hashedPassword,
                        name: profile.name,
                        role: profile.role,
                        clientId: profile.clientId,
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    console.log(`✅ CREATED: ${profile.email}`);
                }
                
                console.log(`   Name: ${profile.name}`);
                console.log(`   Role: ${profile.role}`);
                console.log(`   Client: ${profile.clientId ? 'Test Client Corp' : 'None'}`);
                console.log(`   Description: ${profile.description}`);
                console.log(`   User ID: ${user._id}`);
                console.log('');
                
            } catch (userError) {
                console.error(`❌ Error with user ${profile.email}:`, userError.message);
            }
        }

        // Verify setup
        console.log('🔍 Current users in database:\n');
        const allUsers = await User.find({}).populate('clientId');
        
        for (const user of allUsers) {
            const clientName = user.clientId ? user.clientId.name : 'None';
            const accessLevel = getAccessLevel(user.role);
            console.log(`📧 ${user.email}`);
            console.log(`   Role: ${user.role} (${accessLevel})`);
            console.log(`   Client: ${clientName}`);
            console.log(`   Can access AssetDBmenu1.6.html: ${canAccessAssetDB(user.role) ? '✅ YES' : '❌ NO'}`);
            console.log('');
        }

        console.log('🎉 User setup complete!');
        console.log('\n📋 TESTING INSTRUCTIONS:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('1. Go to: http://localhost:5000/login-test-mongodb.html');
        console.log('2. Test login as public@test.com (should NOT access AssetDBmenu1.6.html)');
        console.log('3. Test login as testuser@example.com (should access AssetDBmenu1.6.html)');
        console.log('4. All passwords are: password123');
        console.log('═══════════════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB Atlas');
    }
}

function getAccessLevel(role) {
    switch(role) {
        case 'media_user': return 'Level 1 - Public User';
        case 'client_user': return 'Level 2 - Client User';
        case 'client_admin': return 'Level 2 - Client Admin';
        case 'platform_admin': return 'Level 3 - Platform Admin';
        default: return 'Unknown Level';
    }
}

function canAccessAssetDB(role) {
    return ['client_user', 'client_admin', 'platform_admin'].includes(role);
}

// Run the setup
addMissingUsers();