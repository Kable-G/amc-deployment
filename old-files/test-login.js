const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testLogin() {
    try {
        console.log('🔌 Testing MongoDB connection...');
        console.log('Connection string:', process.env.MONGO_URI);
        
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected successfully!');
        
        // Test finding the admin user
        console.log('🔍 Looking for admin user...');
        const user = await User.findOne({ email: 'admin@automediacenter.com' }).select('+password');
        
        if (user) {
            console.log('✅ User found:', user.email);
            console.log('User role:', user.role);
            console.log('User ID:', user._id);
            
            // Test password verification
            const isMatch = await user.matchPassword('admin123');
            console.log('Password match:', isMatch ? '✅ YES' : '❌ NO');
        } else {
            console.log('❌ User not found');
            
            // List all users to see what's available
            console.log('📋 Available users:');
            const allUsers = await User.find({}).select('email role');
            allUsers.forEach(u => console.log(`  - ${u.email} (${u.role})`));
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testLogin();