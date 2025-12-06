/**
 * AutoMediaCenter User Tracking System
 * Tracks user activities for admin insights (Level 3 access only)
 */

class AMCUserTracker {
  constructor() {
    this.storageKey = 'amc_analytics_data';
    this.sessionKey = 'amc_current_session';
    this.initializeTracking();
  }

  // Initialize tracking system
  initializeTracking() {
    // Ensure analytics data structure exists
    if (!localStorage.getItem(this.storageKey)) {
      const initialData = {
        sessions: [],
        pageViews: [],
        accessAttempts: [],
        userActions: [],
        systemEvents: []
      };
      localStorage.setItem(this.storageKey, JSON.stringify(initialData));
    }

    // Start session tracking if user is logged in
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      this.startSession(currentUser);
    }
  }

  // Get current user from auth system
  getCurrentUser() {
    const mongoUser = localStorage.getItem('currentUser');
    if (mongoUser) return JSON.parse(mongoUser);
    
    const testUser = localStorage.getItem('testUser');
    if (testUser) return JSON.parse(testUser);
    
    return null;
  }

  // Start new user session
  startSession(user) {
    const sessionId = this.generateSessionId();
    const session = {
      sessionId,
      userId: user.email,
      userLevel: user.level || this.getUserLevel(user.role),
      userName: user.name,
      startTime: new Date().toISOString(),
      endTime: null,
      pageViews: 0,
      actionsPerformed: 0,
      accessDeniedCount: 0,
      lastActivity: new Date().toISOString()
    };

    // Store current session
    localStorage.setItem(this.sessionKey, JSON.stringify(session));

    // Add to analytics data
    this.logEvent('sessions', session);
    
    console.log('AMC User Tracker: Session started for', user.name);
  }

  // End current session
  endSession() {
    const currentSession = localStorage.getItem(this.sessionKey);
    if (currentSession) {
      const session = JSON.parse(currentSession);
      session.endTime = new Date().toISOString();
      session.duration = this.calculateDuration(session.startTime, session.endTime);
      
      // Update session in analytics data
      this.updateSessionData(session);
      
      // Clear current session
      localStorage.removeItem(this.sessionKey);
      
      console.log('AMC User Tracker: Session ended');
    }
  }

  // Track page view
  trackPageView(pageName) {
    const user = this.getCurrentUser();
    if (!user) return;

    const pageView = {
      timestamp: new Date().toISOString(),
      userId: user.email,
      userLevel: user.level || this.getUserLevel(user.role),
      pageName,
      url: window.location.href,
      referrer: document.referrer,
      sessionId: this.getCurrentSessionId()
    };

    this.logEvent('pageViews', pageView);
    this.updateSessionActivity('pageView');
    
    console.log('AMC User Tracker: Page view tracked -', pageName);
  }

  // Track access attempt (successful or denied)
  trackAccessAttempt(pageName, granted, reason = null) {
    const user = this.getCurrentUser();
    if (!user) return;

    const attempt = {
      timestamp: new Date().toISOString(),
      userId: user.email,
      userLevel: user.level || this.getUserLevel(user.role),
      pageName,
      granted,
      reason,
      sessionId: this.getCurrentSessionId()
    };

    this.logEvent('accessAttempts', attempt);
    
    if (!granted) {
      this.updateSessionActivity('accessDenied');
    }
    
    console.log('AMC User Tracker: Access attempt tracked -', pageName, granted ? 'GRANTED' : 'DENIED');
  }

  // Track user action (button clicks, form submissions, etc.)
  trackUserAction(action, details = {}) {
    const user = this.getCurrentUser();
    if (!user) return;

    const userAction = {
      timestamp: new Date().toISOString(),
      userId: user.email,
      userLevel: user.level || this.getUserLevel(user.role),
      action,
      details,
      pageName: window.location.pathname.split('/').pop(),
      sessionId: this.getCurrentSessionId()
    };

    this.logEvent('userActions', userAction);
    this.updateSessionActivity('action');
    
    console.log('AMC User Tracker: User action tracked -', action);
  }

  // Track system events (logins, logouts, errors)
  trackSystemEvent(eventType, details = {}) {
    const user = this.getCurrentUser();
    
    const systemEvent = {
      timestamp: new Date().toISOString(),
      userId: user ? user.email : 'anonymous',
      userLevel: user ? (user.level || this.getUserLevel(user.role)) : 0,
      eventType,
      details,
      sessionId: this.getCurrentSessionId()
    };

    this.logEvent('systemEvents', systemEvent);
    
    console.log('AMC User Tracker: System event tracked -', eventType);
  }

  // Get analytics data (Level 3 admin only)
  getAnalyticsData() {
    const user = this.getCurrentUser();
    if (!user || (user.level !== 3 && user.role !== 'platform_admin')) {
      console.warn('AMC User Tracker: Access denied - Admin privileges required');
      return null;
    }

    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : null;
  }

  // Generate analytics report (Level 3 admin only)
  generateReport(timeRange = '7d') {
    const data = this.getAnalyticsData();
    if (!data) return null;

    const cutoffDate = this.getDateCutoff(timeRange);
    
    return {
      summary: {
        totalSessions: data.sessions.filter(s => new Date(s.startTime) >= cutoffDate).length,
        totalPageViews: data.pageViews.filter(pv => new Date(pv.timestamp) >= cutoffDate).length,
        totalAccessAttempts: data.accessAttempts.filter(aa => new Date(aa.timestamp) >= cutoffDate).length,
        totalUserActions: data.userActions.filter(ua => new Date(ua.timestamp) >= cutoffDate).length,
        uniqueUsers: [...new Set(data.sessions.filter(s => new Date(s.startTime) >= cutoffDate).map(s => s.userId))].length
      },
      userLevelBreakdown: this.getUserLevelBreakdown(data, cutoffDate),
      popularPages: this.getPopularPages(data, cutoffDate),
      accessDeniedPages: this.getAccessDeniedPages(data, cutoffDate),
      userActivity: this.getUserActivity(data, cutoffDate),
      timeRange,
      generatedAt: new Date().toISOString()
    };
  }

  // Helper methods
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getCurrentSessionId() {
    const session = localStorage.getItem(this.sessionKey);
    return session ? JSON.parse(session).sessionId : null;
  }

  getUserLevel(role) {
    const roleToLevel = {
      'media_user': 1,
      'client_user': 2,
      'client_admin': 2,
      'platform_admin': 3
    };
    return roleToLevel[role] || 1;
  }

  logEvent(category, eventData) {
    const data = JSON.parse(localStorage.getItem(this.storageKey));
    data[category].push(eventData);
    
    // Keep only last 1000 events per category to prevent storage bloat
    if (data[category].length > 1000) {
      data[category] = data[category].slice(-1000);
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  updateSessionActivity(activityType) {
    const currentSession = localStorage.getItem(this.sessionKey);
    if (currentSession) {
      const session = JSON.parse(currentSession);
      session.lastActivity = new Date().toISOString();
      
      switch(activityType) {
        case 'pageView':
          session.pageViews++;
          break;
        case 'action':
          session.actionsPerformed++;
          break;
        case 'accessDenied':
          session.accessDeniedCount++;
          break;
      }
      
      localStorage.setItem(this.sessionKey, JSON.stringify(session));
    }
  }

  updateSessionData(updatedSession) {
    const data = JSON.parse(localStorage.getItem(this.storageKey));
    const sessionIndex = data.sessions.findIndex(s => s.sessionId === updatedSession.sessionId);
    if (sessionIndex !== -1) {
      data.sessions[sessionIndex] = updatedSession;
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    }
  }

  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    return Math.round(durationMs / 1000); // Duration in seconds
  }

  getDateCutoff(timeRange) {
    const now = new Date();
    const days = parseInt(timeRange.replace('d', ''));
    return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  }

  getUserLevelBreakdown(data, cutoffDate) {
    const sessions = data.sessions.filter(s => new Date(s.startTime) >= cutoffDate);
    const breakdown = { 1: 0, 2: 0, 3: 0 };
    
    sessions.forEach(session => {
      breakdown[session.userLevel] = (breakdown[session.userLevel] || 0) + 1;
    });
    
    return {
      'Level 1 (Media Users)': breakdown[1],
      'Level 2 (Client Users)': breakdown[2],
      'Level 3 (Admin Users)': breakdown[3]
    };
  }

  getPopularPages(data, cutoffDate) {
    const pageViews = data.pageViews.filter(pv => new Date(pv.timestamp) >= cutoffDate);
    const pageCounts = {};
    
    pageViews.forEach(pv => {
      pageCounts[pv.pageName] = (pageCounts[pv.pageName] || 0) + 1;
    });
    
    return Object.entries(pageCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([page, count]) => ({ page, views: count }));
  }

  getAccessDeniedPages(data, cutoffDate) {
    const deniedAttempts = data.accessAttempts.filter(aa => 
      new Date(aa.timestamp) >= cutoffDate && !aa.granted
    );
    
    const deniedCounts = {};
    deniedAttempts.forEach(attempt => {
      deniedCounts[attempt.pageName] = (deniedCounts[attempt.pageName] || 0) + 1;
    });
    
    return Object.entries(deniedCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([page, count]) => ({ page, deniedAttempts: count }));
  }

  getUserActivity(data, cutoffDate) {
    const sessions = data.sessions.filter(s => new Date(s.startTime) >= cutoffDate);
    
    return sessions.map(session => ({
      userId: session.userId,
      userName: session.userName,
      userLevel: session.userLevel,
      startTime: session.startTime,
      duration: session.duration || 'Active',
      pageViews: session.pageViews,
      actions: session.actionsPerformed,
      accessDenied: session.accessDeniedCount
    })).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }
}

// Global user tracker instance
window.amcUserTracker = new AMCUserTracker();

// Auto-track page views
document.addEventListener('DOMContentLoaded', function() {
  const pageName = window.location.pathname.split('/').pop();
  if (pageName) {
    amcUserTracker.trackPageView(pageName);
  }
});

// Track when user leaves page
window.addEventListener('beforeunload', function() {
  amcUserTracker.endSession();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AMCUserTracker;
}