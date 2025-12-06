const UserAnalytics = require('../models/UserAnalytics');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

class AnalyticsMiddleware {
  constructor() {
    this.sessions = new Map(); // In-memory session tracking
  }

  // Initialize analytics tracking for a user session
  initializeSession = (req, res, next) => {
    try {
      // Generate session ID if not exists
      if (!req.session.analyticsSessionId) {
        req.session.analyticsSessionId = this.generateSessionId();
      }

      // Parse user agent
      const parser = new UAParser(req.headers['user-agent']);
      const uaResult = parser.getResult();

      // Get IP and location data
      const clientIP = this.getClientIP(req);
      const geoData = geoip.lookup(clientIP) || {};

      // Extract UTM parameters
      const utmParams = this.extractUTMParameters(req);

      // Create or update session data
      const sessionData = {
        sessionId: req.session.analyticsSessionId,
        userId: req.user?._id || null,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        browser: `${uaResult.browser.name} ${uaResult.browser.version}`,
        browserVersion: uaResult.browser.version,
        os: `${uaResult.os.name} ${uaResult.os.version}`,
        device: uaResult.device.type || 'desktop',
        screenResolution: req.headers['screen-resolution'] || 'unknown',
        timezone: req.headers['timezone'] || 'unknown',
        language: req.headers['accept-language']?.split(',')[0] || 'unknown',
        referrer: req.headers.referer || 'direct',
        location: {
          country: geoData.country || 'unknown',
          region: geoData.region || 'unknown',
          city: geoData.city || 'unknown',
          latitude: geoData.ll?.[0] || null,
          longitude: geoData.ll?.[1] || null,
          isp: 'unknown', // Would need additional service
          organization: 'unknown'
        },
        utmParameters: utmParams,
        startTime: new Date()
      };

      // Store in memory for quick access
      this.sessions.set(req.session.analyticsSessionId, sessionData);

      // Add to request for use in other middleware
      req.analyticsSession = sessionData;

      next();
    } catch (error) {
      console.error('Analytics initialization error:', error);
      next(); // Continue even if analytics fails
    }
  };

  // Track page views and interactions
  trackPageView = async (req, res, next) => {
    try {
      if (!req.analyticsSession) {
        return next();
      }

      const pageData = {
        page: req.route?.path || req.path,
        url: req.originalUrl,
        title: req.headers['page-title'] || 'Unknown',
        timestamp: new Date(),
        method: req.method,
        statusCode: res.statusCode,
        responseTime: res.responseTime || 0
      };

      // Store page view data
      req.pageViewData = pageData;

      // Track API response times
      const startTime = Date.now();
      
      res.on('finish', async () => {
        try {
          const responseTime = Date.now() - startTime;
          await this.savePageView(req, responseTime);
        } catch (error) {
          console.error('Error saving page view:', error);
        }
      });

      next();
    } catch (error) {
      console.error('Page view tracking error:', error);
      next();
    }
  };

  // Track content interactions (downloads, views, etc.)
  trackContentInteraction = (contentType, action) => {
    return async (req, res, next) => {
      try {
        if (req.user && req.analyticsSession) {
          const interaction = {
            contentType,
            contentId: req.params.id || req.params.uuid || req.body.contentId,
            action,
            timestamp: new Date(),
            metadata: {
              userAgent: req.headers['user-agent'],
              referrer: req.headers.referer,
              ip: this.getClientIP(req),
              additionalData: req.body.analyticsData || {}
            }
          };

          // Save interaction asynchronously
          this.saveContentInteraction(req.user._id, req.analyticsSession.sessionId, interaction)
            .catch(error => console.error('Content interaction tracking error:', error));
        }
        next();
      } catch (error) {
        console.error('Content interaction middleware error:', error);
        next();
      }
    };
  };

  // Track downloads
  trackDownload = async (req, res, next) => {
    try {
      if (req.user && req.analyticsSession) {
        const downloadData = {
          assetId: req.params.id || req.params.uuid,
          assetType: this.getAssetType(req.originalUrl),
          fileName: req.params.filename || 'unknown',
          fileSize: req.headers['content-length'] || 0,
          downloadTime: new Date(),
          source: req.headers.referer ? 'referrer' : 'direct',
          userAgent: req.headers['user-agent'],
          ip: this.getClientIP(req)
        };

        // Track download start
        const startTime = Date.now();
        
        res.on('finish', async () => {
          try {
            downloadData.downloadDuration = (Date.now() - startTime) / 1000;
            downloadData.completed = res.statusCode === 200;
            
            await this.saveDownload(req.user._id, req.analyticsSession.sessionId, downloadData);
          } catch (error) {
            console.error('Download tracking error:', error);
          }
        });
      }
      next();
    } catch (error) {
      console.error('Download tracking middleware error:', error);
      next();
    }
  };

  // Track form interactions
  trackFormInteraction = (formType) => {
    return async (req, res, next) => {
      try {
        if (req.analyticsSession) {
          const formData = {
            formType,
            formId: req.body.formId || `${formType}_${Date.now()}`,
            started: new Date(),
            fields: this.analyzeFormFields(req.body),
            userAgent: req.headers['user-agent'],
            ip: this.getClientIP(req)
          };

          // Save form interaction
          res.on('finish', async () => {
            try {
              formData.completed = res.statusCode < 400 ? new Date() : null;
              formData.abandoned = res.statusCode >= 400;
              
              await this.saveFormInteraction(
                req.user?._id, 
                req.analyticsSession.sessionId, 
                formData
              );
            } catch (error) {
              console.error('Form interaction tracking error:', error);
            }
          });
        }
        next();
      } catch (error) {
        console.error('Form tracking middleware error:', error);
        next();
      }
    };
  };

  // Track search queries
  trackSearch = async (req, res, next) => {
    try {
      if (req.analyticsSession) {
        const searchData = {
          query: req.query.q || req.query.search || req.body.query,
          timestamp: new Date(),
          source: req.originalUrl.includes('/api/') ? 'api' : 'frontend',
          filters: req.query.filters || req.body.filters || {},
          userAgent: req.headers['user-agent'],
          ip: this.getClientIP(req)
        };

        // Save search after response
        res.on('finish', async () => {
          try {
            if (res.locals.searchResults) {
              searchData.resultsCount = res.locals.searchResults.length;
              searchData.clickedResults = res.locals.clickedResults || [];
            }
            
            await this.saveSearch(
              req.user?._id, 
              req.analyticsSession.sessionId, 
              searchData
            );
          } catch (error) {
            console.error('Search tracking error:', error);
          }
        });
      }
      next();
    } catch (error) {
      console.error('Search tracking middleware error:', error);
      next();
    }
  };

  // Save analytics data to database
  async savePageView(req, responseTime) {
    if (!req.user || !req.analyticsSession) return;

    try {
      let analytics = await UserAnalytics.findOne({
        userId: req.user._id,
        sessionId: req.analyticsSession.sessionId
      });

      if (!analytics) {
        analytics = new UserAnalytics({
          userId: req.user._id,
          sessionId: req.analyticsSession.sessionId,
          sessionData: req.analyticsSession,
          location: req.analyticsSession.location,
          attribution: {
            firstTouch: {
              source: req.analyticsSession.referrer,
              timestamp: new Date()
            },
            utmParameters: req.analyticsSession.utmParameters
          },
          privacyConsent: {
            analyticsConsent: true, // Assume consent for now
            consentTimestamp: new Date()
          }
        });
      }

      // Add page view
      analytics.pageViews.push({
        ...req.pageViewData,
        timeOnPage: responseTime / 1000
      });

      // Update performance metrics
      analytics.performanceMetrics.pageLoadTimes.push({
        page: req.pageViewData.page,
        loadTime: responseTime,
        timestamp: new Date()
      });

      // Update API response times for API calls
      if (req.originalUrl.includes('/api/')) {
        analytics.performanceMetrics.apiResponseTimes.push({
          endpoint: req.originalUrl,
          responseTime: responseTime,
          statusCode: req.pageViewData.statusCode,
          timestamp: new Date()
        });
      }

      await analytics.save();
    } catch (error) {
      console.error('Error saving page view analytics:', error);
    }
  }

  async saveContentInteraction(userId, sessionId, interaction) {
    try {
      await UserAnalytics.updateOne(
        { userId, sessionId },
        { 
          $push: { contentInteractions: interaction },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving content interaction:', error);
    }
  }

  async saveDownload(userId, sessionId, downloadData) {
    try {
      await UserAnalytics.updateOne(
        { userId, sessionId },
        { 
          $push: { downloads: downloadData },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving download:', error);
    }
  }

  async saveFormInteraction(userId, sessionId, formData) {
    try {
      await UserAnalytics.updateOne(
        { userId: userId || null, sessionId },
        { 
          $push: { formInteractions: formData },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving form interaction:', error);
    }
  }

  async saveSearch(userId, sessionId, searchData) {
    try {
      await UserAnalytics.updateOne(
        { userId: userId || null, sessionId },
        { 
          $push: { searchQueries: searchData },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error saving search:', error);
    }
  }

  // Utility methods
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }

  extractUTMParameters(req) {
    return {
      source: req.query.utm_source || null,
      medium: req.query.utm_medium || null,
      campaign: req.query.utm_campaign || null,
      term: req.query.utm_term || null,
      content: req.query.utm_content || null
    };
  }

  getAssetType(url) {
    if (url.includes('/images/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return 'image';
    if (url.includes('/videos/') || /\.(mp4|mov|avi|wmv)$/i.test(url)) return 'video';
    if (url.includes('/documents/') || /\.(pdf|doc|docx|txt)$/i.test(url)) return 'document';
    if (url.includes('.zip')) return 'zip';
    return 'unknown';
  }

  analyzeFormFields(body) {
    const fields = [];
    for (const [key, value] of Object.entries(body)) {
      if (key !== 'password' && key !== 'confirmPassword') { // Don't track sensitive data
        fields.push({
          fieldName: key,
          interacted: !!value,
          hasValue: !!value,
          valueLength: typeof value === 'string' ? value.length : 0
        });
      }
    }
    return fields;
  }

  // Cleanup old sessions from memory (call periodically)
  cleanupSessions() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [sessionId, sessionData] of this.sessions.entries()) {
      if (sessionData.startTime.getTime() < oneHourAgo) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Create singleton instance
const analyticsMiddleware = new AnalyticsMiddleware();

// Cleanup sessions every hour
setInterval(() => {
  analyticsMiddleware.cleanupSessions();
}, 60 * 60 * 1000);

module.exports = analyticsMiddleware;