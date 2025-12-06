const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const publicUserSchema = new mongoose.Schema({
  // Basic Info
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: function() {
      return !this.oauthProviders || this.oauthProviders.length === 0;
    },
    minlength: 6
  },
  
  // OAuth Providers
  oauthProviders: [{
    provider: {
      type: String,
      enum: ['google', 'microsoft', 'linkedin', 'github'],
      required: true
    },
    providerId: {
      type: String,
      required: true
    },
    email: String,
    name: String,
    avatar: String,
    accessToken: String,
    refreshToken: String,
    connectedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Profile Info
  profile: {
    firstName: String,
    lastName: String,
    company: String,
    jobTitle: String,
    avatar: String,
    bio: String,
    website: String,
    location: String
  },

  // Subscription Tier
  subscriptionTier: {
    type: String,
    enum: ['free', 'professional', 'enterprise'],
    default: 'free'
  },

  // Preferences
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsNotifications: {
      type: Boolean,
      default: false
    },
    whatsappNotifications: {
      type: Boolean,
      default: false
    },
    notificationFrequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly'],
      default: 'daily'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // Following/Subscriptions
  followedCompanies: [{
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    followedAt: {
      type: Date,
      default: Date.now
    },
    notificationSettings: {
      newReleases: {
        type: Boolean,
        default: true
      },
      radarAlerts: {
        type: Boolean,
        default: true
      },
      vaultUpdates: {
        type: Boolean,
        default: false
      }
    }
  }],

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Password Reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Login Tracking
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  
  // API Access
  apiKey: String,
  apiKeyCreatedAt: Date,
  
  // Terms & Privacy
  termsAcceptedAt: Date,
  privacyAcceptedAt: Date,
  marketingOptIn: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
publicUserSchema.index({ email: 1 });
publicUserSchema.index({ username: 1 });
publicUserSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerId': 1 });
publicUserSchema.index({ subscriptionTier: 1 });
publicUserSchema.index({ isActive: 1 });

// Virtual for full name
publicUserSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

// Hash password before saving
publicUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Compare password method
publicUserSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate API key
publicUserSchema.methods.generateApiKey = function() {
  const crypto = require('crypto');
  this.apiKey = crypto.randomBytes(32).toString('hex');
  this.apiKeyCreatedAt = new Date();
  return this.apiKey;
};

// Check if user has OAuth provider
publicUserSchema.methods.hasOAuthProvider = function(provider) {
  return this.oauthProviders.some(p => p.provider === provider);
};

// Add OAuth provider
publicUserSchema.methods.addOAuthProvider = function(providerData) {
  // Remove existing provider if it exists
  this.oauthProviders = this.oauthProviders.filter(p => p.provider !== providerData.provider);
  
  // Add new provider
  this.oauthProviders.push(providerData);
};

// Get followed companies with details
publicUserSchema.methods.getFollowedCompanies = function() {
  return this.populate('followedCompanies.clientId', 'clientName logo description');
};

// Follow a company
publicUserSchema.methods.followCompany = function(clientId, notificationSettings = {}) {
  const existingFollow = this.followedCompanies.find(f => f.clientId.toString() === clientId.toString());
  
  if (!existingFollow) {
    this.followedCompanies.push({
      clientId,
      notificationSettings: {
        newReleases: notificationSettings.newReleases !== false,
        radarAlerts: notificationSettings.radarAlerts !== false,
        vaultUpdates: notificationSettings.vaultUpdates === true
      }
    });
  }
  
  return this.save();
};

// Unfollow a company
publicUserSchema.methods.unfollowCompany = function(clientId) {
  this.followedCompanies = this.followedCompanies.filter(f => f.clientId.toString() !== clientId.toString());
  return this.save();
};

// Update last login
publicUserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

// Remove sensitive data from JSON output
publicUserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationToken;
  delete user.passwordResetToken;
  delete user.oauthProviders.forEach(provider => {
    delete provider.accessToken;
    delete provider.refreshToken;
  });
  return user;
};

module.exports = mongoose.model('PublicUser', publicUserSchema);