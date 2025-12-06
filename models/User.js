// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); 

// Define the structure (schema) for documents in the 'users' collection
const userSchema = new mongoose.Schema({
  // User's email address - should be unique and is required
  email: {
    type: String,
    required: [true, 'Please provide an email address.'], 
    unique: true, 
    lowercase: true, 
    match: [ 
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address.'
    ]
  },

  // User's hashed password - required
  password: {
    type: String,
    required: [true, 'Please provide a password.'],
    minlength: [6, 'Password must be at least 6 characters long.'], 
    select: false 
  },

  // User's role - determines access level
  // --- MODIFIED ROLE ENUM ---
  role: {
    type: String,
    enum: [
        'client_user',      // A standard user belonging to a client company
        'client_admin',     // An admin user for a specific client company
        'platform_admin',   // Your team, managing the whole platform
        'media_user'        // (Optional) If media users also log into any part of your system
    ], 
    default: 'client_user', 
    required: true // It's good practice to require a role
  },
  // --- END MODIFIED ROLE ENUM ---

  // Optional: User's name
  name: {
    type: String,
    trim: true
  },

  // --- NEW SIGNUP FIELDS ---
  jobTitle: {
    type: String,
    required: false, // Optional for backward compatibility
    trim: true
  },

  country: {
    type: String,
    required: false, // Optional for backward compatibility
    trim: true
  },

  // Optional company field
  company: {
    type: String,
    required: false,
    trim: true
  },

  // --- EMAIL VERIFICATION FIELDS ---
  emailVerified: {
    type: Boolean,
    default: false
  },

  verificationCode: {
    type: String,
    select: false // Don't include in queries by default
  },

  verificationExpires: {
    type: Date,
    select: false // Don't include in queries by default
  },

  // --- PASSWORD RESET FIELDS ---
  passwordResetToken: {
    type: String,
    select: false // Don't include in queries by default
  },

  passwordResetExpires: {
    type: Date,
    select: false // Don't include in queries by default
  },

  // --- NEW CLIENTID FIELD ---
  clientId: { // Link to the Company this user belongs to
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company', // IMPORTANT: This MUST match the name of your Company Mongoose model
    index: true // Good for performance if you query users by clientId
    // This field should be populated for users with 'client_user' or 'client_admin' roles.
    // It can be null for 'platform_admin' or 'media_user' if they don't belong to a specific company.
  },
  // --- END NEW CLIENTID FIELD ---

  // User status for lifecycle management
  isActive: {
    type: Boolean,
    default: true
  },

  // Track last login for admin dashboards
  lastLoginAt: {
    type: Date
  },

  // Optional: Add timestamps for when the user was created/updated
  // createdAt: { // This is handled by {timestamps: true} below
  //   type: Date,
  //   default: Date.now
  // },
   // You could add more fields here later: company, jobTitle, etc.

}, { timestamps: true }); // Alternate way to add createdAt and updatedAt automatically


// --- Mongoose Middleware (runs BEFORE saving a user document) ---
// This function hashes the password *before* it gets saved to the database
userSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified (or is new)
  if (!this.isModified('password')) {
    return next(); // Skip hashing if password hasn't changed
  }

  try {
    // Generate a "salt" - random data to make hash unique even for same passwords
    const salt = await bcrypt.genSalt(10); // 10 rounds is generally secure enough
    // Hash the password using the generated salt
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Continue with the save operation
  } catch (error) {
    next(error); // Pass any error during hashing to the main error handler
  }
});


// --- Mongoose Instance Method (available on documents fetched from DB) ---
// This function compares an incoming password with the stored hashed password
userSchema.methods.matchPassword = async function(enteredPassword) {
  // 'this.password' refers to the hashed password stored in the database document
  // bcrypt.compare handles comparing the plain text password with the hash
  return await bcrypt.compare(enteredPassword, this.password);
};


// Create the Mongoose model named 'User' based on the schema
// This will interact with the 'users' collection in MongoDB where the actual user data is stored
const User = mongoose.model('User', userSchema, 'users');

// Export the User model
module.exports = User;