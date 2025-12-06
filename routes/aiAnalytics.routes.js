// routes/aiAnalytics.routes.js - Enhanced AI-Powered Analytics API Routes

const express = require('express');
const router = express.Router();
const AIAnalyticsService = require('../services/aiAnalyticsService');
const EnhancedAIAnalyticsService = require('../services/aiAnalyticsService.enhanced');
const { authenticate } = require('../middleware/authMiddleware');
const AuditEvent = require('../models/AuditEvent');

// Apply authentication to all AI analytics routes
router.use(authenticate);

// Middleware to ensure proper access control
function requireAnalyticsAccess(req, res, next) {
  if (!['client_admin', 'platform_admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions to access AI analytics'
    });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// AI ANALYTICS REPORT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/ai-analytics/comprehensive-report
 * @desc    Generate comprehensive AI-powered analytics report
 * @access  Private (client_admin, platform_admin)
 */
router.get('/comprehensive-report', requireAnalyticsAccess, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    console.log(`🤖 Generating comprehensive AI report for company ${companyId}`);

    // Use Enhanced AI Analytics Service for better intelligence
    const report = await EnhancedAIAnalyticsService.generateAIReport(companyId, timeRange, 'comprehensive');

    // Log AI analytics access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'ai_analytics.comprehensive_report_generated',
      targetType: 'ai_analytics',
      targetId: companyId.toString(),
      metadata: {
        timeRange,
        reportType: 'comprehensive',
        confidence: report.data?.aiInsights?.reportMetadata?.confidence || 0,
        accessedBy: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(report);

  } catch (error) {
    console.error('Error generating comprehensive AI report:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating AI analytics report'
    });
  }
});

/**
 * @route   GET /api/v1/ai-analytics/daily-report
 * @desc    Generate automated daily AI report
 * @access  Private (client_admin, platform_admin)
 */
router.get('/daily-report', requireAnalyticsAccess, async (req, res) => {
  try {
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for daily reports
    const report = await EnhancedAIAnalyticsService.generateDailyReport ?
      await EnhancedAIAnalyticsService.generateDailyReport(companyId) :
      await EnhancedAIAnalyticsService.generateAIReport(companyId, '1d', 'daily');

    // Log daily report access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'ai_analytics.daily_report_generated',
      targetType: 'ai_analytics',
      targetId: companyId.toString(),
      metadata: {
        reportType: 'daily',
        accessedBy: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(report);

  } catch (error) {
    console.error('Error generating daily AI report:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating daily AI report'
    });
  }
});

/**
 * @route   GET /api/v1/ai-analytics/weekly-report
 * @desc    Generate automated weekly AI report
 * @access  Private (client_admin, platform_admin)
 */
router.get('/weekly-report', requireAnalyticsAccess, async (req, res) => {
  try {
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for weekly reports
    const report = await EnhancedAIAnalyticsService.generateWeeklyReport ?
      await EnhancedAIAnalyticsService.generateWeeklyReport(companyId) :
      await EnhancedAIAnalyticsService.generateAIReport(companyId, '7d', 'weekly');

    // Log weekly report access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'ai_analytics.weekly_report_generated',
      targetType: 'ai_analytics',
      targetId: companyId.toString(),
      metadata: {
        reportType: 'weekly',
        accessedBy: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(report);

  } catch (error) {
    console.error('Error generating weekly AI report:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating weekly AI report'
    });
  }
});

/**
 * @route   GET /api/v1/ai-analytics/monthly-report
 * @desc    Generate automated monthly AI report
 * @access  Private (client_admin, platform_admin)
 */
router.get('/monthly-report', requireAnalyticsAccess, async (req, res) => {
  try {
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for monthly reports
    const report = await EnhancedAIAnalyticsService.generateMonthlyReport ?
      await EnhancedAIAnalyticsService.generateMonthlyReport(companyId) :
      await EnhancedAIAnalyticsService.generateAIReport(companyId, '30d', 'monthly');

    // Log monthly report access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'ai_analytics.monthly_report_generated',
      targetType: 'ai_analytics',
      targetId: companyId.toString(),
      metadata: {
        reportType: 'monthly',
        accessedBy: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(report);

  } catch (error) {
    console.error('Error generating monthly AI report:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating monthly AI report'
    });
  }
});

/**
 * @route   POST /api/v1/ai-analytics/custom-report
 * @desc    Generate custom AI report with specific parameters
 * @access  Private (client_admin, platform_admin)
 */
router.post('/custom-report', requireAnalyticsAccess, async (req, res) => {
  try {
    const companyId = req.user.role === 'platform_admin' 
      ? req.body.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    const options = {
      timeRange: req.body.timeRange || '30d',
      focusAreas: req.body.focusAreas || ['behavior', 'performance', 'security'],
      includeRecommendations: req.body.includeRecommendations !== false,
      includePredictions: req.body.includePredictions !== false,
      reportFormat: req.body.reportFormat || 'comprehensive'
    };

    // Use Enhanced AI Analytics Service for custom reports
    const report = await EnhancedAIAnalyticsService.generateCustomReport ?
      await EnhancedAIAnalyticsService.generateCustomReport(companyId, options) :
      await EnhancedAIAnalyticsService.generateAIReport(companyId, options.timeRange, options.reportFormat);

    // Log custom report access
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email || 'unknown',
      action: 'ai_analytics.custom_report_generated',
      targetType: 'ai_analytics',
      targetId: companyId.toString(),
      metadata: {
        ...options,
        accessedBy: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json(report);

  } catch (error) {
    console.error('Error generating custom AI report:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating custom AI report'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI INSIGHTS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/ai-analytics/behavior-insights
 * @desc    Get AI-powered behavior pattern analysis
 * @access  Private (client_admin, platform_admin)
 */
router.get('/behavior-insights', requireAnalyticsAccess, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for behavior insights
    const insights = await EnhancedAIAnalyticsService.analyzeBehaviorPatterns(companyId, timeRange);

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Error getting behavior insights:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while analyzing behavior patterns'
    });
  }
});

/**
 * @route   GET /api/v1/ai-analytics/performance-insights
 * @desc    Get AI-powered performance analysis
 * @access  Private (client_admin, platform_admin)
 */
router.get('/performance-insights', requireAnalyticsAccess, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for performance insights
    const insights = await EnhancedAIAnalyticsService.analyzePerformanceMetrics(companyId, timeRange);

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Error getting performance insights:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while analyzing performance metrics'
    });
  }
});

/**
 * @route   GET /api/v1/ai-analytics/security-insights
 * @desc    Get AI-powered security analysis
 * @access  Private (client_admin, platform_admin)
 */
router.get('/security-insights', requireAnalyticsAccess, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for security insights
    const insights = await EnhancedAIAnalyticsService.analyzeSecurityPatterns(companyId, timeRange);

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Error getting security insights:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while analyzing security patterns'
    });
  }
});

/**
 * @route   GET /api/v1/ai-analytics/predictive-insights
 * @desc    Get AI-powered predictive analysis
 * @access  Private (client_admin, platform_admin)
 */
router.get('/predictive-insights', requireAnalyticsAccess, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for predictive insights
    const insights = await EnhancedAIAnalyticsService.generatePredictiveInsights(companyId, timeRange);

    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Error getting predictive insights:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating predictive insights'
    });
  }
});

/**
 * @route   GET /api/v1/ai-analytics/recommendations
 * @desc    Get AI-powered actionable recommendations
 * @access  Private (client_admin, platform_admin)
 */
router.get('/recommendations', requireAnalyticsAccess, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const companyId = req.user.role === 'platform_admin' 
      ? req.query.companyId 
      : req.user.clientId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID is required'
      });
    }

    // Use Enhanced AI Analytics Service for recommendations
    const recommendations = await EnhancedAIAnalyticsService.generateActionableRecommendations(companyId, timeRange);

    res.json({
      success: true,
      data: recommendations
    });

  } catch (error) {
    console.error('Error getting AI recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while generating recommendations'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI ANALYTICS HEALTH & STATUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/ai-analytics/health
 * @desc    Check AI analytics service health
 * @access  Private (client_admin, platform_admin)
 */
router.get('/health', requireAnalyticsAccess, async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      version: '1.0.0',
      capabilities: [
        'behavior_analysis',
        'performance_analysis',
        'security_analysis',
        'predictive_insights',
        'automated_reporting',
        'actionable_recommendations'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking AI analytics health:', error);
    res.status(500).json({
      success: false,
      error: 'AI analytics service health check failed'
    });
  }
});

module.exports = router;