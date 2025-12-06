const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  companyId: { type: String, unique: true, required: true }, // e.g. "MB001"
  name: { type: String, required: true },                    // e.g. "Mercedes-Benz"
  legalName: {                                               // e.g. "Mercedes-Benz AG"
    type: String,
    trim: true
  },
  primaryDomain: {                                           // e.g. "mercedes-benz.com"
    type: String,
    trim: true,
    lowercase: true
  },
  
  // Contact information for enterprise onboarding
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required for onboarding'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address.']
  },
  contactPerson: {
    type: String,
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  companyWebsite: {
    type: String,
    trim: true
  },
  
  // Enterprise lifecycle management
  status: {
    type: String,
    enum: ["pending", "active", "suspended", "cancelled"],
    default: "pending",
    required: true
  },
  billingStatus: {
    type: String,
    enum: ["ok", "overdue", "terminated"],
    default: "ok",
    required: true
  },
  
  // Plan and settings for enterprise features
  planType: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'enterprise'
  },
  settings: {
    maxUsers: { type: Number, default: 100 },
    uploadLimitMB: { type: Number, default: 1000 },
    embargoAccess: { type: Boolean, default: true },
    analyticsAccess: { type: Boolean, default: true }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
CompanySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if company is active and can operate
CompanySchema.methods.canOperate = function() {
  return this.status === 'active' && this.billingStatus !== 'terminated';
};

// Static method to find companies that can operate
CompanySchema.statics.findActive = function() {
  return this.find({
    status: 'active',
    billingStatus: { $ne: 'terminated' }
  });
};

module.exports = mongoose.model("Company", CompanySchema);