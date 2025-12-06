const User = require('../models/User');
const Company = require('../models/Company');
const AuditEvent = require('../models/AuditEvent');

/**
 * 🚨 CRITICAL SECURITY MIDDLEWARE - LEGAL COMPLIANCE
 * 
 * This middleware performs comprehensive security validation to prevent:
 * - Data access by suspended/cancelled companies
 * - Access by deactivated users
 * - Stale token exploitation
 * - Role escalation attacks
 * 
 * LEGAL REQUIREMENT: Ensures absolute data isolation and access control
 */

// ✅ CRITICAL: Validate user and company status on every request
const validateActiveUserAndCompany = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    
    // 1. Re-validate user exists and is active
    const currentUser = await User.findById(userId)
      .populate('clientId', 'status billingStatus canOperate')
      .select('-password');
    
    if (!currentUser) {
      await AuditEvent.logEvent({
        clientId: null,
        userId: userId,
        emailSnapshot: 'deleted_user',
        action: 'security.deleted_user_access_attempt',
        targetType: 'user',
        targetId: userId.toString(),
        metadata: {
          reason: 'user_not_found',
          originalToken: req.headers.authorization?.substring(0, 20) + '...',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).json({
        success: false,
        error: 'User account no longer exists',
        errorCode: 'USER_DELETED',
        action: 'redirect_login'
      });
    }

    // 2. Check if user is still active
    if (!currentUser.isActive) {
      await AuditEvent.logEvent({
        clientId: currentUser.clientId?._id,
        userId: currentUser._id,
        emailSnapshot: currentUser.email,
        action: 'security.deactivated_user_access_attempt',
        targetType: 'user',
        targetId: currentUser._id.toString(),
        metadata: {
          reason: 'user_deactivated',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({
        success: false,
        error: 'User account has been deactivated',
        errorCode: 'USER_DEACTIVATED',
        action: 'redirect_login'
      });
    }

    // 3. Validate role hasn't changed (prevent role escalation)
    if (currentUser.role !== req.user.role) {
      await AuditEvent.logEvent({
        clientId: currentUser.clientId?._id,
        userId: currentUser._id,
        emailSnapshot: currentUser.email,
        action: 'security.role_mismatch_detected',
        targetType: 'user',
        targetId: currentUser._id.toString(),
        metadata: {
          tokenRole: req.user.role,
          currentRole: currentUser.role,
          reason: 'role_changed_after_token_issued',
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({
        success: false,
        error: 'User role has changed. Please log in again.',
        errorCode: 'ROLE_CHANGED',
        action: 'redirect_login'
      });
    }

    // 4. For company users, validate company status
    if (['client_user', 'client_admin'].includes(currentUser.role)) {
      if (!currentUser.clientId) {
        await AuditEvent.logEvent({
          clientId: null,
          userId: currentUser._id,
          emailSnapshot: currentUser.email,
          action: 'security.missing_company_association',
          targetType: 'user',
          targetId: currentUser._id.toString(),
          metadata: {
            role: currentUser.role,
            reason: 'client_user_without_company',
            userAgent: req.headers['user-agent']
          },
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
          success: false,
          error: 'User has no company association',
          errorCode: 'NO_COMPANY_ASSOCIATION'
        });
      }

      // 5. CRITICAL: Validate company can still operate
      if (!currentUser.clientId.canOperate || !currentUser.clientId.canOperate()) {
        await AuditEvent.logEvent({
          clientId: currentUser.clientId._id,
          userId: currentUser._id,
          emailSnapshot: currentUser.email,
          action: 'security.inactive_company_access_attempt',
          targetType: 'company',
          targetId: currentUser.clientId._id.toString(),
          metadata: {
            companyStatus: currentUser.clientId.status,
            billingStatus: currentUser.clientId.billingStatus,
            reason: 'company_cannot_operate',
            userAgent: req.headers['user-agent']
          },
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
          success: false,
          error: `Company is ${currentUser.clientId.status} and cannot access the system`,
          errorCode: 'COMPANY_INACTIVE',
          companyStatus: currentUser.clientId.status,
          billingStatus: currentUser.clientId.billingStatus,
          action: 'contact_admin'
        });
      }

      // 6. Validate clientId matches token (prevent company switching)
      let tokenClientId = req.user.clientId;
      
      // Handle different formats of clientId in token
      if (tokenClientId) {
        if (typeof tokenClientId === 'object' && tokenClientId._id) {
          tokenClientId = tokenClientId._id.toString();
        } else {
          tokenClientId = tokenClientId.toString();
        }
      }
      
      const currentClientId = currentUser.clientId._id.toString();
      
      // Only validate mismatch if token actually contains a clientId
      // If tokenClientId is undefined, it means the token was issued before company assignment
      if (tokenClientId && tokenClientId !== currentClientId) {
        await AuditEvent.logEvent({
          clientId: currentUser.clientId._id,
          userId: currentUser._id,
          emailSnapshot: currentUser.email,
          action: 'security.company_mismatch_detected',
          targetType: 'user',
          targetId: currentUser._id.toString(),
          metadata: {
            tokenClientId,
            currentClientId,
            reason: 'company_changed_after_token_issued',
            userAgent: req.headers['user-agent']
          },
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });

        return res.status(403).json({
          success: false,
          error: 'Company association has changed. Please log in again.',
          errorCode: 'COMPANY_CHANGED',
          action: 'redirect_login'
        });
      }
    }

    // 7. Update req.user with fresh data
    req.user = {
      _id: currentUser._id,
      id: currentUser._id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
      clientId: currentUser.clientId?._id,
      isActive: currentUser.isActive,
      lastLoginAt: currentUser.lastLoginAt
    };

    // 8. Log successful validation (for audit trail)
    await AuditEvent.logEvent({
      clientId: currentUser.clientId?._id,
      userId: currentUser._id,
      emailSnapshot: currentUser.email,
      action: 'security.access_validated',
      targetType: 'user',
      targetId: currentUser._id.toString(),
      metadata: {
        role: currentUser.role,
        endpoint: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent']
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    next();

  } catch (error) {
    console.error('Critical security validation error:', error);
    
    // Log the security error
    try {
      await AuditEvent.logEvent({
        clientId: null,
        userId: req.user?._id || null,
        emailSnapshot: req.user?.email || 'unknown',
        action: 'security.validation_error',
        targetType: 'system',
        targetId: 'security_middleware',
        metadata: {
          error: error.message,
          stack: error.stack?.substring(0, 500),
          endpoint: req.originalUrl,
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (auditError) {
      console.error('Failed to log security validation error:', auditError);
    }

    return res.status(500).json({
      success: false,
      error: 'Security validation failed',
      errorCode: 'SECURITY_VALIDATION_ERROR'
    });
  }
};

// ✅ CRITICAL: Company-specific data isolation middleware
const enforceCompanyDataIsolation = (req, res, next) => {
  const { role, clientId } = req.user;
  
  // Platform admin can access all companies (with explicit filtering)
  if (role === 'platform_admin') {
    // Platform admin must explicitly specify which company data to access
    // This prevents accidental cross-company data leakage
    req.platformAdminAccess = true;
    return next();
  }
  
  // Media users have no company data access
  if (role === 'media_user') {
    return res.status(403).json({
      success: false,
      error: 'Media users cannot access company data',
      errorCode: 'MEDIA_USER_COMPANY_ACCESS_DENIED'
    });
  }
  
  // Client users must have company association
  if (!clientId) {
    return res.status(403).json({
      success: false,
      error: 'No company association found',
      errorCode: 'NO_COMPANY_ASSOCIATION'
    });
  }
  
  // Enforce company scope for all database queries
  req.companyScope = {
    clientId: clientId,
    enforced: true
  };
  
  next();
};

// ✅ CRITICAL: Prevent cross-company parameter injection
const validateCompanyParameters = (req, res, next) => {
  const { role, clientId } = req.user;
  
  // Platform admin can access any company (but must be explicit)
  if (role === 'platform_admin') {
    return next();
  }
  
  // Check URL parameters for company references
  const companyParams = ['companyId', 'clientId', 'company_id', 'client_id'];
  
  for (const param of companyParams) {
    const paramValue = req.params[param] || req.query[param] || req.body[param];
    
    if (paramValue && paramValue.toString() !== clientId.toString()) {
      // Log potential security breach attempt
      AuditEvent.logEvent({
        clientId: clientId,
        userId: req.user._id,
        emailSnapshot: req.user.email,
        action: 'security.cross_company_access_attempt',
        targetType: 'parameter',
        targetId: param,
        metadata: {
          attemptedCompanyId: paramValue,
          userCompanyId: clientId,
          parameter: param,
          endpoint: req.originalUrl,
          userAgent: req.headers['user-agent']
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }).catch(err => console.error('Failed to log security event:', err));

      return res.status(403).json({
        success: false,
        error: 'Access denied: cannot access other company data',
        errorCode: 'CROSS_COMPANY_ACCESS_DENIED',
        attemptedCompany: paramValue,
        userCompany: clientId
      });
    }
  }
  
  next();
};

module.exports = {
  validateActiveUserAndCompany,
  enforceCompanyDataIsolation,
  validateCompanyParameters
};