/**
 * AutoMediaCenter Global Sidebar Data
 * Role-based menu configuration system with enhanced features
 */

export const sidebarMenuData = {
  media_user: [
    { 
      label: "AutoMediaCenter", 
      icon: "fas fa-home", 
      page: "automediacenter.html",
      badge: null,
      description: "Latest press releases and media content"
    },
    { 
      label: "AutoMediaRadar", 
      icon: "fas fa-radar-dish", 
      page: "newradarfe.html",
      badge: "new",
      description: "Real-time automotive industry insights"
    },
    { 
      label: "AutoMediaLive", 
      icon: "fas fa-video", 
      page: "automedialive.html",
      badge: null,
      description: "Live events and streaming content"
    },
    { 
      label: "Downloads", 
      icon: "fas fa-download", 
      page: "downloads.html",
      badge: null,
      description: "Your downloaded content"
    },
    { 
      label: "Profile", 
      icon: "fas fa-user-circle", 
      page: "profile.html",
      badge: null,
      description: "Manage your account settings"
    }
  ],

  client_user: [
    { 
      label: "Dashboard", 
      icon: "fas fa-tachometer-alt", 
      page: "client-dashboard.html",
      badge: null,
      description: "Your company dashboard overview"
    },
    { 
      label: "AutoMediaCenter", 
      icon: "fas fa-home", 
      page: "automediacenter.html",
      badge: null,
      description: "Latest press releases and media content"
    },
    { 
      label: "My Releases", 
      icon: "fas fa-folder-open", 
      page: "manage_releases.html",
      badge: null,
      description: "Manage your company's releases"
    },
    { 
      label: "AutoMediaVault", 
      icon: "fas fa-vault", 
      page: "automediavault.html",
      badge: null,
      description: "Secure asset storage"
    },
    { 
      label: "AutoMediaRadar", 
      icon: "fas fa-radar-dish", 
      page: "newradarfe.html",
      badge: "new",
      description: "Industry insights and trends"
    },
    { 
      label: "Analytics", 
      icon: "fas fa-chart-line", 
      page: "company-analytics-dashboard.html",
      badge: null,
      description: "Performance metrics and insights"
    },
    { 
      label: "Profile", 
      icon: "fas fa-user-circle", 
      page: "profile.html",
      badge: null,
      description: "Manage your account settings"
    }
  ],

  client_admin: [
    { 
      label: "Dashboard", 
      icon: "fas fa-tachometer-alt", 
      page: "client-admin-dashboard.html",
      badge: null,
      description: "Admin dashboard overview"
    },
    { 
      label: "AutoMediaCenter", 
      icon: "fas fa-home", 
      page: "automediacenter.html",
      badge: null,
      description: "Latest press releases and media content"
    },
    { 
      label: "Upload Hub", 
      icon: "fas fa-upload", 
      page: "AssetDBmenu1.6.html",
      badge: null,
      description: "Upload and manage assets"
    },
    { 
      label: "My Releases", 
      icon: "fas fa-folder-open", 
      page: "manage_releases.html",
      badge: null,
      description: "Manage company releases"
    },
    { 
      label: "AutoMediaVault", 
      icon: "fas fa-vault", 
      page: "automediavault.html",
      badge: null,
      description: "Secure asset storage"
    },
    { 
      label: "Company Settings", 
      icon: "fas fa-building", 
      page: "company-settings.html",
      badge: null,
      description: "Manage company configuration"
    },
    { 
      label: "User Management", 
      icon: "fas fa-users", 
      page: "user-management.html",
      badge: null,
      description: "Manage company users"
    },
    { 
      label: "Analytics", 
      icon: "fas fa-chart-line", 
      page: "company-analytics-dashboard.html",
      badge: null,
      description: "Company performance metrics"
    },
    { 
      label: "Profile", 
      icon: "fas fa-user-circle", 
      page: "profile.html",
      badge: null,
      description: "Manage your account settings"
    }
  ],

  platform_admin: [
    { 
      label: "Platform Dashboard", 
      icon: "fas fa-tachometer-alt", 
      page: "platform-admin-dashboard.html",
      badge: null,
      description: "System-wide overview and metrics"
    },
    { 
      label: "AutoMediaCenter", 
      icon: "fas fa-home", 
      page: "automediacenter.html",
      badge: null,
      description: "Latest press releases and media content"
    },
    { 
      label: "AutoMediaRadar", 
      icon: "fas fa-radar-dish", 
      page: "radar_history_enterprise.html",
      badge: "new",
      description: "Industry insights and radar history"
    },
    { 
      label: "AutoMediaLive", 
      icon: "fas fa-video", 
      page: "automedialive.html",
      badge: null,
      description: "Live events management"
    },
    { 
      label: "AutoMediaVault", 
      icon: "fas fa-vault", 
      page: "automediavault.html",
      badge: null,
      description: "System-wide asset management"
    },
    { divider: true },
    { 
      label: "Company Management", 
      icon: "fas fa-building", 
      page: "platform-admin-dashboard.html",
      badge: null,
      description: "Manage all companies on the platform"
    },
    { 
      label: "Invite Management", 
      icon: "fas fa-envelope", 
      page: "admin_invite_manager.html",
      badge: null,
      description: "Manage user invitations"
    },
    { 
      label: "Mail Logs", 
      icon: "fas fa-database", 
      page: "mail_log_viewer.html",
      badge: null,
      description: "View system email logs"
    },
    { 
      label: "System Analytics", 
      icon: "fas fa-chart-bar", 
      page: "platform-analytics.html",
      badge: null,
      description: "Platform-wide analytics"
    },
    { divider: true },
    { 
      label: "Security", 
      icon: "fas fa-shield-alt", 
      page: "platform-security.html",
      badge: "alert",
      description: "Security monitoring and settings"
    },
    { 
      label: "Settings", 
      icon: "fas fa-cogs", 
      page: "admin_settings.html",
      badge: null,
      description: "Platform configuration"
    },
    { 
      label: "Profile", 
      icon: "fas fa-user-circle", 
      page: "profile.html",
      badge: null,
      description: "Manage your account settings"
    }
  ]
};

// Role display names for UI
export const roleLabels = {
  media_user: 'Media User',
  client_user: 'Client User', 
  client_admin: 'Client Admin',
  platform_admin: 'Platform Admin'
};

// Badge configuration
export const badgeConfig = {
  new: { color: '#10b981', text: 'NEW' },
  alert: { color: '#ef4444', text: '!' },
  beta: { color: '#f59e0b', text: 'β' },
  hot: { color: '#f97316', text: '🔥' }
};

// Helper function to get menu items for a specific role
export function getMenuForRole(role) {
  return sidebarMenuData[role] || [];
}

// Helper function to check if user has access to a specific page
export function hasPageAccess(userRole, targetPage) {
  const menuItems = getMenuForRole(userRole);
  return menuItems.some(item => item.page === targetPage);
}