const mongoose = require('mongoose');

// Comprehensive user analytics and data collection model
const userAnalyticsSchema = new mongoose.Schema({
  // User identification
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'EnhancedUser',
    required: true,
    index: true
  },
  sessionId: { 
    type: String, 
    required: true,
    index: true
  },
  
  // Session tracking
  sessionData: {
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    duration: Number, // in seconds
    ipAddress: String,
    userAgent: String,
    browser: String,
    browserVersion: String,
    os: String,
    device: String,
    screenResolution: String,
    timezone: String,
    language: String,
    referrer: String,
    landingPage: String,
    exitPage: String
  },
  
  // Geographic data (for analytics and targeting)
  location: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    isp: String,
    organization: String
  },
  
  // Page views and navigation
  pageViews: [{
    page: String,
    url: String,
    title: String,
    timestamp: { type: Date, default: Date.now },
    timeOnPage: Number, // seconds
    scrollDepth: Number, // percentage
    interactions: [{
      type: { type: String, enum: ['click', 'scroll', 'hover', 'form_input', 'download', 'search'] },
      element: String,
      value: String,
      timestamp: { type: Date, default: Date.now }
    }]
  }],
  
  // Content engagement
  contentInteractions: [{
    contentType: { type: String, enum: ['release', 'radar_alert', 'vault_asset', 'live_stream'] },
    contentId: String,
    action: { type: String, enum: ['view', 'download', 'share', 'bookmark', 'comment', 'like'] },
    timestamp: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed // Additional context data
  }],
  
  // Search behavior
  searchQueries: [{
    query: String,
    resultsCount: Number,
    clickedResults: [String],
    timestamp: { type: Date, default: Date.now },
    source: String // 'main_search', 'filter', 'autocomplete'
  }],
  
  // Download tracking
  downloads: [{
    assetId: String,
    assetType: { type: String, enum: ['image', 'video', 'document', 'zip'] },
    fileName: String,
    fileSize: Number,
    downloadTime: { type: Date, default: Date.now },
    downloadDuration: Number, // seconds
    completed: { type: Boolean, default: true },
    source: String // 'release_page', 'search_results', 'email_link'
  }],
  
  // Form interactions and conversions
  formInteractions: [{
    formType: { type: String, enum: ['registration', 'login', 'contact', 'subscription', 'feedback'] },
    formId: String,
    started: { type: Date, default: Date.now },
    completed: Date,
    abandoned: Boolean,
    fields: [{
      fieldName: String,
      interacted: Boolean,
      timeSpent: Number, // seconds
      errorCount: Number
    }],
    conversionValue: Number // if applicable
  }],
  
  // Email and notification engagement
  emailEngagement: [{
    emailId: String,
    emailType: { type: String, enum: ['welcome', 'notification', 'newsletter', 'alert'] },
    sent: Date,
    opened: Date,
    clicked: Date,
    unsubscribed: Date,
    bounced: Boolean,
    clickedLinks: [String]
  }],
  
  // Social and sharing behavior
  socialInteractions: [{
    platform: { type: String, enum: ['linkedin', 'twitter', 'facebook', 'email', 'whatsapp'] },
    action: { type: String, enum: ['share', 'like', 'comment', 'follow'] },
    contentId: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Business intelligence data
  businessMetrics: {
    // Lead scoring
    leadScore: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 },
    
    // Company insights
    companySize: String, // 'startup', 'sme', 'enterprise'
    industry: String,
    jobFunction: String,
    decisionMaker: Boolean,
    
    // Intent signals
    intentSignals: [{
      signal: String, // 'high_download_volume', 'frequent_visits', 'premium_content_access'
      strength: { type: Number, min: 1, max: 10 },
      timestamp: { type: Date, default: Date.now }
    }],
    
    // Conversion tracking
    conversions: [{
      type: { type: String, enum: ['registration', 'upgrade', 'subscription', 'contact'] },
      value: Number,
      timestamp: { type: Date, default: Date.now },
      source: String,
      campaign: String
    }]
  },
  
  // Technical performance data
  performanceMetrics: {
    pageLoadTimes: [{
      page: String,
      loadTime: Number, // milliseconds
      timestamp: { type: Date, default: Date.now }
    }],
    errors: [{
      type: String,
      message: String,
      stack: String,
      timestamp: { type: Date, default: Date.now }
    }],
    apiResponseTimes: [{
      endpoint: String,
      responseTime: Number,
      statusCode: Number,
      timestamp: { type: Date, default: Date.now }
    }]
  },
  
  // Privacy and consent tracking
  privacyConsent: {
    cookiesAccepted: { type: Boolean, default: false },
    analyticsConsent: { type: Boolean, default: false },
    marketingConsent: { type: Boolean, default: false },
    dataProcessingConsent: { type: Boolean, default: false },
    consentTimestamp: Date,
    consentVersion: String,
    gdprApplicable: Boolean,
    ccpaApplicable: Boolean
  },
  
  // Attribution and campaign tracking
  attribution: {
    firstTouch: {
      source: String,
      medium: String,
      campaign: String,
      timestamp: Date
    },
    lastTouch: {
      source: String,
      medium: String,
      campaign: String,
      timestamp: Date
    },
    utmParameters: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String
    }
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance and analytics queries
userAnalyticsSchema.index({ userId: 1, createdAt: -1 });
userAnalyticsSchema.index({ sessionId: 1 });
userAnalyticsSchema.index({ 'sessionData.startTime': -1 });
userAnalyticsSchema.index({ 'location.country': 1 });
userAnalyticsSchema.index({ 'businessMetrics.leadScore': -1 });
userAnalyticsSchema.index({ 'contentInteractions.contentType': 1, 'contentInteractions.timestamp': -1 });

// Pre-save middleware to update timestamp
userAnalyticsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Methods for analytics calculations
userAnalyticsSchema.methods.calculateEngagementScore = function() {
  let score = 0;
  
  // Page views (1 point per page, max 50)
  score += Math.min(this.pageViews.length, 50);
  
  // Time on site (1 point per minute, max 100)
  if (this.sessionData.duration) {
    score += Math.min(Math.floor(this.sessionData.duration / 60), 100);
  }
  
  // Downloads (5 points each, max 100)
  score += Math.min(this.downloads.length * 5, 100);
  
  // Content interactions (3 points each, max 150)
  score += Math.min(this.contentInteractions.length * 3, 150);
  
  // Form completions (10 points each, max 100)
  const completedForms = this.formInteractions.filter(f => f.completed).length;
  score += Math.min(completedForms * 10, 100);
  
  this.businessMetrics.engagementScore = score;
  return score;
};

userAnalyticsSchema.methods.calculateLeadScore = function() {
  let score = 0;
  
  // Base engagement score
  score += this.businessMetrics.engagementScore || 0;
  
  // Company email domain (not gmail, yahoo, etc.) +50
  if (this.userId && this.userId.email) {
    const domain = this.userId.email.split('@')[1];
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    if (!personalDomains.includes(domain)) {
      score += 50;
    }
  }
  
  // Job title indicators +30
  if (this.userId && this.userId.profile && this.userId.profile.jobTitle) {
    const title = this.userId.profile.jobTitle.toLowerCase();
    const seniorTitles = ['director', 'manager', 'head', 'chief', 'vp', 'president'];
    if (seniorTitles.some(t => title.includes(t))) {
      score += 30;
    }
  }
  
  // Multiple sessions +20
  // This would need to be calculated across all analytics records for the user
  
  // High-value content downloads +25 each
  const highValueDownloads = this.downloads.filter(d => 
    d.assetType === 'document' || d.fileName.includes('kit')
  ).length;
  score += highValueDownloads * 25;
  
  this.businessMetrics.leadScore = Math.min(score, 1000); // Cap at 1000
  return this.businessMetrics.leadScore;
};

// Static methods for analytics queries
userAnalyticsSchema.statics.getTopContent = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $unwind: '$contentInteractions' },
    { $group: {
      _id: '$contentInteractions.contentId',
      contentType: { $first: '$contentInteractions.contentType' },
      views: { $sum: 1 },
      uniqueUsers: { $addToSet: '$userId' }
    }},
    { $addFields: { uniqueUserCount: { $size: '$uniqueUsers' } } },
    { $sort: { views: -1 } },
    { $limit: 50 }
  ]);
};

userAnalyticsSchema.statics.getUserJourney = function(userId) {
  return this.find({ userId })
    .sort({ 'sessionData.startTime': 1 })
    .select('sessionData pageViews contentInteractions downloads formInteractions');
};

const UserAnalytics = mongoose.model('UserAnalytics', userAnalyticsSchema);

module.exports = UserAnalytics;