const Company = require('../models/Company');
const User = require('../models/User');
const AuditEvent = require('../models/AuditEvent');

// ✅ MULTI-ADMIN REPLACEMENT LOGIC

/**
 * Middleware to ensure companies always have at least one active admin
 * Prevents orphaned companies and provides emergency admin assignment
 */
const ensureCompanyHasAdmin = async (req, res, next) => {
  try {
    const companyId = req.user?.clientId || req.user?.companyId || req.params.companyId;
    
    if (!companyId) {
      return next(); // Skip if no company context
    }

    // Check current admin count for the company
    const activeAdminCount = await User.countDocuments({
      clientId: companyId,
      role: 'client_admin',
      isActive: true
    });

    // If this is a user deletion/role change that would remove the last admin
    if (req.method === 'DELETE' || (req.method === 'PATCH' && req.body.role && req.body.role !== 'client_admin')) {
      const targetUserId = req.params.userId;
      const targetUser = await User.findById(targetUserId);
      
      if (targetUser && targetUser.role === 'client_admin' && activeAdminCount <= 1) {
        // This would remove the last admin - check for replacement options
        const potentialAdmins = await User.find({
          clientId: companyId,
          role: 'client_user',
          isActive: true
        }).limit(5);

        if (potentialAdmins.length === 0) {
          // No users to promote - flag company as orphaned
          await flagOrphanedCompany(companyId, 'last_admin_removal_attempt', req.user._id);
          
          return res.status(400).json({
            success: false,
            error: 'Cannot remove the last admin. No other users available to promote. Please contact platform support.',
            errorCode: 'LAST_ADMIN_REMOVAL',
            supportAction: 'CONTACT_PLATFORM_ADMIN'
          });
        }

        // Suggest auto-promotion of most senior user
        const seniorUser = potentialAdmins.sort((a, b) => a.createdAt - b.createdAt)[0];
        
        return res.status(400).json({
          success: false,
          error: 'Cannot remove the last admin. Please promote another user to admin first.',
          errorCode: 'LAST_ADMIN_REMOVAL',
          suggestedReplacement: {
            userId: seniorUser._id,
            email: seniorUser.email,
            name: seniorUser.name,
            joinedAt: seniorUser.createdAt
          }
        });
      }
    }

    // Check for orphaned companies (no active admins)
    if (activeAdminCount === 0) {
      await handleOrphanedCompany(companyId, req.user?._id);
    }

    next();

  } catch (error) {
    console.error('Error in ensureCompanyHasAdmin middleware:', error);
    next(); // Don't block the request on middleware errors
  }
};

/**
 * Auto-promote the most senior user to admin when company becomes orphaned
 */
const handleOrphanedCompany = async (companyId, triggeredByUserId = null) => {
  try {
    const company = await Company.findById(companyId);
    if (!company) return;

    // Find potential admin candidates (active client_users)
    const candidates = await User.find({
      clientId: companyId,
      role: 'client_user',
      isActive: true
    }).sort({ createdAt: 1 }); // Oldest first

    if (candidates.length > 0) {
      // Auto-promote the most senior user
      const newAdmin = candidates[0];
      await User.findByIdAndUpdate(newAdmin._id, { role: 'client_admin' });

      // Log the auto-promotion
      await AuditEvent.logEvent({
        clientId: companyId,
        userId: null, // System action
        emailSnapshot: 'system',
        action: 'company.auto_admin_promotion',
        targetType: 'user',
        targetId: newAdmin._id.toString(),
        metadata: {
          companyName: company.companyName,
          promotedUser: {
            email: newAdmin.email,
            name: newAdmin.name,
            joinedAt: newAdmin.createdAt
          },
          reason: 'orphaned_company_recovery',
          triggeredBy: triggeredByUserId,
          candidateCount: candidates.length
        },
        ip: '127.0.0.1',
        userAgent: 'system'
      });

      console.log(`Auto-promoted user ${newAdmin.email} to admin for orphaned company ${company.companyName}`);
      
      // TODO: Send email notification to new admin
      // await sendAdminPromotionEmail(newAdmin.email, company.companyName);
      
    } else {
      // No users to promote - flag as truly orphaned
      await flagOrphanedCompany(companyId, 'no_users_available', triggeredByUserId);
    }

  } catch (error) {
    console.error('Error handling orphaned company:', error);
  }
};

/**
 * Flag a company as orphaned and require platform admin intervention
 */
const flagOrphanedCompany = async (companyId, reason, triggeredByUserId = null) => {
  try {
    const company = await Company.findById(companyId);
    if (!company) return;

    // Update company status to indicate it needs attention
    await Company.findByIdAndUpdate(companyId, {
      status: 'suspended',
      'metadata.orphanedAt': new Date(),
      'metadata.orphanedReason': reason,
      'metadata.requiresPlatformIntervention': true
    });

    // Log the orphaned company event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: triggeredByUserId,
      emailSnapshot: 'system',
      action: 'company.flagged_orphaned',
      targetType: 'company',
      targetId: companyId.toString(),
      metadata: {
        companyName: company.companyName,
        reason,
        triggeredBy: triggeredByUserId,
        requiresIntervention: true,
        suspendedAt: new Date()
      },
      ip: '127.0.0.1',
      userAgent: 'system'
    });

    console.log(`Company ${company.companyName} flagged as orphaned - reason: ${reason}`);
    
    // TODO: Send alert to platform admins
    // await sendOrphanedCompanyAlert(company, reason);

  } catch (error) {
    console.error('Error flagging orphaned company:', error);
  }
};

// ✅ PLATFORM ADMIN EMERGENCY ACCESS

/**
 * Middleware to provide platform admins emergency access to orphaned companies
 */
const allowPlatformAdminEmergencyAccess = async (req, res, next) => {
  try {
    // Only apply to platform admins
    if (req.user?.role !== 'platform_admin') {
      return next();
    }

    const companyId = req.params.companyId;
    if (!companyId) {
      return next();
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return next();
    }

    // Check if company is orphaned and needs intervention
    if (company.metadata?.requiresPlatformIntervention) {
      // Log platform admin emergency access
      await AuditEvent.logEvent({
        clientId: companyId,
        userId: req.user._id,
        emailSnapshot: req.user.email,
        action: 'security.platform_admin_emergency_access',
        targetType: 'company',
        targetId: companyId.toString(),
        metadata: {
          companyName: company.companyName,
          orphanedAt: company.metadata.orphanedAt,
          orphanedReason: company.metadata.orphanedReason,
          adminEmail: req.user.email,
          accessReason: 'emergency_intervention'
        },
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Add emergency access flag to request
      req.emergencyAccess = true;
    }

    next();

  } catch (error) {
    console.error('Error in platform admin emergency access middleware:', error);
    next();
  }
};

// ✅ COMPANY HEALTH MONITORING

/**
 * Periodic health check for all companies
 * Detects and resolves orphaned companies automatically
 */
const performCompanyHealthCheck = async () => {
  try {
    console.log('Starting company health check...');

    // Find all active companies
    const companies = await Company.find({ 
      status: { $in: ['active', 'pending'] }
    });

    let orphanedCount = 0;
    let recoveredCount = 0;

    for (const company of companies) {
      // Check admin count for each company
      const adminCount = await User.countDocuments({
        clientId: company._id,
        role: 'client_admin',
        isActive: true
      });

      if (adminCount === 0) {
        orphanedCount++;
        console.log(`Found orphaned company: ${company.companyName}`);
        
        // Attempt to recover by promoting a user
        await handleOrphanedCompany(company._id);
        
        // Check if recovery was successful
        const newAdminCount = await User.countDocuments({
          clientId: company._id,
          role: 'client_admin',
          isActive: true
        });

        if (newAdminCount > 0) {
          recoveredCount++;
        }
      }
    }

    console.log(`Company health check completed: ${orphanedCount} orphaned companies found, ${recoveredCount} recovered`);

    // Log health check results
    await AuditEvent.logEvent({
      clientId: null,
      userId: null,
      emailSnapshot: 'system',
      action: 'system.company_health_check',
      targetType: 'system',
      targetId: 'health_check',
      metadata: {
        totalCompanies: companies.length,
        orphanedFound: orphanedCount,
        recovered: recoveredCount,
        timestamp: new Date()
      },
      ip: '127.0.0.1',
      userAgent: 'system'
    });

  } catch (error) {
    console.error('Error during company health check:', error);
  }
};

// ✅ ADMIN REPLACEMENT SUGGESTIONS

/**
 * Get suggested admin replacements for a company
 */
const getAdminReplacementSuggestions = async (companyId) => {
  try {
    const candidates = await User.find({
      clientId: companyId,
      role: 'client_user',
      isActive: true
    }).sort({ createdAt: 1 }); // Oldest first

    return candidates.map(user => ({
      userId: user._id,
      email: user.email,
      name: user.name,
      joinedAt: user.createdAt,
      tenure: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)), // days
      recommendation: user.createdAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) ? 'high' : 'medium' // 30+ days = high
    }));

  } catch (error) {
    console.error('Error getting admin replacement suggestions:', error);
    return [];
  }
};

// ✅ BULK ADMIN PROMOTION

/**
 * Promote a user to admin with proper validation and logging
 */
const promoteToAdmin = async (userId, companyId, promotedBy) => {
  try {
    const user = await User.findOne({
      _id: userId,
      clientId: companyId,
      role: 'client_user',
      isActive: true
    });

    if (!user) {
      throw new Error('User not found or not eligible for promotion');
    }

    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // Promote the user
    await User.findByIdAndUpdate(userId, { role: 'client_admin' });

    // Log the promotion
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: promotedBy,
      emailSnapshot: promotedBy ? 'platform_admin' : 'system',
      action: 'user.promoted_to_admin',
      targetType: 'user',
      targetId: userId.toString(),
      metadata: {
        companyName: company.companyName,
        promotedUser: {
          email: user.email,
          name: user.name,
          previousRole: 'client_user'
        },
        promotedBy: promotedBy || 'system',
        reason: 'admin_replacement'
      },
      ip: '127.0.0.1',
      userAgent: 'system'
    });

    return {
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        newRole: 'client_admin'
      }
    };

  } catch (error) {
    console.error('Error promoting user to admin:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  ensureCompanyHasAdmin,
  handleOrphanedCompany,
  flagOrphanedCompany,
  allowPlatformAdminEmergencyAccess,
  performCompanyHealthCheck,
  getAdminReplacementSuggestions,
  promoteToAdmin
};