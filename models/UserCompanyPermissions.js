const mongoose = require("mongoose");

const UserCompanyPermissionsSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true
  },
  role: {
    type: String,
    enum: ["client_user", "client_admin"],
    required: true
  },
  permissions: [{ 
    type: String,
    enum: [
      "upload_assets",
      "manage_releases", 
      "view_analytics",
      "manage_team",
      "download_assets",
      "view_releases"
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // platform_admin who assigned this
  }
}, { timestamps: true });

// Compound index to ensure one role per user per client
UserCompanyPermissionsSchema.index({ userId: 1, clientId: 1 }, { unique: true });

// Index for efficient client-based queries
UserCompanyPermissionsSchema.index({ clientId: 1, isActive: 1 });

// Static method to get user's permissions for a client
UserCompanyPermissionsSchema.statics.getUserClientPermissions = async function(userId, clientId) {
  return await this.findOne({ 
    userId, 
    clientId, 
    isActive: true 
  }).populate('userId', 'email name role')
    .populate('clientId', 'name contactEmail');
};

// Static method to get all clients a user has access to
UserCompanyPermissionsSchema.statics.getUserClients = async function(userId) {
  return await this.find({ 
    userId, 
    isActive: true 
  }).populate('clientId', 'name contactEmail')
    .select('clientId role permissions');
};

// Static method to get all users for a client
UserCompanyPermissionsSchema.statics.getClientUsers = async function(clientId) {
  return await this.find({ 
    clientId, 
    isActive: true 
  }).populate('userId', 'email name role');
};

// Method to check if user has specific permission for client
UserCompanyPermissionsSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

// Pre-save middleware to set default permissions based on role
UserCompanyPermissionsSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('role')) {
    switch (this.role) {
      case 'client_user':
        this.permissions = ['upload_assets', 'view_releases', 'download_assets'];
        break;
      case 'client_admin':
        this.permissions = [
          'upload_assets', 
          'manage_releases', 
          'view_analytics', 
          'manage_team',
          'download_assets',
          'view_releases'
        ];
        break;
    }
  }
  next();
});

module.exports = mongoose.model("UserCompanyPermissions", UserCompanyPermissionsSchema);