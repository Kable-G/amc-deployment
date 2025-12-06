// fix-admin-password.js
// Script to fix the admin user password

const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function fixAdminPassword() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find the admin user
        const adminUser = await User.findOne({ email: 'admin@test.com' });
        
        if (!adminUser) {
            console.log('❌ Admin user not found');
            return;
        }

        console.log('✅ Found admin user:', adminUser.email);
        
        // Update the password (this will trigger the pre('save') middleware to hash it)
        adminUser.password = 'password123';
        await adminUser.save();
        
        console.log('✅ Admin password updated and hashed successfully');
        console.log('📧 Email: admin@test.com');
        console.log('🔑 Password: password123');
        console.log('👤 Role:', adminUser.role);
        
    } catch (error) {
        console.error('❌ Error fixing admin password:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 MongoDB connection closed');
    }
}

// Run the fix
if (require.main === module) {
    fixAdminPassword();
}

module.exports = fixAdminPassword;