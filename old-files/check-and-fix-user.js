// check-and-fix-user.js
// Script to check and fix your existing test user account

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Client = require('./models/Client');
require('dotenv').config();

async function checkAndFixUser() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Check existing test user
        console.log('\n🔍 Checking existing test@example.com user...');
        const existingUser = await User.findOne({ email: 'test@example.com' });
        
        if (existingUser) {
            console.log('✅ Found existing user:');
            console.log(`   Email: ${existingUser.email}`);
            console.log(`   Name: ${existingUser.name}`);
            console.log(`   Role: ${existingUser.role}`);
            console.log(`   ClientId: ${existingUser.clientId}`);
            console.log(`   Created: ${existingUser.createdAt}`);
            
            // Get client info if exists
            if (existingUser.clientId) {
                const client = await Client.findById(existingUser.clientId);
                if (client) {
                    console.log(`   Client: ${client.clientName}`);
                }
            }
            
            // Update user to ensure it works with new system
            console.log('\n🔧 Updating user for new authentication system...');
            
            // Hash the password 'password123'
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);
            
            // Find or create Test Client Corp
            let testClient = await Client.findOne({ clientName: 'Test Client Corp' });
            if (!testClient) {
                testClient = await Client.create({
                    clientName: 'Test Client Corp',
                    contactPerson: 'Test User',
                    contactEmail: 'test@example.com',
                    isActive: true
                });
                console.log('✅ Created Test Client Corp');
            }
            
            // Update the user
            existingUser.password = hashedPassword;
            existingUser.role = 'client_user';
            existingUser.clientId = testClient._id;
            if (!existingUser.name) {
                existingUser.name = 'Test User';
            }
            
            await existingUser.save();
            
            console.log('✅ User updated successfully!');
            console.log('\n🎯 LOGIN CREDENTIALS:');
            console.log('Email: test@example.com');
            console.log('Password: password123');
            console.log(`Role: ${existingUser.role}`);
            console.log(`Client: ${testClient.clientName}`);
            
        } else {
            console.log('❌ No existing test@example.com user found');
            console.log('Creating new test user...');
            
            // Create Test Client Corp
            let testClient = await Client.findOne({ clientName: 'Test Client Corp' });
            if (!testClient) {
                testClient = await Client.create({
                    clientName: 'Test Client Corp',
                    contactPerson: 'Test User',
                    contactEmail: 'test@example.com',
                    isActive: true
                });
            }
            
            // Create new user
            const newUser = await User.create({
                email: 'test@example.com',
                password: 'password123', // Will be hashed by pre-save middleware
                name: 'Test User',
                role: 'client_user',
                clientId: testClient._id
            });
            
            console.log('✅ Created new test user');
            console.log('\n🎯 LOGIN CREDENTIALS:');
            console.log('Email: test@example.com');
            console.log('Password: password123');
            console.log(`Role: ${newUser.role}`);
            console.log(`Client: ${testClient.clientName}`);
        }
        
        // Test password verification
        console.log('\n🧪 Testing password verification...');
        const testUser = await User.findOne({ email: 'test@example.com' }).select('+password');
        const isPasswordValid = await testUser.matchPassword('password123');
        console.log(`Password verification: ${isPasswordValid ? '✅ VALID' : '❌ INVALID'}`);
        
        if (!isPasswordValid) {
            console.log('🔧 Fixing password...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);
            testUser.password = hashedPassword;
            await testUser.save();
            console.log('✅ Password fixed!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');
    }
}

// Run the check
if (require.main === module) {
    checkAndFixUser();
}

module.exports = checkAndFixUser;