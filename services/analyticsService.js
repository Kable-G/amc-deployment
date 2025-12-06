const AuditEvent = require('../models/AuditEvent');
const User = require('../models/User');
const Invite = require('../models/Invite');
const Company = require('../models/Company');
const mongoose = require('mongoose');

// ✅ COMPANY-LEVEL ANALYTICS SERVICE

class AnalyticsService {
  
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPANY ACTIVITY ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get comprehensive company activity analytics
   */
  static async getCompanyActivityAnalytics(companyId, timeRange = '30d') {
    try {
      const dateRange = this.getDateRange(timeRange);
      
      // Parallel execution for better performance
      const [
        activityOverview,
        userActivityBreakdown,
        invitationAnalytics,
        securityEvents,
        dailyActivity,
        topActions
      ] = await Promise.all([
        this.getActivityOverview(companyId, dateRange),
        this.getUserActivityBreakdown(companyId, dateRange),
        this.getInvitationAnalytics(companyId, dateRange),
        this.getSecurityEvents(companyId, dateRange),
        this.getDailyActivityTrend(companyId, dateRange),
        this.getTopActions(companyId, dateRange)
      ]);

      return {
        success: true,
        data: {
          timeRange,
          dateRange,
          overview: activityOverview,
          userActivity: userActivityBreakdown,
          invitations: invitationAnalytics,
          security: securityEvents,
          trends: {
            daily: dailyActivity
          },
          insights: {
            topActions,
            recommendations: this.generateRecommendations(activityOverview, securityEvents)
          }
        }
      };

    } catch (error) {
      console.error('Error getting company activity analytics:', error);
      return {
        success: false,
        error: 'Failed to generate company analytics'
      };
    }
  }

  /**
   * Get activity overview metrics
   */
  static async getActivityOverview(companyId, dateRange) {
    const pipeline = [
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          actionTypes: { $addToSet: '$action' },
          securityEvents: {
            $sum: {
              $cond: [{ $regexMatch: { input: '$action', regex: /^security\./ } }, 1, 0]
            }
          },
          userEvents: {
            $sum: {
              $cond: [{ $regexMatch: { input: '$action', regex: /^user\./ } }, 1, 0]
            }
          },
          inviteEvents: {
            $sum: {
              $cond: [{ $regexMatch: { input: '$action', regex: /^invite\./ } }, 1, 0]
            }
          },
          companyEvents: {
            $sum: {
              $cond: [{ $regexMatch: { input: '$action', regex: /^company\./ } }, 1, 0]
            }
          }
        }
      }
    ];

    const result = await AuditEvent.aggregate(pipeline);
    const overview = result[0] || {};

    return {
      totalEvents: overview.totalEvents || 0,
      uniqueActiveUsers: overview.uniqueUsers ? overview.uniqueUsers.length : 0,
      actionTypeCount: overview.actionTypes ? overview.actionTypes.length : 0,
      eventBreakdown: {
        security: overview.securityEvents || 0,
        user: overview.userEvents || 0,
        invitation: overview.inviteEvents || 0,
        company: overview.companyEvents || 0
      }
    };
  }

  /**
   * Get user activity breakdown
   */
  static async getUserActivityBreakdown(companyId, dateRange) {
    const pipeline = [
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          userId: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$userId',
          eventCount: { $sum: 1 },
          lastActivity: { $max: '$createdAt' },
          actions: { $addToSet: '$action' },
          emailSnapshot: { $first: '$emailSnapshot' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $sort: { eventCount: -1 }
      },
      {
        $limit: 20
      }
    ];

    const results = await AuditEvent.aggregate(pipeline);
    
    return results.map(user => ({
      userId: user._id,
      email: user.emailSnapshot,
      name: user.userInfo[0]?.name || 'Unknown',
      role: user.userInfo[0]?.role || 'unknown',
      eventCount: user.eventCount,
      actionCount: user.actions.length,
      lastActivity: user.lastActivity,
      activityLevel: this.calculateActivityLevel(user.eventCount)
    }));
  }

  /**
   * Get invitation analytics
   */
  static async getInvitationAnalytics(companyId, dateRange) {
    // Get invitation events from audit log
    const inviteEventsPipeline = [
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          action: { $regex: /^invite\./ }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ];

    // Get current invitation status from Invite collection
    const inviteStatusPipeline = [
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ];

    const [inviteEvents, inviteStatuses] = await Promise.all([
      AuditEvent.aggregate(inviteEventsPipeline),
      Invite.aggregate(inviteStatusPipeline)
    ]);

    const eventBreakdown = {};
    inviteEvents.forEach(event => {
      eventBreakdown[event._id] = event.count;
    });

    const statusBreakdown = {};
    inviteStatuses.forEach(status => {
      statusBreakdown[status._id] = status.count;
    });

    return {
      events: eventBreakdown,
      statuses: statusBreakdown,
      metrics: {
        totalSent: eventBreakdown['invite.sent'] || 0,
        totalAccepted: eventBreakdown['invite.accepted'] || 0,
        totalRevoked: eventBreakdown['invite.revoked'] || 0,
        totalResent: eventBreakdown['invite.resent'] || 0,
        acceptanceRate: this.calculateAcceptanceRate(eventBreakdown)
      }
    };
  }

  /**
   * Get security events analytics
   */
  static async getSecurityEvents(companyId, dateRange) {
    const pipeline = [
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end },
          action: { $regex: /^security\./ }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          uniqueIPs: { $addToSet: '$ip' },
          latestEvent: { $max: '$createdAt' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ];

    const results = await AuditEvent.aggregate(pipeline);
    
    const totalSecurityEvents = results.reduce((sum, event) => sum + event.count, 0);
    const uniqueIPs = new Set();
    results.forEach(event => {
      event.uniqueIPs.forEach(ip => uniqueIPs.add(ip));
    });

    return {
      totalEvents: totalSecurityEvents,
      uniqueIPs: uniqueIPs.size,
      eventTypes: results.map(event => ({
        action: event._id,
        count: event.count,
        uniqueIPs: event.uniqueIPs.length,
        latestEvent: event.latestEvent,
        severity: this.getSecurityEventSeverity(event._id)
      })),
      riskLevel: this.calculateSecurityRiskLevel(results)
    };
  }

  /**
   * Get daily activity trend
   */
  static async getDailyActivityTrend(companyId, dateRange) {
    const pipeline = [
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          eventCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          securityEvents: {
            $sum: {
              $cond: [{ $regexMatch: { input: '$action', regex: /^security\./ } }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ];

    const results = await AuditEvent.aggregate(pipeline);
    
    return results.map(day => ({
      date: new Date(day._id.year, day._id.month - 1, day._id.day),
      eventCount: day.eventCount,
      uniqueUsers: day.uniqueUsers.filter(id => id !== null).length,
      securityEvents: day.securityEvents
    }));
  }

  /**
   * Get top actions performed
   */
  static async getTopActions(companyId, dateRange) {
    const pipeline = [
      {
        $match: {
          clientId: new mongoose.Types.ObjectId(companyId),
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          latestEvent: { $max: '$createdAt' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ];

    const results = await AuditEvent.aggregate(pipeline);
    
    return results.map(action => ({
      action: action._id,
      count: action.count,
      uniqueUsers: action.uniqueUsers.filter(id => id !== null).length,
      latestEvent: action.latestEvent,
      category: this.getActionCategory(action._id)
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLATFORM-LEVEL ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get platform-wide analytics (for platform admins)
   */
  static async getPlatformAnalytics(timeRange = '30d') {
    try {
      const dateRange = this.getDateRange(timeRange);
      
      const [
        companyMetrics,
        userMetrics,
        invitationMetrics,
        securityMetrics,
        growthTrends
      ] = await Promise.all([
        this.getCompanyMetrics(dateRange),
        this.getUserMetrics(dateRange),
        this.getInvitationMetrics(dateRange),
        this.getSecurityMetrics(dateRange),
        this.getGrowthTrends(dateRange)
      ]);

      return {
        success: true,
        data: {
          timeRange,
          dateRange,
          companies: companyMetrics,
          users: userMetrics,
          invitations: invitationMetrics,
          security: securityMetrics,
          growth: growthTrends
        }
      };

    } catch (error) {
      console.error('Error getting platform analytics:', error);
      return {
        success: false,
        error: 'Failed to generate platform analytics'
      };
    }
  }

  /**
   * Get company metrics for platform view
   */
  static async getCompanyMetrics(dateRange) {
    const [totalCompanies, activeCompanies, newCompanies, companyActivity] = await Promise.all([
      Company.countDocuments(),
      Company.countDocuments({ status: 'active' }),
      Company.countDocuments({ 
        createdAt: { $gte: dateRange.start, $lte: dateRange.end } 
      }),
      this.getCompanyActivityRanking(dateRange)
    ]);

    return {
      total: totalCompanies,
      active: activeCompanies,
      newThisPeriod: newCompanies,
      activityRanking: companyActivity
    };
  }

  /**
   * Get user metrics for platform view
   */
  static async getUserMetrics(dateRange) {
    const [totalUsers, activeUsers, newUsers, roleDistribution] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ 
        createdAt: { $gte: dateRange.start, $lte: dateRange.end } 
      }),
      this.getUserRoleDistribution()
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      newThisPeriod: newUsers,
      roleDistribution
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get date range based on time period
   */
  static getDateRange(timeRange) {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }

    return { start, end };
  }

  /**
   * Calculate activity level based on event count
   */
  static calculateActivityLevel(eventCount) {
    if (eventCount >= 50) return 'high';
    if (eventCount >= 20) return 'medium';
    if (eventCount >= 5) return 'low';
    return 'minimal';
  }

  /**
   * Calculate invitation acceptance rate
   */
  static calculateAcceptanceRate(eventBreakdown) {
    const sent = eventBreakdown['invite.sent'] || 0;
    const accepted = eventBreakdown['invite.accepted'] || 0;
    return sent > 0 ? Math.round((accepted / sent) * 100) : 0;
  }

  /**
   * Get security event severity
   */
  static getSecurityEventSeverity(action) {
    const highSeverity = [
      'security.suspicious_activity_detected',
      'security.multiple_failures',
      'security.platform_admin_emergency_access'
    ];
    
    const mediumSeverity = [
      'security.rate_limit_exceeded',
      'security.invalid_token_attempt',
      'security.reused_token_attempt'
    ];

    if (highSeverity.includes(action)) return 'high';
    if (mediumSeverity.includes(action)) return 'medium';
    return 'low';
  }

  /**
   * Calculate security risk level
   */
  static calculateSecurityRiskLevel(securityEvents) {
    const highRiskEvents = securityEvents.filter(event => 
      this.getSecurityEventSeverity(event._id) === 'high'
    ).reduce((sum, event) => sum + event.count, 0);

    const totalEvents = securityEvents.reduce((sum, event) => sum + event.count, 0);

    if (highRiskEvents > 10 || totalEvents > 100) return 'high';
    if (highRiskEvents > 5 || totalEvents > 50) return 'medium';
    return 'low';
  }

  /**
   * Get action category
   */
  static getActionCategory(action) {
    if (action.startsWith('security.')) return 'Security';
    if (action.startsWith('user.')) return 'User Management';
    if (action.startsWith('invite.')) return 'Invitations';
    if (action.startsWith('company.')) return 'Company';
    return 'Other';
  }

  /**
   * Generate recommendations based on analytics
   */
  static generateRecommendations(overview, security) {
    const recommendations = [];

    // Security recommendations
    if (security.riskLevel === 'high') {
      recommendations.push({
        type: 'security',
        priority: 'high',
        title: 'High Security Risk Detected',
        description: 'Multiple security events detected. Review security logs and consider additional protection measures.',
        action: 'Review security events and implement additional safeguards'
      });
    }

    // Activity recommendations
    if (overview.uniqueActiveUsers < 3) {
      recommendations.push({
        type: 'engagement',
        priority: 'medium',
        title: 'Low User Engagement',
        description: 'Consider inviting more team members or providing user training.',
        action: 'Invite additional team members or provide onboarding support'
      });
    }

    return recommendations;
  }

  /**
   * Get company activity ranking
   */
  static async getCompanyActivityRanking(dateRange) {
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
          uniqueUsers: { $addToSet: '$userId' }
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
        $sort: { eventCount: -1 }
      },
      {
        $limit: 10
      }
    ];

    const results = await AuditEvent.aggregate(pipeline);
    
    return results.map(company => ({
      companyId: company._id,
      companyName: company.company[0]?.companyName || 'Unknown',
      eventCount: company.eventCount,
      uniqueUsers: company.uniqueUsers.filter(id => id !== null).length
    }));
  }

  /**
   * Get user role distribution
   */
  static async getUserRoleDistribution() {
    const pipeline = [
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ];

    const results = await User.aggregate(pipeline);
    const distribution = {};
    results.forEach(role => {
      distribution[role._id] = role.count;
    });

    return distribution;
  }
}

module.exports = AnalyticsService;