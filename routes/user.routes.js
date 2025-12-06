const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const EnhancedUser = require('../models/EnhancedUser');
const UserAnalytics = require('../models/UserAnalytics');
const enhancedAuthMiddleware = require('../middleware/enhancedAuthMiddleware');
const analyticsMiddleware = require('../middleware/analyticsMiddleware');
const router = express.Router();

// Apply analytics tracking to all routes
router.use(analyticsMiddleware.initializeSession);
router.use(analyticsMiddleware.trackPageView);

// Public user registration (creates Level 1 users by default) with comprehensive data collection
router.post('/register', 
  analyticsMiddleware.trackFormInteraction('registration'),
  async (req, res) => {
    try {
      const { 
        email, 
        password, 
        firstName, 
        lastName, 
        company, 
        jobTitle, 
        phone,
        // Additional data collection fields
        industry,
        companySize,
        jobFunction,
        interests,
        marketingConsent,
        analyticsConsent,
        referralSource,
        campaignSource
      } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Check if user already exists
      const existingUser = await EnhancedUser.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Determine initial user level based on email domain and company info
      let initialLevel = 1;
      let initialRole = 'media_user';
      
      // Business email detection for potential Level 2 users
      const emailDomain = email.split('@')[1];
      const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
      const isBusinessEmail = !personalDomains.includes(emailDomain.toLowerCase());
      
      // Auto-upgrade to Level 2 for business emails with company info
      if (isBusinessEmail && company && jobTitle) {
        initialLevel = 2;
        initialRole = 'client_user';
      }

      // Create new user with comprehensive data collection
      const user = new EnhancedUser({
        email: email.toLowerCase(),
        password: password,
        role: initialRole,
        level: initialLevel,
        status: 'active',
        emailVerified: false, // Will implement email verification later
        profile: {
          firstName: firstName || '',
          lastName: lastName || '',
          company: company || '',
          jobTitle: jobTitle || '',
          phone: phone || ''
        },
        
        // Business intelligence data collection
        businessMetrics: {
          companySize: companySize || 'unknown',
          industry: industry || 'unknown',
          jobFunction: jobFunction || 'unknown',
          decisionMaker: this.isDecisionMaker(jobTitle),
          leadScore: 0,
          engagementScore: 0
        },
        
        // Interests and preferences
        interests: interests ? interests.map(i => ({ category: i, keywords: [] })) : [],
        
        // Consent tracking
        privacyConsent: {
          cookiesAccepted: true, // Assumed if registering
          analyticsConsent: analyticsConsent !== false,
          marketingConsent: marketingConsent === true,
          dataProcessingConsent: true, // Required for registration
          consentTimestamp: new Date(),
          consentVersion: '1.0',
          gdprApplicable: this.isGDPRApplicable(req),
          ccpaApplicable: this.isCCPAApplicable(req)
        },
        
        // Attribution tracking
        attribution: {
          firstTouch: {
            source: referralSource || req.headers.referer || 'direct',
            medium: campaignSource || 'organic',
            campaign: req.query.utm_campaign || 'registration',
            timestamp: new Date()
          },
          utmParameters: {
            source: req.query.utm_source || null,
            medium: req.query.utm_medium || null,
            campaign: req.query.utm_campaign || null,
            term: req.query.utm_term || null,
            content: req.query.utm_content || null
          }
        }
      });

      await user.save();

      // Create initial analytics record
      const analytics = new UserAnalytics({
        userId: user._id,
        sessionId: req.analyticsSession?.sessionId || analyticsMiddleware.generateSessionId(),
        sessionData: req.analyticsSession || {},
        location: req.analyticsSession?.location || {},
        businessMetrics: {
          leadScore: user.businessMetrics.leadScore,
          engagementScore: 0,
          companySize: companySize,
          industry: industry,
          jobFunction: jobFunction,
          decisionMaker: this.isDecisionMaker(jobTitle),
          conversions: [{
            type: 'registration',
            value: initialLevel === 2 ? 100 : 50, // Higher value for business users
            timestamp: new Date(),
            source: referralSource || 'direct',
            campaign: req.query.utm_campaign || 'organic'
          }]
        },
        privacyConsent: user.privacyConsent,
        attribution: user.attribution
      });

      await analytics.save();

      // Generate JWT token
      const payload = {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          level: user.level
        }
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

      // Log successful registration for business intelligence
      console.log('NEW USER REGISTRATION:', {
        userId: user._id,
        email: user.email,
        level: user.level,
        company: company,
        industry: industry,
        source: referralSource,
        businessEmail: isBusinessEmail,
        timestamp: new Date()
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          level: user.level,
          permissions: user.permissions,
          profile: user.profile,
          businessMetrics: user.businessMetrics
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during registration'
      });
    }
  }
);

// Enhanced login with comprehensive tracking
router.post('/login', 
  analyticsMiddleware.trackFormInteraction('login'),
  async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await EnhancedUser.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Log failed login attempt for security
        console.log('FAILED LOGIN ATTEMPT:', {
          email: email,
          ip: analyticsMiddleware.getClientIP(req),
          userAgent: req.headers['user-agent'],
          timestamp: new Date()
        });
        
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        // Log failed login attempt
        console.log('FAILED LOGIN ATTEMPT:', {
          userId: user._id,
          email: email,
          ip: analyticsMiddleware.getClientIP(req),
          userAgent: req.headers['user-agent'],
          timestamp: new Date()
        });
        
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check account status
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          error: `Account is ${user.status}. Please contact support.`
        });
      }

      // Update user login tracking
      user.lastLogin = new Date();
      user.loginCount += 1;
      await user.save();

      // Create/update analytics session
      let analytics = await UserAnalytics.findOne({
        userId: user._id,
        sessionId: req.analyticsSession?.sessionId
      });

      if (!analytics) {
        analytics = new UserAnalytics({
          userId: user._id,
          sessionId: req.analyticsSession?.sessionId || analyticsMiddleware.generateSessionId(),
          sessionData: req.analyticsSession || {},
          location: req.analyticsSession?.location || {}
        });
      }

      // Track login event
      analytics.formInteractions.push({
        formType: 'login',
        started: new Date(),
        completed: new Date(),
        abandoned: false,
        conversionValue: user.level * 25 // Value based on user level
      });

      await analytics.save();

      // Generate JWT token
      const tokenExpiry = rememberMe ? '30d' : '7d';
      const payload = {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          level: user.level
        }
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenExpiry });

      // Log successful login for business intelligence
      console.log('SUCCESSFUL LOGIN:', {
        userId: user._id,
        email: user.email,
        level: user.level,
        loginCount: user.loginCount,
        ip: analyticsMiddleware.getClientIP(req),
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          level: user.level,
          permissions: user.permissions,
          profile: user.profile,
          followedCompanies: user.followedCompanies,
          notificationPreferences: user.notificationPreferences,
          businessMetrics: user.businessMetrics
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during login'
      });
    }
  }
);

// Get user profile with analytics
router.get('/profile', enhancedAuthMiddleware.validateToken, async (req, res) => {
  try {
    const user = await EnhancedUser.findById(req.user._id).select('-password');
    
    // Get user analytics summary
    const analyticsData = await UserAnalytics.aggregate([
      { $match: { userId: req.user._id } },
      { $group: {
        _id: '$userId',
        totalSessions: { $sum: 1 },
        totalPageViews: { $sum: { $size: '$pageViews' } },
        totalDownloads: { $sum: { $size: '$downloads' } },
        avgEngagementScore: { $avg: '$businessMetrics.engagementScore' },
        lastActivity: { $max: '$updatedAt' }
      }}
    ]);

    res.json({
      success: true,
      user: user,
      analytics: analyticsData[0] || {
        totalSessions: 0,
        totalPageViews: 0,
        totalDownloads: 0,
        avgEngagementScore: 0,
        lastActivity: null
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Update user profile with tracking
router.put('/profile', enhancedAuthMiddleware.validateToken, async (req, res) => {
  try {
    const { firstName, lastName, company, jobTitle, phone, industry, companySize } = req.body;
    
    const user = await EnhancedUser.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Track what fields were updated for analytics
    const updatedFields = [];
    
    // Update profile fields
    if (firstName !== undefined && firstName !== user.profile.firstName) {
      user.profile.firstName = firstName;
      updatedFields.push('firstName');
    }
    if (lastName !== undefined && lastName !== user.profile.lastName) {
      user.profile.lastName = lastName;
      updatedFields.push('lastName');
    }
    if (company !== undefined && company !== user.profile.company) {
      user.profile.company = company;
      updatedFields.push('company');
    }
    if (jobTitle !== undefined && jobTitle !== user.profile.jobTitle) {
      user.profile.jobTitle = jobTitle;
      updatedFields.push('jobTitle');
    }
    if (phone !== undefined && phone !== user.profile.phone) {
      user.profile.phone = phone;
      updatedFields.push('phone');
    }

    // Update business metrics
    if (industry !== undefined && industry !== user.businessMetrics.industry) {
      user.businessMetrics.industry = industry;
      updatedFields.push('industry');
    }
    if (companySize !== undefined && companySize !== user.businessMetrics.companySize) {
      user.businessMetrics.companySize = companySize;
      updatedFields.push('companySize');
    }

    // Recalculate decision maker status
    user.businessMetrics.decisionMaker = this.isDecisionMaker(user.profile.jobTitle);

    await user.save();

    // Track profile update in analytics
    if (updatedFields.length > 0) {
      await UserAnalytics.updateOne(
        { userId: user._id, sessionId: req.analyticsSession?.sessionId },
        {
          $push: {
            formInteractions: {
              formType: 'profile_update',
              started: new Date(),
              completed: new Date(),
              abandoned: false,
              fields: updatedFields.map(field => ({
                fieldName: field,
                interacted: true
              }))
            }
          }
        },
        { upsert: true }
      );

      // Log profile update for business intelligence
      console.log('PROFILE UPDATE:', {
        userId: user._id,
        updatedFields: updatedFields,
        company: user.profile.company,
        industry: user.businessMetrics.industry,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        level: user.level,
        permissions: user.permissions,
        profile: user.profile,
        businessMetrics: user.businessMetrics
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Track user activity endpoint (for frontend analytics)
router.post('/track-activity', enhancedAuthMiddleware.validateToken, async (req, res) => {
  try {
    const { 
      eventType, 
      eventData, 
      pageUrl, 
      timeOnPage, 
      scrollDepth,
      clickData,
      searchQuery,
      contentId 
    } = req.body;

    const analytics = await UserAnalytics.findOneAndUpdate(
      { userId: req.user._id, sessionId: req.analyticsSession?.sessionId },
      {
        $push: {
          pageViews: {
            page: pageUrl,
            url: pageUrl,
            timestamp: new Date(),
            timeOnPage: timeOnPage,
            scrollDepth: scrollDepth,
            interactions: clickData ? [clickData] : []
          }
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, new: true }
    );

    // Calculate and update engagement score
    analytics.calculateEngagementScore();
    await analytics.save();

    res.json({
      success: true,
      message: 'Activity tracked successfully'
    });

  } catch (error) {
    console.error('Activity tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Helper methods
function isDecisionMaker(jobTitle) {
  if (!jobTitle) return false;
  const title = jobTitle.toLowerCase();
  const decisionMakerTitles = [
    'director', 'manager', 'head', 'chief', 'ceo', 'cto', 'cmo', 'vp', 'president',
    'owner', 'founder', 'partner', 'lead', 'senior', 'principal'
  ];
  return decisionMakerTitles.some(t => title.includes(t));
}

function isGDPRApplicable(req) {
  // Simple IP-based detection - would need proper geolocation service
  const ip = analyticsMiddleware.getClientIP(req);
  // For now, assume GDPR applies to all EU traffic
  return true; // Conservative approach
}

function isCCPAApplicable(req) {
  // Simple detection for California users
  const ip = analyticsMiddleware.getClientIP(req);
  // Would need proper geolocation to detect California
  return false; // For now
}

// Admin routes with comprehensive user management and analytics

// Get all users with analytics data (Admin only)
router.get('/admin/users', 
  enhancedAuthMiddleware.validateToken, 
  enhancedAuthMiddleware.requireLevel(3), 
  async (req, res) => {
    try {
      const { page = 1, limit = 20, role, level, status, sortBy = 'createdAt' } = req.query;
      
      // Build filter
      const filter = {};
      if (role) filter.role = role;
      if (level) filter.level = parseInt(level);
      if (status) filter.status = status;

      // Get users with analytics data
      const users = await EnhancedUser.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'useranalytics',
            localField: '_id',
            foreignField: 'userId',
            as: 'analytics'
          }
        },
        {
          $addFields: {
            totalSessions: { $size: '$analytics' },
            totalPageViews: {
              $sum: {
                $map: {
                  input: '$analytics',
                  as: 'session',
                  in: { $size: '$$session.pageViews' }
                }
              }
            },
            totalDownloads: {
              $sum: {
                $map: {
                  input: '$analytics',
                  as: 'session',
                  in: { $size: '$$session.downloads' }
                }
              }
            },
            avgEngagementScore: { $avg: '$analytics.businessMetrics.engagementScore' },
            lastActivity: { $max: '$analytics.updatedAt' }
          }
        },
        { $project: { password: 0, analytics: 0 } },
        { $sort: { [sortBy]: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
      ]);

      const total = await EnhancedUser.countDocuments(filter);

      res.json({
        success: true,
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }
);

// Get user analytics dashboard (Admin only)
router.get('/admin/analytics/dashboard', 
  enhancedAuthMiddleware.validateToken, 
  enhancedAuthMiddleware.requireLevel(3), 
  async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      // Get comprehensive analytics
      const analytics = await UserAnalytics.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalUsers: { $addToSet: '$userId' },
            totalSessions: { $sum: 1 },
            totalPageViews: { $sum: { $size: '$pageViews' } },
            totalDownloads: { $sum: { $size: '$downloads' } },
            avgEngagementScore: { $avg: '$businessMetrics.engagementScore' },
            topCountries: { $push: '$location.country' },
            topIndustries: { $push: '$businessMetrics.industry' }
          }
        },
        {
          $addFields: {
            uniqueUsers: { $size: '$totalUsers' }
          }
        }
      ]);

      // Get top content
      const topContent = await UserAnalytics.getTopContent(parseInt(days));

      // Get user growth over time
      const userGrowth = await EnhancedUser.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 },
            level1: { $sum: { $cond: [{ $eq: ['$level', 1] }, 1, 0] } },
            level2: { $sum: { $cond: [{ $eq: ['$level', 2] }, 1, 0] } },
            level3: { $sum: { $cond: [{ $eq: ['$level', 3] }, 1, 0] } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      res.json({
        success: true,
        analytics: analytics[0] || {},
        topContent,
        userGrowth
      });

    } catch (error) {
      console.error('Analytics dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  }
);

// Export user data (GDPR compliance)
router.get('/export-data', enhancedAuthMiddleware.validateToken, async (req, res) => {
  try {
    const user = await EnhancedUser.findById(req.user._id).select('-password');
    const analytics = await UserAnalytics.find({ userId: req.user._id });

    const exportData = {
      user: user,
      analytics: analytics,
      exportDate: new Date(),
      dataRetentionPolicy: 'Data is retained for business purposes as outlined in our Privacy Policy'
    };

    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;