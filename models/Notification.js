// models/Notification.js
'use strict';

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:       { type: String, enum: ['vault_invite'], default: 'vault_invite' },
  read:       { type: Boolean, default: false, index: true },
  brand:      { type: String },          // e.g. "Skoda"
  companyName:{ type: String },          // e.g. "Volkswagen Group"
  vaultTitle: { type: String, required: true },
  vaultId:    { type: mongoose.Schema.Types.ObjectId, ref: 'VaultAsset' },
  embargoUntil:       { type: Date },
  availabilityTimezone: { type: String, default: 'Europe/Berlin' },
}, {
  timestamps: true
});

// Compound index for fast unread lookups per user
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);