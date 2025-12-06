const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required for invitation'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address.']
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: [true, 'Company ID is required for invitation'],
    index: true
  },
  role: { 
    type: String, 
    enum: ["client_admin", "client_user"], 
    default: "client_user",
    required: true
  },
  token: { 
    type: String, 
    required: [true, 'Invitation token is required'],
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "expired", "revoked"],
    default: "pending",
    required: true
  },
  // Who sent this invitation (platform_admin or client_admin)
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // When the invitation was accepted (if applicable)
  acceptedAt: {
    type: Date
  },
  // User who accepted the invitation (if applicable)
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  // When the invitation was redeemed (alias for acceptedAt for consistency)
  redeemedAt: {
    type: Date
  },
  // When the invitation was revoked (if applicable)
  revokedAt: {
    type: Date
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  expiresAt: {
    type: Date,
    default: () => Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    required: true
  },
  // Email tracking fields
  emailStatus: {
    type: String,
    enum: ["pending", "sent", "failed"],
    default: "pending"
  },
  emailAttempts: {
    type: Number,
    default: 0
  },
  emailSentAt: {
    type: Date
  },
  emailError: {
    type: String
  },
  // Additional fields for company name and first name (for email template)
  companyName: {
    type: String
  },
  firstName: {
    type: String
  }
});

// Index for efficient cleanup of expired invitations
inviteSchema.index({ expiresAt: 1 });

// Index for finding invitations by client
inviteSchema.index({ clientId: 1, status: 1 });

// Method to check if invitation is expired
inviteSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt;
};

// Method to mark invitation as accepted
inviteSchema.methods.markAccepted = function(userId) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.redeemedAt = new Date(); // Set both for consistency
  this.acceptedBy = userId;
  return this.save();
};

// Method to mark invitation as revoked
inviteSchema.methods.markRevoked = function() {
  this.status = 'revoked';
  this.revokedAt = new Date();
  return this.save();
};

// Static method to find valid invitation by token
inviteSchema.statics.findValidInvitation = function(token) {
  return this.findOne({
    token,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('clientId', 'name contactEmail status');
};

// Static method to cleanup expired invitations
inviteSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
};

// Static method to get invitation statistics for a company
inviteSchema.statics.getCompanyStats = function(clientId) {
  return this.aggregate([
    { $match: { clientId: mongoose.Types.ObjectId(clientId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Pre-save middleware to auto-expire if past expiration date
inviteSchema.pre('save', function(next) {
  if (this.status === 'pending' && this.isExpired()) {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model("Invite", inviteSchema);