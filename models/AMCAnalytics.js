// models/AMCAnalytics.js - Analytics tracking for AutoMediaCenter interactions

const mongoose = require('mongoose');

// User Interaction Schema - tracks all user actions on automediacenter.html
const amcInteractionSchema = new mongoose.Schema({
    // User identification
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    
    // Interaction details
    interactionType: {
        type: String,
        required: true,
        enum: [
            'page_view',           // User visits automediacenter.html
            'release_view',        // User views a specific release
            'asset_download',      // User downloads an asset (image, video, document)
            'asset_quick_view',    // User opens quick view modal
            'asset_add_to_cart',   // User adds asset to download cart
            'search_query',        // User performs search
            'filter_applied',      // User applies filters
            'sort_changed',        // User changes sorting
            'pagination_click',    // User navigates pages
            'release_detail_view', // User opens release detail page
            'share_action',        // User shares content
            'print_action',        // User prints content
            'export_action',       // User exports data
            'heartbeat',           // User session heartbeat
            'page_visible',        // Page becomes visible
            'page_hidden',         // Page becomes hidden
            'scroll_depth',        // User scrolls to certain depth
            'time_on_page',        // Time tracking event
            'page_exit'            // User exits page
        ]
    },
    
    // Content identification
    releaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CenterRelease',
        default: null
    },
    releaseUuid: {
        type: String,
        default: null
    },
    releaseTitle: {
        type: String,
        default: null
    },
    
    // Asset details (for download/view tracking)
    assetType: {
        type: String,
        enum: ['image', 'video', 'document', 'audio', 'other'],
        default: null
    },
    assetName: {
        type: String,
        default: null
    },
    assetPath: {
        type: String,
        default: null
    },
    assetSize: {
        type: Number, // in bytes
        default: null
    },
    
    // Search and filter context
    searchQuery: {
        type: String,
        default: null
    },
    filtersApplied: {
        brand: String,
        dateRange: String,
        assetType: String,
        region: String,
        other: mongoose.Schema.Types.Mixed
    },
    sortBy: {
        type: String,
        default: null
    },
    
    // Technical details
    userAgent: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    referrer: {
        type: String,
        default: null
    },
    
    // Geographic data
    country: {
        type: String,
        default: null
    },
    region: {
        type: String,
        default: null
    },
    city: {
        type: String,
        default: null
    },
    
    // Timing data
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    timeOnPage: {
        type: Number, // seconds
        default: null
    },
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'amcinteractions'
});

// Indexes for performance
amcInteractionSchema.index({ userId: 1, timestamp: -1 });
amcInteractionSchema.index({ interactionType: 1, timestamp: -1 });
amcInteractionSchema.index({ releaseId: 1, timestamp: -1 });
amcInteractionSchema.index({ timestamp: -1 });
amcInteractionSchema.index({ userEmail: 1, timestamp: -1 });
// sessionId index is defined in the schema field definition above

// Media Pickup Tracking Schema - tracks when AMC content is found on external sites
const mediaPickupSchema = new mongoose.Schema({
    // Content identification
    releaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CenterRelease',
        required: true
    },
    releaseUuid: {
        type: String,
        required: true
    },
    releaseTitle: {
        type: String,
        required: true
    },
    
    // Asset details
    assetName: {
        type: String,
        required: true
    },
    assetType: {
        type: String,
        enum: ['image', 'video', 'document', 'audio', 'other'],
        required: true
    },
    originalAssetPath: {
        type: String,
        required: true
    },
    
    // Pickup source details
    sourceUrl: {
        type: String,
        required: true
    },
    sourceDomain: {
        type: String,
        required: true
    },
    sourceTitle: {
        type: String,
        default: null
    },
    
    // Media outlet information
    outletName: {
        type: String,
        default: null
    },
    outletType: {
        type: String,
        enum: ['newspaper', 'magazine', 'blog', 'tv', 'radio', 'social', 'other'],
        default: 'other'
    },
    outletCountry: {
        type: String,
        default: null
    },
    outletRegion: {
        type: String,
        default: null
    },
    
    // Pickup context
    articleTitle: {
        type: String,
        default: null
    },
    articleUrl: {
        type: String,
        default: null
    },
    publishedDate: {
        type: Date,
        default: null
    },
    
    // Detection details
    detectedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    detectionMethod: {
        type: String,
        enum: ['crawler', 'manual', 'api', 'reverse_image_search'],
        default: 'crawler'
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 1
    },
    
    // Status
    status: {
        type: String,
        enum: ['detected', 'verified', 'false_positive', 'removed'],
        default: 'detected'
    },
    
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'mediapickups'
});

// Indexes for media pickups
mediaPickupSchema.index({ releaseId: 1, detectedAt: -1 });
mediaPickupSchema.index({ sourceDomain: 1, detectedAt: -1 });
mediaPickupSchema.index({ detectedAt: -1 });
mediaPickupSchema.index({ status: 1, detectedAt: -1 });

// User Session Schema - tracks user sessions for analytics
const userSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    
    // Session details
    startTime: {
        type: Date,
        default: Date.now,
        required: true
    },
    endTime: {
        type: Date,
        default: null
    },
    duration: {
        type: Number, // seconds
        default: null
    },
    
    // Session metrics
    pageViews: {
        type: Number,
        default: 0
    },
    downloads: {
        type: Number,
        default: 0
    },
    quickViews: {
        type: Number,
        default: 0
    },
    searches: {
        type: Number,
        default: 0
    },
    
    // Technical details
    userAgent: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    
    // Geographic data
    country: {
        type: String,
        default: null
    },
    region: {
        type: String,
        default: null
    },
    city: {
        type: String,
        default: null
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'usersessions'
});

// Indexes for user sessions
userSessionSchema.index({ userId: 1, startTime: -1 });
userSessionSchema.index({ sessionId: 1 });
userSessionSchema.index({ startTime: -1 });
userSessionSchema.index({ isActive: 1, startTime: -1 });

// Create models
const AMCInteraction = mongoose.model('AMCInteraction', amcInteractionSchema);
const MediaPickup = mongoose.model('MediaPickup', mediaPickupSchema);
const UserSession = mongoose.model('UserSession', userSessionSchema);

module.exports = {
    AMCInteraction,
    MediaPickup,
    UserSession
};