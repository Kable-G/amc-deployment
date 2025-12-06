/**
 * Simple Authentication Protection for AutoMediaCenter
 * Checks user level and shows access denied modal for insufficient permissions
 */

// Simple function to check if user is logged in
function isLoggedIn() {
  const mongoUser = localStorage.getItem('currentUser');
  const testUser = localStorage.getItem('testUser');
  return mongoUser || testUser;
}

// Simple function to get current user
function getCurrentUser() {
  const mongoUser = localStorage.getItem('currentUser');
  if (mongoUser) {
    return JSON.parse(mongoUser);
  }
  
  const testUser = localStorage.getItem('testUser');
  if (testUser) {
    return JSON.parse(testUser);
  }
  
  return null;
}

// Get user level
function getUserLevel() {
  const user = getCurrentUser();
  if (!user) return 0;
  
  // Handle different user formats
  if (user.level) return user.level; // From login-test.html
  if (user.role) {
    // Convert role to level
    const roleToLevel = {
      'media_user': 1,
      'client_user': 2,
      'client_admin': 2,
      'platform_admin': 3
    };
    return roleToLevel[user.role] || 1;
  }
  
  return 1; // Default to level 1
}

// Check if user has required level for current page
function hasRequiredLevel() {
  const currentPage = window.location.pathname.split('/').pop();
  const userLevel = getUserLevel();
  
  // HARDWIRED ACCESS CONTROL - Complete Protocol
  const pageRequirements = {
    // Level 1+ (Media User - Public Access Only)
    'automediacenter.html': 1,
    'newradarfe.html': 1,
    'amc-release-detail.html': 1,
    
    // Level 2+ (Client User, Client Admin, Platform Admin ONLY)
    'AssetDBmenu1.6.html': 2,        // Upload Dashboard
    'amc-analytics.html': 2,         // AutoMediaCenter Analytics
    'manage_releases.html': 2,       // Manage Releases
    'radar_analytics.html': 2,       // Radar Analytics
    'radar_history.html': 2,         // Radar History
    
    // Level 3+ (Platform Admin ONLY)
    'admin-dashboard.html': 3,       // Admin Dashboard
    'admin-user-analytics.html': 3,  // User Analytics Dashboard
    'user-management.html': 3,       // User Management
    'system-settings.html': 3        // System Settings
  };
  
  const requiredLevel = pageRequirements[currentPage];
  if (!requiredLevel) return true; // Page not restricted
  
  return userLevel >= requiredLevel;
}

// Professional access denied modal with AutoMediaCenter styling
function showAccessDenied() {
  const user = getCurrentUser();
  const userLevel = getUserLevel();
  
  const modalHTML = `
    <div id="accessDeniedModal" style="
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center;
      z-index: 10000; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="
        background: white; padding: 50px 40px; border-radius: 16px; text-align: center;
        max-width: 520px; width: 90%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 3px rgba(0,123,255,0.15);
        border: 2px solid rgba(0,123,255,0.1);
        position: relative;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform: translateY(0);
      "
      onmouseover="this.style.transform='translateY(-8px)'; this.style.boxShadow='0 25px 80px rgba(0,0,0,0.4), 0 0 0 3px rgba(0,123,255,0.25)'"
      onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 20px 60px rgba(0,0,0,0.3), 0 0 0 3px rgba(0,123,255,0.15)'">
        <!-- Professional Shield Icon (Half Red) -->
        <div style="margin-bottom: 30px;">
          <svg width="80" height="80" viewBox="0 0 24 24" style="margin: 0 auto; display: block;">
            <defs>
              <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="50%" style="stop-color:#dc3545;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#6c757d;stop-opacity:1" />
              </linearGradient>
            </defs>
            <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5C15.4,11.5 16,12.4 16,13V16C16,17.4 15.4,18 14.8,18H9.2C8.6,18 8,17.4 8,16V13C8,12.4 8.6,11.5 9.2,11.5V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,10V11.5H13.5V10C13.5,8.7 12.8,8.2 12,8.2Z"
                  fill="url(#shieldGradient)" />
          </svg>
        </div>
        
        <h2 style="
          color: #212529; font-size: 28px; font-weight: 600; margin-bottom: 20px;
          letter-spacing: -0.5px;
        ">Access Denied</h2>
        
        <p style="
          color: #495057; font-size: 16px; line-height: 1.5; margin-bottom: 35px;
          font-weight: 400;
        ">Your account is not authorized to perform this action.</p>
        
        <button onclick="returnToMainMenu()" style="
          background: #007bff; color: white; border: none;
          padding: 14px 32px; border-radius: 8px; cursor: pointer;
          font-size: 16px; font-weight: 600; font-family: inherit;
          transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,123,255,0.3);
          display: inline-flex; align-items: center; gap: 8px;
        " onmouseover="this.style.background='#0056b3'; this.style.transform='translateY(-1px)'"
           onmouseout="this.style.background='#007bff'; this.style.transform='translateY(0)'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" />
          </svg>
          Go to AutoMediaCenter
        </button>
        
        <hr style="
          border: none; height: 1px; background: #e9ecef;
          margin: 30px 0 20px 0;
        ">
        
        <p style="
          color: #6c757d; font-size: 14px; line-height: 1.4; margin: 0;
          font-weight: 400;
        ">If you believe this is an error, please contact the AutoMediaCenter administrator.</p>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Return to main menu
function returnToMainMenu() {
  window.location.href = 'automediacenter.html';
}

// Go to login
function goToLogin() {
  window.location.href = 'login-test.html';
}

// Protection check with level verification
function protectPage() {
  const currentPage = window.location.pathname.split('/').pop();
  
  if (!isLoggedIn()) {
    // Track access attempt by non-logged-in user
    if (window.amcUserTracker) {
      window.amcUserTracker.trackSystemEvent('access_denied_not_logged_in', { page: currentPage });
    }
    showAccessDenied();
    return false;
  }
  
  if (!hasRequiredLevel()) {
    // Track access attempt by insufficient level user
    if (window.amcUserTracker) {
      const user = getCurrentUser();
      const userLevel = getUserLevel();
      window.amcUserTracker.trackAccessAttempt(currentPage, false, `Insufficient level: ${userLevel}`);
    }
    showAccessDenied();
    return false;
  }
  
  // Track successful access
  if (window.amcUserTracker) {
    window.amcUserTracker.trackAccessAttempt(currentPage, true, 'Access granted');
  }
  
  return true;
}

// Auto-run protection when page loads
document.addEventListener('DOMContentLoaded', function() {
  protectPage();
});