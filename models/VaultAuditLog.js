// models/VaultAuditLog.js
// Append-only audit trail. Records are never updated or deleted.
// Every significant vault event is written here.

const mongoose = require('mongoose');

const vaultAuditLogSchema = new mongoose.Schema({
  event:    { type: String, required: true },   // see EVENTS below
  vaultId:  { type: mongoose.Schema.Types.ObjectId, ref: 'VaultAsset' },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  meta:     { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:       { type: String },
  ua:       { type: String },                   // user-agent
  ts:       { type: Date, default: Date.now }
}, {
  collection: 'vault_audit_log'
});

// Prevent updates — records are immutable
vaultAuditLogSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('VaultAuditLog records are immutable'));
  next();
});

// Disable findOneAndUpdate etc. to enforce immutability
vaultAuditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function (next) {
  next(new Error('VaultAuditLog records cannot be modified'));
});

const VaultAuditLog = mongoose.model('VaultAuditLog', vaultAuditLogSchema);

// Event type constants — import these wherever you write audit events
VaultAuditLog.EVENTS = {
  NDA_SIGNED:          'NDA_SIGNED',
  PASSWORD_DISPATCHED: 'PASSWORD_DISPATCHED',
  PASSWORD_RESENT:     'PASSWORD_RESENT',
  VAULT_UNLOCKED:      'VAULT_UNLOCKED',
  VAULT_ACCESSED:      'VAULT_ACCESSED',
  ASSET_DOWNLOADED:    'ASSET_DOWNLOADED',
  FAILED_ATTEMPT:      'FAILED_ATTEMPT',
  VAULT_LOCKED:        'VAULT_LOCKED',
};

module.exports = VaultAuditLog;