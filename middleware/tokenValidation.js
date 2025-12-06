const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Invite = require('../models/Invite');
const User = require('../models/User');
const AuditEvent = require('../models/AuditEvent');

// ✅ INVITATION TOKEN VALIDATION MIDDLEWARE

/**
 * Enhanced invitation token validation with security checks
 * Validates invitation tokens with comprehensive security measures
 */
const validateInvitationToken = async (req, res, next) => {
  try {
    const { token } = req.query || req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Invitation token is required',
        errorCode: 'TOKEN_MISSING'
      });
    }

    // Find the invitation by token
    const invite = await Invite.findOne({ token })
      .populate('clientId', 'companyName status canOperate')
      .populate('invitedBy', 'name email role');

    if (!invite) {
      // Log suspicious token access attempt
      await AuditEvent.logEvent({
        clientId: null,
        userId: null,
        emailSnapshot: 'anonymous',
        action: 'security.invalid_token_attempt',
        targetType: 'invite_token',
        targetId: token.substring(0, 8) + '...', // Log partial token for security
        metadata: {
          token: token.substring(0, 8) + '...',
          reason: 'token_not_found',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(404).json({
        success: false,
        error: 'Invalid invitation token',
        errorCode: 'TOKEN_INVALID'
      });
    }

    // Check if invitation has already been redeemed
    if (invite.status === 'accepted' || invite.redeemedAt) {
      await AuditEvent.logEvent({
        clientId: invite.clientId?._id,
        userId: null,
        emailSnapshot: invite.email,
        action: 'security.reused_token_attempt',
        targetType: 'invite_token',
        targetId: invite._id.toString(),
        metadata: {
          email: invite.email,
          originallyRedeemedAt: invite.redeemedAt,
          reason: 'token_already_used',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(400).json({
        success: false,
        error: 'This invitation has already been accepted',
        errorCode: 'TOKEN_ALREADY_USED'
      });
    }

    // Check if invitation has been revoked
    if (invite.status === 'revoked' || invite.revokedAt) {
      await AuditEvent.logEvent({
        clientId: invite.clientId?._id,
        userId: null,
        emailSnapshot: invite.email,
        action: 'security.revoked_token_attempt',
        targetType: 'invite_token',
        targetId: invite._id.toString(),
        metadata: {
          email: invite.email,
          revokedAt: invite.revokedAt,
          reason: 'token_revoked',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(400).json({
        success: false,
        error: 'This invitation has been cancelled',
        errorCode: 'TOKEN_REVOKED'
      });
    }

    // Check if invitation has expired
    if (invite.status === 'expired' || new Date() > invite.expiresAt) {
      // Auto-update status if not already expired
      if (invite.status !== 'expired') {
        invite.status = 'expired';
        await invite.save();
      }

      await AuditEvent.logEvent({
        clientId: invite.clientId?._id,
        userId: null,
        emailSnapshot: invite.email,
        action: 'security.expired_token_attempt',
        targetType: 'invite_token',
        targetId: invite._id.toString(),
        metadata: {
          email: invite.email,
          expiresAt: invite.expiresAt,
          reason: 'token_expired',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(400).json({
        success: false,
        error: 'This invitation has expired',
        errorCode: 'TOKEN_EXPIRED',
        expiresAt: invite.expiresAt
      });
    }

    // Check if company is still active and can operate
    if (!invite.clientId || !invite.clientId.canOperate()) {
      await AuditEvent.logEvent({
        clientId: invite.clientId?._id,
        userId: null,
        emailSnapshot: invite.email,
        action: 'security.inactive_company_token_attempt',
        targetType: 'invite_token',
        targetId: invite._id.toString(),
        metadata: {
          email: invite.email,
          companyStatus: invite.clientId?.status,
          reason: 'company_inactive',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({
        success: false,
        error: 'The company associated with this invitation is no longer active',
        errorCode: 'COMPANY_INACTIVE'
      });
    }

    // Check for email ownership validation (if email provided in request)
    if (req.body.email && req.body.email.toLowerCase() !== invite.email.toLowerCase()) {
      await AuditEvent.logEvent({
        clientId: invite.clientId._id,
        userId: null,
        emailSnapshot: req.body.email,
        action: 'security.email_mismatch_attempt',
        targetType: 'invite_token',
        targetId: invite._id.toString(),
        metadata: {
          inviteEmail: invite.email,
          providedEmail: req.body.email,
          reason: 'email_mismatch',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(400).json({
        success: false,
        error: 'Email address does not match the invitation',
        errorCode: 'EMAIL_MISMATCH'
      });
    }

    // Check if user already exists with this email in the company
    const existingUser = await User.findOne({
      email: invite.email.toLowerCase(),
      clientId: invite.clientId._id,
      isActive: true
    });

    if (existingUser) {
      await AuditEvent.logEvent({
        clientId: invite.clientId._id,
        userId: existingUser._id,
        emailSnapshot: invite.email,
        action: 'security.duplicate_user_attempt',
        targetType: 'invite_token',
        targetId: invite._id.toString(),
        metadata: {
          email: invite.email,
          existingUserId: existingUser._id,
          reason: 'user_already_exists',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists in the company',
        errorCode: 'USER_ALREADY_EXISTS'
      });
    }

    // All validations passed - attach invitation to request
    req.invitation = invite;
    req.invitationCompany = invite.clientId;

    // Log successful token validation
    await AuditEvent.logEvent({
      clientId: invite.clientId._id,
      userId: null,
      emailSnapshot: invite.email,
      action: 'security.token_validated',
      targetType: 'invite_token',
      targetId: invite._id.toString(),
      metadata: {
        email: invite.email,
        role: invite.role,
        companyName: invite.clientId.companyName,
        userAgent: req.headers['user-agent']
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    next();

  } catch (error) {
    console.error('Error validating invitation token:', error);

    // Log validation error
    try {
      await AuditEvent.logEvent({
        clientId: null,
        userId: null,
        emailSnapshot: 'system',
        action: 'security.token_validation_error',
        targetType: 'invite_token',
        targetId: 'unknown',
        metadata: {
          error: error.message,
          stack: error.stack?.substring(0, 500),
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (auditError) {
      console.error('Failed to log token validation error:', auditError);
    }

    res.status(500).json({
      success: false,
      error: 'Server error during token validation',
      errorCode: 'VALIDATION_ERROR'
    });
  }
};

// ✅ JWT TOKEN VALIDATION MIDDLEWARE

/**
 * Enhanced JWT token validation with security checks
 */
const validateJWTToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        errorCode: 'JWT_MISSING'
      });
    }

    // Verify JWT token
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        // Log suspicious JWT access attempt
        try {
          await AuditEvent.logEvent({
            clientId: null,
            userId: null,
            emailSnapshot: 'anonymous',
            action: 'security.invalid_jwt_attempt',
            targetType: 'jwt_token',
            targetId: token.substring(0, 20) + '...',
            metadata: {
              error: err.name,
              message: err.message,
              userAgent: req.headers['user-agent']
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });
        } catch (auditError) {
          console.error('Failed to log JWT validation error:', auditError);
        }

        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Access token has expired',
            errorCode: 'JWT_EXPIRED'
          });
        }

        return res.status(403).json({
          success: false,
          error: 'Invalid access token',
          errorCode: 'JWT_INVALID'
        });
      }

      // Token is valid - attach user info to request
      req.user = decoded;
      next();
    });

  } catch (error) {
    console.error('Error validating JWT token:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during token validation',
      errorCode: 'JWT_VALIDATION_ERROR'
    });
  }
};

// ✅ SUSPICIOUS ACTIVITY DETECTION

/**
 * Middleware to detect and flag suspicious activity patterns
 */
const detectSuspiciousActivity = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const clientId = req.user?.clientId || req.user?.companyId;
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];

    // Check for rapid successive requests (potential bot activity)
    const recentRequests = await AuditEvent.countDocuments({
      ip,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) } // Last minute
    });

    if (recentRequests > 30) { // More than 30 requests per minute
      await AuditEvent.logEvent({
        clientId,
        userId,
        emailSnapshot: req.user?.email || 'anonymous',
        action: 'security.suspicious_activity_detected',
        targetType: 'rate_pattern',
        targetId: ip,
        metadata: {
          pattern: 'rapid_requests',
          requestCount: recentRequests,
          timeWindow: '1_minute',
          userAgent
        },
        ip,
        userAgent
      });

      return res.status(429).json({
        success: false,
        error: 'Suspicious activity detected. Please slow down your requests.',
        errorCode: 'SUSPICIOUS_ACTIVITY'
      });
    }

    // Check for multiple failed attempts from same IP
    const recentFailures = await AuditEvent.countDocuments({
      ip,
      action: { $regex: /^security\.(invalid_|expired_|revoked_)/ },
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Last 15 minutes
    });

    if (recentFailures > 5) { // More than 5 security failures in 15 minutes
      await AuditEvent.logEvent({
        clientId,
        userId,
        emailSnapshot: req.user?.email || 'anonymous',
        action: 'security.suspicious_activity_detected',
        targetType: 'failure_pattern',
        targetId: ip,
        metadata: {
          pattern: 'multiple_failures',
          failureCount: recentFailures,
          timeWindow: '15_minutes',
          userAgent
        },
        ip,
        userAgent
      });

      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please try again later.',
        errorCode: 'TOO_MANY_FAILURES'
      });
    }

    next();

  } catch (error) {
    console.error('Error detecting suspicious activity:', error);
    // Don't block the request on detection errors, just log and continue
    next();
  }
};

// ✅ SECURITY HEADERS MIDDLEWARE

/**
 * Add security headers to responses
 */
const addSecurityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
  
  next();
};

module.exports = {
  validateInvitationToken,
  validateJWTToken,
  detectSuspiciousActivity,
  addSecurityHeaders
};