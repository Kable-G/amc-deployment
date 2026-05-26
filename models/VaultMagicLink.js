// models/VaultMagicLink.js
// One magic link token per journalist per vault invitation.
// Used to authenticate journalists directly from email links.
'use strict';
const mongoose = require('mongoose');

const vaultMagicLinkSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  vaultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultAsset',
    required: true
  },
  vaultAssetUUID: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['active', 'used', 'expired', 'revoked'],
    default: 'active'
  },
  usedAt: { type: Date, default: null },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    required: true
  }
}, {
  timestamps: true,
  collection: 'vault_magic_links'
});

vaultMagicLinkSchema.index({ vaultId: 1, userId: 1 });
vaultMagicLinkSchema.index({ expiresAt: 1 });

vaultMagicLinkSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt;
};

vaultMagicLinkSchema.statics.findValid = function(token) {
  return this.findOne({
    token,
    status: 'active',
    expiresAt: { $gt: new Date() }
  });
};

module.exports = mongoose.model('VaultMagicLink', vaultMagicLinkSchema);
