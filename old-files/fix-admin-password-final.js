const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function fixAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the admin user
    const adminUser = await User.findOne({ email: 'admin@automediacenter.com' });
    
    if (!adminUser) {
      console.log('Admin user not found. Creating new admin user...');
      const newAdmin = new User({
        email: 'admin@automediacenter.com',
        name: 'Platform Administrator',
        password: 'password123', // This will be hashed by the pre-save middleware
        role: 'platform_admin'
      });
      await newAdmin.save();
      console.log('✅ New admin user created successfully');
    } else {
      console.log('Admin user found. Updating password...');
      // Update the password - this will trigger the pre-save middleware to hash it
      adminUser.password = 'password123';
      await adminUser.save();
      console.log('✅ Admin password updated successfully');
    }

    // Verify the password works
    const testUser = await User.findOne({ email: 'admin@automediacenter.com' }).select('+password');
    const isMatch = await testUser.matchPassword('password123');
    console.log('🔍 Password verification:', isMatch ? '✅ SUCCESS' : '❌ FAILED');

    console.log('Final admin user details:');
    console.log('- Email:', testUser.email);
    console.log('- Role:', testUser.role);
    console.log('- Password hash length:', testUser.password.length);

    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAdminPassword();