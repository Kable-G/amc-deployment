const express = require("express");
const router = express.Router();
const AuditEvent = require("../models/AuditEvent");
const Company = require("../models/Company");
const AnalyticsService = require("../services/analyticsService");
const { authenticate } = require("../middleware/authMiddleware");
const { generalApiLimiter } = require("../middleware/rateLimiter");

// Middleware to ensure only platform_admin can access global audit logs
function requirePlatformAdmin(req, res, next) {
  if (req.user.role !== "platform_admin") {
    return res.status(403).json({ 
      success: false,
      error: "Access denied: platform admin only" 
    });
  }
  next();
}

// Middleware to ensure company access for company-scoped audit logs
function requireCompanyAccess(req, res, next) {
  const companyId = req.params.companyId || req.params.id;
  
  // Platform admin has access to all companies
  if (req.user.role === "platform_admin") {
    return next();
  }
  
  // Client admin must belong to the company they're accessing
  if (req.user.role === "client_admin" && 
      req.user.clientId && 
      req.user.clientId.toString() === companyId) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: "Access denied: insufficient permissions for this company"
  });
}

// Apply authentication and rate limiting to all audit routes
router.use(authenticate);
router.use(generalApiLimiter);

// ✅ 4. AUDIT & ACTIVITY TRACKING

// GET /api/audit - Platform admin: global activity logs
router.get("/", requirePlatformAdmin, async (req, res) => {
  try {
    const {
      action,
      clientId,
      userId,
      targetType,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Build query options
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      action,
      clientId,
      startDate,
      endDate
    };

    // Get platform-wide audit trail
    const auditEvents = await AuditEvent.getPlatformAuditTrail(options);
    
    // Get total count for pagination
    const query = {};
    if (action) query.action = action;
    if (clientId) query.clientId = clientId;
    if (userId) query.userId = userId;
    if (targetType) query.targetType = targetType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await AuditEvent.countDocuments(query);

    // Get summary statistics
    const stats = await AuditEvent.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      auditEvents: auditEvents.map(event => ({
        id: event._id,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        user: event.userId ? {
          id: event.userId._id,
          name: event.userId.name,
          email: event.userId.email,
          role: event.userId.role
        } : null,
        company: event.clientId ? {
          id: event.clientId._id,
          name: event.clientId.name
        } : null,
        emailSnapshot: event.emailSnapshot,
        metadata: event.metadata,
        ip: event.ip,
        userAgent: event.userAgent,
        createdAt: event.createdAt
      })),
      stats: stats.map(stat => ({
        action: stat._id,
        count: stat.count
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching global audit logs:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching audit logs"
    });
  }
});

// GET /api/audit/companies/:companyId - Company admin: company-scoped activity logs
router.get("/companies/:companyId", requireCompanyAccess, async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      action,
      userId,
      targetType,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Build query options
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      action,
      startDate,
      endDate
    };

    // Get company-scoped audit trail
    const auditEvents = await AuditEvent.getClientAuditTrail(companyId, options);
    
    // Get total count for pagination
    const query = { clientId: companyId };
    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (targetType) query.targetType = targetType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await AuditEvent.countDocuments(query);

    // Get activity summary for this company
    const stats = await AuditEvent.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get recent user activity
    const userActivity = await AuditEvent.aggregate([
      { $match: { clientId: companyId } },
      {
        $group: {
          _id: "$userId",
          lastActivity: { $max: "$createdAt" },
          actionCount: { $sum: 1 },
          emailSnapshot: { $first: "$emailSnapshot" }
        }
      },
      { $sort: { lastActivity: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      company: {
        id: company._id,
        name: company.name,
        companyId: company.companyId
      },
      auditEvents: auditEvents.map(event => ({
        id: event._id,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        user: event.userId ? {
          id: event.userId._id,
          name: event.userId.name,
          email: event.userId.email,
          role: event.userId.role
        } : null,
        emailSnapshot: event.emailSnapshot,
        metadata: event.metadata,
        ip: event.ip,
        userAgent: event.userAgent,
        createdAt: event.createdAt
      })),
      stats: stats.map(stat => ({
        action: stat._id,
        count: stat.count
      })),
      userActivity: userActivity.map(activity => ({
        userId: activity._id,
        email: activity.emailSnapshot,
        lastActivity: activity.lastActivity,
        actionCount: activity.actionCount
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching company audit logs:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching company audit logs"
    });
  }
});

// GET /api/audit/users/:userId - Get audit trail for specific user
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      action,
      clientId,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Authorization check
    const isPlatformAdmin = req.user.role === "platform_admin";
    const isOwnProfile = req.user._id.toString() === userId;
    const isClientAdmin = req.user.role === "client_admin";

    if (!isPlatformAdmin && !isOwnProfile && !isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: "Access denied: insufficient permissions"
      });
    }

    // If client admin, ensure they can only see users from their company
    if (isClientAdmin && !isOwnProfile) {
      const targetUser = await User.findById(userId);
      if (!targetUser || 
          !targetUser.clientId || 
          targetUser.clientId.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({
          success: false,
          error: "Access denied: user not in your company"
        });
      }
    }

    // Build query options
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
      action,
      startDate,
      endDate
    };

    // Get user audit trail
    const auditEvents = await AuditEvent.getUserAuditTrail(userId, options);
    
    // Get total count
    const query = { userId };
    if (action) query.action = action;
    if (clientId) query.clientId = clientId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await AuditEvent.countDocuments(query);

    res.json({
      success: true,
      auditEvents: auditEvents.map(event => ({
        id: event._id,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        company: event.clientId ? {
          id: event.clientId._id,
          name: event.clientId.name
        } : null,
        emailSnapshot: event.emailSnapshot,
        metadata: event.metadata,
        ip: event.ip,
        userAgent: event.userAgent,
        createdAt: event.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching user audit logs:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching user audit logs"
    });
  }
});

// GET /api/audit/actions - Get available audit actions for filtering
router.get("/actions", async (req, res) => {
  try {
    // Get distinct actions from audit events
    const actions = await AuditEvent.distinct("action");
    
    // Group actions by category
    const categorizedActions = {
      company: actions.filter(action => action.startsWith("company.")),
      user: actions.filter(action => action.startsWith("user.")),
      invite: actions.filter(action => action.startsWith("invite.")),
      content: actions.filter(action => 
        action.startsWith("upload.") || 
        action.startsWith("release.") || 
        action.startsWith("alert.")
      ),
      permission: actions.filter(action => 
        action.startsWith("permission.") || 
        action.startsWith("role.")
      )
    };

    res.json({
      success: true,
      actions: {
        all: actions.sort(),
        categorized: categorizedActions
      }
    });

  } catch (error) {
    console.error("Error fetching audit actions:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching audit actions"
    });
  }
});

// GET /api/audit/stats - Get audit statistics (platform admin only)
router.get("/stats", requirePlatformAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get activity stats for the last N days
    const dailyStats = await AuditEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            action: "$action"
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          actions: {
            $push: {
              action: "$_id.action",
              count: "$count"
            }
          },
          totalEvents: { $sum: "$count" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get top companies by activity
    const topCompanies = await AuditEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          clientId: { $ne: null }
        }
      },
      {
        $group: {
          _id: "$clientId",
          eventCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "companies",
          localField: "_id",
          foreignField: "_id",
          as: "company"
        }
      },
      { $unwind: "$company" },
      {
        $project: {
          companyId: "$company.companyId",
          companyName: "$company.name",
          eventCount: 1
        }
      },
      { $sort: { eventCount: -1 } },
      { $limit: 10 }
    ]);

    // Get overall totals
    const totalEvents = await AuditEvent.countDocuments({
      createdAt: { $gte: startDate }
    });

    const totalCompanies = await AuditEvent.distinct("clientId", {
      createdAt: { $gte: startDate },
      clientId: { $ne: null }
    });

    const totalUsers = await AuditEvent.distinct("userId", {
      createdAt: { $gte: startDate }
    });

    res.json({
      success: true,
      period: {
        days: parseInt(days),
        startDate,
        endDate: new Date()
      },
      totals: {
        events: totalEvents,
        activeCompanies: totalCompanies.length,
        activeUsers: totalUsers.length
      },
      dailyActivity: dailyStats,
      topCompanies
    });

  } catch (error) {
    console.error("Error fetching audit stats:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching audit statistics"
    });
  }
});

// GET /api/audit/platform/stats - Get platform dashboard statistics (Platform Admin only)
router.get("/platform/stats", requirePlatformAdmin, async (req, res) => {
  try {
    const User = require("../models/User");
    const Invite = require("../models/Invite");

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get total counts
    const [totalCompanies, totalUsers, pendingCompanies, activeCompanies] = await Promise.all([
      Company.countDocuments(),
      User.countDocuments({ isActive: true }),
      Company.countDocuments({ status: 'pending' }),
      Company.countDocuments({ status: 'active' })
    ]);

    // Get this month's new companies
    const companiesThisMonth = await Company.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Get last month's new companies for comparison
    const companiesLastMonth = await Company.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    // Get this month's new users
    const usersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth },
      isActive: true
    });

    // Get last month's new users for comparison
    const usersLastMonth = await User.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      isActive: true
    });

    // Calculate revenue (placeholder - implement based on your billing system)
    const monthlyRevenue = 0; // TODO: Implement based on your billing system
    const revenueChange = 0; // TODO: Calculate percentage change

    res.json({
      success: true,
      totalCompanies,
      totalUsers,
      pendingCompanies,
      monthlyRevenue,
      companiesChange: companiesThisMonth,
      usersChange: usersThisMonth,
      revenueChange,
      activeCompanies,
      stats: {
        companies: {
          total: totalCompanies,
          active: activeCompanies,
          pending: pendingCompanies,
          thisMonth: companiesThisMonth,
          lastMonth: companiesLastMonth
        },
        users: {
          total: totalUsers,
          thisMonth: usersThisMonth,
          lastMonth: usersLastMonth
        },
        revenue: {
          monthly: monthlyRevenue,
          change: revenueChange
        }
      }
    });

  } catch (error) {
    console.error("Error fetching platform stats:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching platform statistics"
    });
  }
});

// ✅ ENHANCED COMPANY-LEVEL ANALYTICS ENDPOINTS

// GET /api/v1/audit/company/analytics - Get comprehensive company analytics
router.get('/company/analytics', async (req, res) => {
  try {
    const companyId = req.user.clientId || req.user.companyId;
    const { timeRange = '30d' } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with any company'
      });
    }

    // Only allow client_admin or platform_admin to access analytics
    if (!['client_admin', 'platform_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to access company analytics'
      });
    }

    const analytics = await AnalyticsService.getCompanyActivityAnalytics(companyId, timeRange);
    
    if (!analytics.success) {
      return res.status(500).json(analytics);
    }

    // Log analytics access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user.id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'analytics.company_accessed',
      targetType: 'analytics',
      targetId: companyId.toString(),
      metadata: {
        timeRange,
        accessedBy: req.user.role,
        totalEvents: analytics.data.overview.totalEvents
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(analytics);

  } catch (error) {
    console.error('Error getting company analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching company analytics'
    });
  }
});

// GET /api/v1/audit/company/activity-log - Get detailed activity log for company
router.get('/company/activity-log', async (req, res) => {
  try {
    const companyId = req.user.clientId || req.user.companyId;
    const {
      page = 1,
      limit = 50,
      action,
      userId,
      startDate,
      endDate,
      severity
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with any company'
      });
    }

    // Only allow client_admin or platform_admin to access activity logs
    if (!['client_admin', 'platform_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to access activity logs'
      });
    }

    // Build query
    const query = { clientId: companyId };
    
    if (action) {
      query.action = new RegExp(action, 'i');
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Filter by severity for security events
    if (severity) {
      const severityActions = {
        high: ['security.suspicious_activity_detected', 'security.multiple_failures'],
        medium: ['security.rate_limit_exceeded', 'security.invalid_token_attempt'],
        low: ['security.token_validated', 'security.successful_login']
      };
      
      if (severityActions[severity]) {
        query.action = { $in: severityActions[severity] };
      }
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      AuditEvent.find(query)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      AuditEvent.countDocuments(query)
    ]);

    // Log activity log access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user.id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'analytics.activity_log_accessed',
      targetType: 'audit_log',
      targetId: companyId.toString(),
      metadata: {
        filters: { action, userId, startDate, endDate, severity },
        resultCount: events.length,
        totalCount: total,
        accessedBy: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: {
        events: events.map(event => ({
          id: event._id,
          action: event.action,
          targetType: event.targetType,
          targetId: event.targetId,
          user: event.userId ? {
            id: event.userId._id,
            name: event.userId.name,
            email: event.userId.email,
            role: event.userId.role
          } : null,
          emailSnapshot: event.emailSnapshot,
          metadata: event.metadata,
          ip: event.ip,
          userAgent: event.userAgent,
          createdAt: event.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error getting company activity log:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching activity log'
    });
  }
});

// GET /api/v1/audit/company/security-events - Get security events for company
router.get('/company/security-events', async (req, res) => {
  try {
    const companyId = req.user.clientId || req.user.companyId;
    const { timeRange = '7d', severity } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'User is not associated with any company'
      });
    }

    // Only allow client_admin or platform_admin to access security events
    if (!['client_admin', 'platform_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to access security events'
      });
    }

    const dateRange = AnalyticsService.getDateRange(timeRange);
    
    // Build query for security events
    const query = {
      clientId: companyId,
      action: { $regex: /^security\./ },
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    };

    // Filter by severity if specified
    if (severity) {
      const severityActions = {
        high: ['security.suspicious_activity_detected', 'security.multiple_failures', 'security.platform_admin_emergency_access'],
        medium: ['security.rate_limit_exceeded', 'security.invalid_token_attempt', 'security.reused_token_attempt'],
        low: ['security.token_validated', 'security.expired_token_attempt']
      };
      
      if (severityActions[severity]) {
        query.action = { $in: severityActions[severity] };
      }
    }

    const [events, summary] = await Promise.all([
      AuditEvent.find(query)
        .sort({ createdAt: -1 })
        .limit(100),
      AuditEvent.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            uniqueIPs: { $addToSet: '$ip' },
            latestEvent: { $max: '$createdAt' }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    // Log security events access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user.id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'analytics.security_events_accessed',
      targetType: 'security_log',
      targetId: companyId.toString(),
      metadata: {
        timeRange,
        severity,
        eventCount: events.length,
        accessedBy: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: {
        events: events.map(event => ({
          id: event._id,
          action: event.action,
          severity: AnalyticsService.getSecurityEventSeverity(event.action),
          targetType: event.targetType,
          targetId: event.targetId,
          emailSnapshot: event.emailSnapshot,
          metadata: event.metadata,
          ip: event.ip,
          userAgent: event.userAgent,
          createdAt: event.createdAt
        })),
        summary: summary.map(item => ({
          action: item._id,
          count: item.count,
          uniqueIPs: item.uniqueIPs.length,
          latestEvent: item.latestEvent,
          severity: AnalyticsService.getSecurityEventSeverity(item._id)
        })),
        timeRange: {
          start: dateRange.start,
          end: dateRange.end,
          period: timeRange
        }
      }
    });

  } catch (error) {
    console.error('Error getting security events:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching security events'
    });
  }
});

// ✅ PLATFORM-LEVEL ANALYTICS ENDPOINTS (Platform Admin Only)

// GET /api/v1/audit/platform/analytics - Get platform-wide analytics
router.get('/platform/analytics', requirePlatformAdmin, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const analytics = await AnalyticsService.getPlatformAnalytics(timeRange);
    
    if (!analytics.success) {
      return res.status(500).json(analytics);
    }

    // Log platform analytics access
    await AuditEvent.logEvent({
      clientId: null,
      userId: req.user.id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'analytics.platform_accessed',
      targetType: 'platform_analytics',
      targetId: 'platform',
      metadata: {
        timeRange,
        totalCompanies: analytics.data.companies.total,
        totalUsers: analytics.data.users.total
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(analytics);

  } catch (error) {
    console.error('Error getting platform analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching platform analytics'
    });
  }
});

// GET /api/v1/audit/platform/companies - Get company analytics overview
router.get('/platform/companies', requirePlatformAdmin, async (req, res) => {
  try {
    const { timeRange = '30d', sortBy = 'activity', limit = 20 } = req.query;
    const dateRange = AnalyticsService.getDateRange(timeRange);

    // Get company activity ranking
    const pipeline = [
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          clientId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$clientId',
          eventCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          securityEvents: {
            $sum: {
              $cond: [{ $regexMatch: { input: '$action', regex: /^security\./ } }, 1, 0]
            }
          },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'companies',
          localField: '_id',
          foreignField: '_id',
          as: 'company'
        }
      },
      {
        $sort: sortBy === 'activity' ? { eventCount: -1 } : { lastActivity: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ];

    const companies = await AuditEvent.aggregate(pipeline);

    // Log platform company overview access
    await AuditEvent.logEvent({
      clientId: null,
      userId: req.user.id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'analytics.platform_companies_accessed',
      targetType: 'platform_analytics',
      targetId: 'companies',
      metadata: {
        timeRange,
        sortBy,
        limit: parseInt(limit),
        resultCount: companies.length
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: {
        companies: companies.map(company => ({
          companyId: company._id,
          companyName: company.company[0]?.companyName || 'Unknown',
          status: company.company[0]?.status || 'unknown',
          eventCount: company.eventCount,
          uniqueUsers: company.uniqueUsers.filter(id => id !== null).length,
          securityEvents: company.securityEvents,
          lastActivity: company.lastActivity,
          riskLevel: company.securityEvents > 10 ? 'high' : company.securityEvents > 5 ? 'medium' : 'low'
        })),
        timeRange: {
          start: dateRange.start,
          end: dateRange.end,
          period: timeRange
        }
      }
    });

  } catch (error) {
    console.error('Error getting platform company analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching company analytics'
    });
  }
});

module.exports = router;