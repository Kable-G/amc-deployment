const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://localhost:27017/automediacenter', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  role: String,
  clientId: mongoose.Schema.Types.ObjectId
});

const User = mongoose.model('User', userSchema);

async function fixUserPassword() {
  try {
    console.log('Looking for user: testuser@example.com');
    
    // First, check if user exists
    const user = await User.findOne({ email: 'testuser@example.com' });
    
    if (user) {
      console.log('User found:');
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Name:', user.name);
      
      // Hash the password properly
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('password123', saltRounds);
      
      // Update the user's password
      await User.updateOne(
        { email: 'testuser@example.com' },
        { password: hashedPassword }
      );
      
      console.log('✅ Password updated successfully for testuser@example.com');
      
      // Verify the password works
      const updatedUser = await User.findOne({ email: 'testuser@example.com' });
      const isValid = await bcrypt.compare('password123', updatedUser.password);
      console.log('✅ Password verification test:', isValid ? 'PASSED' : 'FAILED');
      
    } else {
      console.log('❌ User not found. Creating new user...');
      
      // Create the user if it doesn't exist
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash('password123', saltRounds);
      
      const newUser = new User({
        email: 'testuser@example.com',
        password: hashedPassword,
        name: 'Test User',
        role: 'client_admin' // Make sure it's a Level 2 user
      });
      
      await newUser.save();
      console.log('✅ New user created: testuser@example.com');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

fixUserPassword();