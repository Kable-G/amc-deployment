// models/LiveEvent.js
// AutoMediaLive — live streaming event model
// Patterns match RadarAlert.js and CenterRelease.js exactly

const mongoose = require('mongoose');

const LiveEventSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: 200,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      maxlength: 100,
    },
    company: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    // ── Schedule ──────────────────────────────────────────────
    // Stored in UTC — same pattern as RadarAlert.eventDateTime
    eventDateTime: {
      type: Date,
      required: [true, 'Event date/time is required'],
    },
    timezone: {
      type: String,       // IANA string e.g. "Europe/Berlin"
      default: 'UTC',
    },
    earlyAccessMins: {
      type: Number,
      enum: [0, 10, 15, 20, 30],
      default: 15,
    },
    startTrigger: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual',
    },

    // ── Status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['draft', 'upcoming', 'ready', 'live', 'recording', 'cancelled'],
      default: 'upcoming',
    },

    // ── Category / Language ───────────────────────────────────
    category: {
      type: String,
      trim: true,
    },
    primaryLanguage: {
      type: String,
      default: 'English',
    },
    captionLanguages: [String],
    captionSource: {
      type: String,
      enum: ['none', 'auto', 'live_human'],
      default: 'none',
    },

    // ── Teaser image ──────────────────────────────────────────
    teaserImageUrl: {
      type: String,
      trim: true,
    },

    // ── Stream source ─────────────────────────────────────────
    sourceType: {
      type: String,
      enum: ['rtmp_push', 'srt_listener', 'srt_caller', 'hls_pull', 'webrtc'],
      default: 'rtmp_push',
    },
    rtmpUrl:   { type: String, trim: true },
    streamKey: { type: String, trim: true },
    hlsUrl:    { type: String, trim: true },
    srtUrl:    { type: String, trim: true },

    // ── Processing & output ───────────────────────────────────
    transcodingProfile: {
      type: String,
      default: 'auto_adaptive',
    },
    latency: {
      type: String,
      enum: ['normal', 'low', 'ultralow'],
      default: 'low',
    },
    recordStream:  { type: Boolean, default: true },
    autoArchive:   { type: Boolean, default: true },

    // ── Appearance ────────────────────────────────────────────
    accentColour: { type: String, default: '#3b82f6' },

    // ── Access & visibility ───────────────────────────────────
    visibility: {
      type: String,
      enum: ['public', 'unlisted', 'private'],
      default: 'public',
    },
    requireRegistration: { type: Boolean, default: false },

    // ── Live stats ────────────────────────────────────────────
    viewerCount:     { type: Number, default: 0 },
    peakViewerCount: { type: Number, default: 0 },

    // ── Rights ────────────────────────────────────────────────
    rightsConfirmed:  { type: Boolean, default: false },
    streamingRights:  { type: Boolean, default: false },
    contentWarnings:  { type: Boolean, default: false },

    // ── Ownership ─────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    },
    linkedAssets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Asset' }],
  },
  { timestamps: true }
);

// Indexes matching RadarAlert patterns
LiveEventSchema.index({ status: 1, eventDateTime: 1 });
LiveEventSchema.index({ createdBy: 1, createdAt: -1 });
LiveEventSchema.index({ clientId: 1, status: 1 });

module.exports = mongoose.model('LiveEvent', LiveEventSchema);
