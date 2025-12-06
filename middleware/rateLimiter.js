const rateLimit = require('express-rate-limit');
const MongoStore = require('rate-limit-mongo');
const AuditEvent = require('../models/AuditEvent');

// MongoDB connection for rate limiting store
const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017/amc';

// Create rate limiting store
const createStore = () => {
  try {
    return new MongoStore({
      uri: mongoUrl,
      collectionName: 'rateLimitStore',
      expireTimeMs: 24 * 60 * 60 * 1000, // 24 hours
    });
  } catch (error) {
    console.warn('Failed to create MongoDB rate limit store, falling back to memory store:', error.message);
    return undefined; // Falls back to memory store
  }
};

// Enhanced rate limiter with audit logging
const createRateLimiter = (options) => {
  const limiter = rateLimit({
    store: createStore(),
    windowMs: options.windowMs || 24 * 60 * 60 * 1000, // 24 hours default
    max: options.max || 100,
    message: {
      success: false,
      error: options.message || 'Too many requests, please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000 / 60) // minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => {
      // Default: rate limit by user + IP for authenticated requests
      if (req.user) {
        return `${req.user._id}_${req.ip}`;
      }
      return req.ip;
    }),
    skip: (req) => {
      // Skip rate limiting for platform admins in development
      if (process.env.NODE_ENV === 'development' && req.user?.role === 'platform_admin') {
        return true;
      }
      return false;
    },
    handler: async (req, res, next, options) => {
      // Log rate limit violations for security monitoring
      try {
        const clientId = req.user?.clientId || req.user?.companyId;
        await AuditEvent.logEvent({
          clientId: clientId || null,
          userId: req.user?._id || null,
          emailSnapshot: req.user?.email || 'anonymous',
          action: 'security.rate_limit_exceeded',
          targetType: 'rate_limit',
          targetId: req.route?.path || req.path,
          metadata: {
            endpoint: `${req.method} ${req.route?.path || req.path}`,
            limit: options.max,
            windowMs: options.windowMs,
            userAgent: req.headers['user-agent'],
            rateLimitType: options.rateLimitType || 'general'
          },
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (error) {
        console.error('Failed to log rate limit violation:', error);
      }
      
      // Send the rate limit response
      res.status(options.statusCode).json(options.message);
    }
  });

  return limiter;
};

// ✅ INVITATION RATE LIMITERS

// Rate limiter for invitation creation (20 invites per day per company)
const inviteCreationLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // 20 invites per day per company
  message: 'Too many invitations sent today. Maximum 20 invitations per day allowed.',
  rateLimitType: 'invite_creation',
  keyGenerator: (req) => {
    const companyId = req.user?.clientId || req.user?.companyId;
    return `invite_create_${companyId}_${req.ip}`;
  }
});

// Rate limiter for invitation resends (3 resends per invitation per day)
const inviteResendLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 resends per invitation per day
  message: 'Too many resend attempts for this invitation. Maximum 3 resends per day allowed.',
  rateLimitType: 'invite_resend',
  keyGenerator: (req) => {
    const inviteId = req.params.inviteId;
    const companyId = req.user?.clientId || req.user?.companyId;
    return `invite_resend_${companyId}_${inviteId}`;
  }
});

// Rate limiter for invitation acceptance attempts (10 attempts per hour per IP)
const inviteAcceptanceLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: 'Too many invitation acceptance attempts. Please try again later.',
  rateLimitType: 'invite_acceptance',
  keyGenerator: (req) => {
    return `invite_accept_${req.ip}`;
  }
});

// ✅ USER MANAGEMENT RATE LIMITERS

// Rate limiter for user role changes (10 changes per hour per company)
const userRoleChangeLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 role changes per hour
  message: 'Too many user role changes. Please try again later.',
  rateLimitType: 'user_role_change',
  keyGenerator: (req) => {
    const companyId = req.user?.clientId || req.user?.companyId;
    return `role_change_${companyId}`;
  }
});

// Rate limiter for user deletion (5 deletions per hour per company)
const userDeletionLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 deletions per hour
  message: 'Too many user deletions. Please try again later.',
  rateLimitType: 'user_deletion',
  keyGenerator: (req) => {
    const companyId = req.user?.clientId || req.user?.companyId;
    return `user_delete_${companyId}`;
  }
});

// ✅ AUTHENTICATION RATE LIMITERS

// Rate limiter for login attempts - Enterprise-friendly approach
// Higher IP-based limit for corporate networks + email-specific limits for security
const loginAttemptLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 attempts per 15 minutes per IP (supports large corporate networks)
  message: 'Too many login attempts from this network. Please try again in 15 minutes.',
  rateLimitType: 'login_attempt_ip',
  keyGenerator: (req) => {
    return `login_ip_${req.ip}`;
  }
});

// Email-specific rate limiter for targeted brute force protection
const loginEmailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per email per 15 minutes
  message: 'Too many login attempts for this email. Please try again in 15 minutes.',
  rateLimitType: 'login_attempt_email',
  keyGenerator: (req) => {
    const email = req.body?.email || req.body?.username || 'unknown';
    return `login_email_${email.toLowerCase()}`;
  }
});

// Rate limiter for password reset requests (TEMPORARILY INCREASED FOR TESTING)
const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // TEMPORARILY INCREASED: 20 requests per hour for testing
  message: 'Too many password reset requests. Please try again later.',
  rateLimitType: 'password_reset',
  keyGenerator: (req) => {
    return `pwd_reset_${req.ip}`;
  }
});

// ✅ GENERAL API RATE LIMITERS

// General API rate limiter (1000 requests per hour per user)
const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  message: 'Too many API requests. Please try again later.',
  rateLimitType: 'general_api',
  keyGenerator: (req) => {
    if (req.user) {
      return `api_${req.user._id}`;
    }
    return `api_${req.ip}`;
  }
});

// Strict rate limiter for sensitive operations (10 requests per hour)
const strictApiLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour
  message: 'Too many sensitive operations. Please try again later.',
  rateLimitType: 'strict_api',
  keyGenerator: (req) => {
    const companyId = req.user?.clientId || req.user?.companyId;
    return `strict_${companyId}_${req.user?._id}`;
  }
});

// ✅ COMPANY-SPECIFIC RATE LIMITERS

// Rate limiter for company settings changes (5 changes per hour)
const companySettingsLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 changes per hour
  message: 'Too many company settings changes. Please try again later.',
  rateLimitType: 'company_settings',
  keyGenerator: (req) => {
    const companyId = req.user?.clientId || req.user?.companyId;
    return `company_settings_${companyId}`;
  }
});

// ✅ UTILITY FUNCTIONS

// Function to check if user has exceeded rate limits recently
const checkRecentViolations = async (userId, clientId) => {
  try {
    const recentViolations = await AuditEvent.countDocuments({
      userId,
      clientId,
      action: 'security.rate_limit_exceeded',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    return {
      hasViolations: recentViolations > 0,
      violationCount: recentViolations,
      isHighRisk: recentViolations >= 5 // 5+ violations in 24 hours = high risk
    };
  } catch (error) {
    console.error('Error checking rate limit violations:', error);
    return { hasViolations: false, violationCount: 0, isHighRisk: false };
  }
};

// Function to temporarily ban high-risk users
const createTemporaryBan = (duration = 60 * 60 * 1000) => { // 1 hour default
  return createRateLimiter({
    windowMs: duration,
    max: 0, // No requests allowed
    message: 'Account temporarily suspended due to suspicious activity. Please contact support.',
    rateLimitType: 'temporary_ban'
  });
};

module.exports = {
  // Invitation rate limiters
  inviteCreationLimiter,
  inviteResendLimiter,
  inviteAcceptanceLimiter,
  
  // User management rate limiters
  userRoleChangeLimiter,
  userDeletionLimiter,
  
  // Authentication rate limiters
  loginAttemptLimiter,
  loginEmailLimiter,
  passwordResetLimiter,
  
  // General API rate limiters
  generalApiLimiter,
  strictApiLimiter,
  
  // Company-specific rate limiters
  companySettingsLimiter,
  
  // Utility functions
  checkRecentViolations,
  createTemporaryBan,
  createRateLimiter
};