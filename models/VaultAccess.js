// models/VaultAccess.js
// One record per (journalist × vault) pair.
// Tracks NDA signing, password delivery, and access state.

const mongoose = require('mongoose');

const vaultAccessSchema = new mongoose.Schema({

  // The journalist who signed / is accessing
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // The vault being accessed
  vaultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultAsset',
    required: true
  },

  // ── NDA record ──────────────────────────────────────────────
  signatureName:  { type: String },          // typed legal name
  signedAt:       { type: Date },
  signingIp:      { type: String },
  signingDevice:  { type: String },          // UA string

  // ── Password delivery ────────────────────────────────────────
  passwordHash:         { type: String },    // bcrypt hash, never plaintext
  passwordSetAt:        { type: Date },
  deliveryMethods:      { type: [String], enum: ['email', 'sms'], default: [] },
  emailDispatchedAt:    { type: Date },
  smsDispatchedAt:      { type: Date },
  resendCount:          { type: Number, default: 0 },
  lastResendAt:         { type: Date },

  // ── Access state ─────────────────────────────────────────────
  accessGranted:     { type: Boolean, default: false },
  accessGrantedAt:   { type: Date },
  failedAttempts:    { type: Number, default: 0 },
  lockedAt:          { type: Date },          // set when failedAttempts >= MAX
  lastAccessedAt:    { type: Date },
  signedNdaPdfPath:  { type: String, default: null },

}, {
  timestamps: true,
  collection: 'vault_access'
});

// One access record per journalist per vault
vaultAccessSchema.index({ userId: 1, vaultId: 1 }, { unique: true });

module.exports = mongoose.model('VaultAccess', vaultAccessSchema);