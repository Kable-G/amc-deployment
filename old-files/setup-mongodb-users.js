// setup-mongodb-users.js
// Script to set up the three-level user authentication system in MongoDB Atlas

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('./models/User');
const Client = require('./models/Client');

async function setupMongoDBUsers() {
    try {
        console.log('🔗 Connecting to MongoDB Atlas...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB Atlas successfully');

        // Step 1: Create Test Client Company
        console.log('\n📋 Step 1: Setting up Test Client Company...');
        let testClient = await Client.findOne({ name: 'Test Client Corp' });
        
        if (!testClient) {
            testClient = await Client.create({
                name: 'Test Client Corp',
                description: 'Test client company for three-level authentication system',
                contactEmail: 'contact@testclient.com',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('✅ Created Test Client Corp');
            console.log(`   Client ID: ${testClient._id}`);
        } else {
            console.log('✅ Test Client Corp already exists');
            console.log(`   Client ID: ${testClient._id}`);
        }

        // Step 2: Define the three-level user system
        console.log('\n👥 Step 2: Setting up Three-Level User System...');
        
        const userProfiles = [
            {
                email: 'public@test.com',
                password: 'password123',
                name: 'Public Test User',
                role: 'media_user',
                clientId: null,
                level: 1,
                description: 'Level 1 - Can only view public pages (AutoMediaCenter, AutoMediaRadar)'
            },
            {
                email: 'testuser@example.com',
                password: 'password123',
                name: 'Your Existing Account',
                role: 'client_user',
                clientId: testClient._id,
                level: 2,
                description: 'Level 2 - Can access upload dashboard and manage own releases'
            },
            {
                email: 'clientadmin@test.com',
                password: 'password123',
                name: 'Client Admin User',
                role: 'client_admin',
                clientId: testClient._id,
                level: 2,
                description: 'Level 2 - Can access upload dashboard + client admin functions'
            },
            {
                email: 'admin@test.com',
                password: 'password123',
                name: 'Platform Admin User',
                role: 'platform_admin',
                clientId: null,
                level: 3,
                description: 'Level 3 - Full platform access, can manage all users and content'
            }
        ];

        console.log('\n🔧 Creating/Updating user profiles...\n');

        for (const profile of userProfiles) {
            try {
                // Check if user exists
                let user = await User.findOne({ email: profile.email });
                
                // Hash the password
                const hashedPassword = await bcrypt.hash(profile.password, 10);
                
                if (user) {
                    // Update existing user
                    user.name = profile.name;
                    user.password = hashedPassword;
                    user.role = profile.role;
                    user.clientId = profile.clientId;
                    user.isActive = true;
                    user.updatedAt = new Date();
                    
                    await user.save();
                    console.log(`✅ UPDATED: ${profile.email}`);
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
                console.log(`   Level: ${profile.level}`);
                console.log(`   Client: ${profile.clientId ? 'Test Client Corp' : 'None'}`);
                console.log(`   Description: ${profile.description}`);
                console.log(`   User ID: ${user._id}`);
                console.log('');
                
            } catch (userError) {
                console.error(`❌ Error with user ${profile.email}:`, userError.message);
            }
        }

        // Step 3: Verify the setup
        console.log('🔍 Step 3: Verifying user setup...\n');
        
        const allUsers = await User.find({}).populate('clientId');
        console.log(`Total users in database: ${allUsers.length}`);
        
        for (const user of allUsers) {
            console.log(`📧 ${user.email} | Role: ${user.role} | Client: ${user.clientId ? user.clientId.name : 'None'}`);
        }

        console.log('\n🎉 MongoDB User Setup Complete!');
        console.log('\n📋 ACCESS LEVELS SUMMARY:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('Level 1 (media_user): public@test.com');
        console.log('  ✓ AutoMediaCenter public pages');
        console.log('  ✓ AutoMediaRadar public pages');
        console.log('  ✗ Upload dashboard (AssetDBmenu1.6.html)');
        console.log('  ✗ Management tools');
        console.log('');
        console.log('Level 2 (client_user): testuser@example.com');
        console.log('  ✓ All Level 1 permissions');
        console.log('  ✓ Upload dashboard (AssetDBmenu1.6.html)');
        console.log('  ✓ Manage own releases');
        console.log('  ✗ Platform admin functions');
        console.log('');
        console.log('Level 2 (client_admin): clientadmin@test.com');
        console.log('  ✓ All Level 2 permissions');
        console.log('  ✓ Client management tools');
        console.log('  ✓ Manage all client releases');
        console.log('  ✗ Platform admin functions');
        console.log('');
        console.log('Level 3 (platform_admin): admin@test.com');
        console.log('  ✓ All permissions');
        console.log('  ✓ User management');
        console.log('  ✓ System settings');
        console.log('  ✓ Delete/modify any content');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('\n🔐 All passwords: password123');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.error('Full error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB Atlas');
    }
}

// Run the setup
if (require.main === module) {
    setupMongoDBUsers();
}

module.exports = setupMongoDBUsers;