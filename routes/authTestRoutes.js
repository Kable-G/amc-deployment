// routes/authTestRoutes.js
// Authentication testing routes for the login test portal

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Client = require('../models/Client');

// GET /api/v1/auth-test/user-info - Get current user information
router.get('/user-info', auth, async (req, res) => {
    try {
        console.log('Auth Test: Getting user info for:', req.user.id);
        
        // Fetch full user details with client information
        const user = await User.findById(req.user.id)
            .populate('clientId', 'clientName contactEmail isActive')
            .select('-password');
            
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Determine user level based on role
        let userLevel = 1; // Default: Public User
        if (user.role === 'client_user' || user.role === 'client_admin') {
            userLevel = 2; // Client User
        } else if (user.role === 'platform_admin') {
            userLevel = 3; // Admin User
        }

        res.json({
            success: true,
            data: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                userLevel: userLevel,
                client: user.clientId ? {
                    id: user.clientId._id,
                    name: user.clientId.clientName,
                    email: user.clientId.contactEmail,
                    isActive: user.clientId.isActive
                } : null,
                permissions: {
                    canAccessPublic: true,
                    canAccessUploadDashboard: userLevel >= 2,
                    canAccessManagement: userLevel >= 2,
                    canAccessAdmin: userLevel >= 3,
                    canModifyUsers: userLevel >= 3,
                    canDeleteContent: userLevel >= 3
                }
            }
        });

    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error while fetching user information' 
        });
    }
});

// GET /api/v1/auth-test/page-access/:page - Check if user can access specific page
router.get('/page-access/:page', auth, async (req, res) => {
    try {
        const pageName = req.params.page;
        const userRole = req.user.role;
        
        // Define page access rules
        const pageAccessRules = {
            // Level 1: Public pages (everyone can access)
            'newradarfe.html': ['client_user', 'client_admin', 'platform_admin', 'media_user'],
            'automediacenter.html': ['client_user', 'client_admin', 'platform_admin', 'media_user'],
            'amc-release-detail.html': ['client_user', 'client_admin', 'platform_admin', 'media_user'],
            
            // Level 2: Client pages (client users and above)
            'AssetDBmenu1.6.html': ['client_user', 'client_admin', 'platform_admin'],
            'manage_releases.html': ['client_user', 'client_admin', 'platform_admin'],
            'radar_history.html': ['client_user', 'client_admin', 'platform_admin'],
            'radar_analytics.html': ['client_user', 'client_admin', 'platform_admin'],
            'amc-release-success.html': ['client_user', 'client_admin', 'platform_admin'],
            
            // Level 3: Admin pages (platform admin only)
            'admin-dashboard.html': ['platform_admin'],
            'user-management.html': ['platform_admin'],
            'system-settings.html': ['platform_admin']
        };

        const allowedRoles = pageAccessRules[pageName] || [];
        const hasAccess = allowedRoles.includes(userRole);
        
        // Additional check for client users - must have active client
        if ((userRole === 'client_user' || userRole === 'client_admin') && hasAccess) {
            if (!req.user.clientId) {
                return res.json({
                    success: true,
                    data: {
                        hasAccess: false,
                        reason: 'User not associated with a client',
                        userRole: userRole,
                        pageName: pageName
                    }
                });
            }
        }

        res.json({
            success: true,
            data: {
                hasAccess: hasAccess,
                reason: hasAccess ? 'Access granted' : 'Insufficient permissions',
                userRole: userRole,
                pageName: pageName,
                requiredRoles: allowedRoles
            }
        });

    } catch (error) {
        console.error('Error checking page access:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error while checking page access' 
        });
    }
});

// POST /api/v1/auth-test/simulate-action - Simulate user actions for testing
router.post('/simulate-action', auth, async (req, res) => {
    try {
        const { action, target } = req.body;
        const userRole = req.user.role;
        
        // Define action permissions
        const actionPermissions = {
            'upload_release': ['client_user', 'client_admin', 'platform_admin'],
            'edit_release': ['client_user', 'client_admin', 'platform_admin'],
            'delete_release': ['client_admin', 'platform_admin'],
            'manage_users': ['platform_admin'],
            'view_analytics': ['client_admin', 'platform_admin'],
            'system_settings': ['platform_admin']
        };

        const allowedRoles = actionPermissions[action] || [];
        const canPerform = allowedRoles.includes(userRole);
        
        // Log the action attempt
        console.log(`Auth Test: User ${req.user.id} (${userRole}) attempted action: ${action} on ${target}`);
        
        res.json({
            success: true,
            data: {
                action: action,
                target: target,
                canPerform: canPerform,
                userRole: userRole,
                message: canPerform ? 
                    `Action '${action}' would be allowed` : 
                    `Action '${action}' is not permitted for role '${userRole}'`,
                requiredRoles: allowedRoles
            }
        });

    } catch (error) {
        console.error('Error simulating action:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error while simulating action' 
        });
    }
});

// GET /api/v1/auth-test/available-pages - Get list of pages available to current user
router.get('/available-pages', auth, async (req, res) => {
    try {
        const userRole = req.user.role;
        
        // Define all pages with their access levels and descriptions
        const allPages = [
            // Level 1: Public Pages
            {
                name: 'newradarfe.html',
                title: 'AutoMediaRadar',
                description: 'Public radar feed with media releases',
                level: 1,
                category: 'Public',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin', 'media_user']
            },
            {
                name: 'automediacenter.html',
                title: 'AutoMediaCenter',
                description: 'Public media center with press releases',
                level: 1,
                category: 'Public',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin', 'media_user']
            },
            {
                name: 'amc-release-detail.html',
                title: 'Release Details',
                description: 'Detailed view of individual releases',
                level: 1,
                category: 'Public',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin', 'media_user']
            },
            
            // Level 2: Client Pages
            {
                name: 'AssetDBmenu1.6.html',
                title: 'Upload Dashboard',
                description: 'Upload and manage media releases',
                level: 2,
                category: 'Client Tools',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin']
            },
            {
                name: 'manage_releases.html',
                title: 'Manage Releases',
                description: 'View and edit your releases',
                level: 2,
                category: 'Client Tools',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin']
            },
            {
                name: 'radar_history.html',
                title: 'Radar History',
                description: 'View radar alert history and archives',
                level: 2,
                category: 'Client Tools',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin']
            },
            {
                name: 'radar_analytics.html',
                title: 'Radar Analytics',
                description: 'Analytics dashboard for radar alerts',
                level: 2,
                category: 'Client Tools',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin']
            },
            {
                name: 'amc-release-success.html',
                title: 'Release Success',
                description: 'Confirmation page after successful upload',
                level: 2,
                category: 'Client Tools',
                allowedRoles: ['client_user', 'client_admin', 'platform_admin']
            },
            
            // Level 3: Admin Pages
            {
                name: 'admin-dashboard.html',
                title: 'Admin Dashboard',
                description: 'Platform administration overview',
                level: 3,
                category: 'Administration',
                allowedRoles: ['platform_admin']
            },
            {
                name: 'user-management.html',
                title: 'User Management',
                description: 'Manage users and permissions',
                level: 3,
                category: 'Administration',
                allowedRoles: ['platform_admin']
            },
            {
                name: 'system-settings.html',
                title: 'System Settings',
                description: 'Configure platform settings',
                level: 3,
                category: 'Administration',
                allowedRoles: ['platform_admin']
            }
        ];

        // Filter pages based on user role
        const availablePages = allPages.filter(page => 
            page.allowedRoles.includes(userRole)
        );

        // Additional check for client users
        if ((userRole === 'client_user' || userRole === 'client_admin') && !req.user.clientId) {
            // If client user has no clientId, only allow public pages
            const publicPages = availablePages.filter(page => page.level === 1);
            return res.json({
                success: true,
                data: {
                    pages: publicPages,
                    totalPages: publicPages.length,
                    userRole: userRole,
                    warning: 'Limited access: User not associated with a client'
                }
            });
        }

        res.json({
            success: true,
            data: {
                pages: availablePages,
                totalPages: availablePages.length,
                userRole: userRole,
                clientId: req.user.clientId || null
            }
        });

    } catch (error) {
        console.error('Error fetching available pages:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error while fetching available pages' 
        });
    }
});

// POST /api/v1/auth-test/validate-token - Validate token for admin page access
router.post('/validate-token', auth, async (req, res) => {
    try {
        // If we reach here, the auth middleware has already validated the token
        // and attached the user to req.user
        const user = await User.findById(req.user.id)
            .populate('clientId', 'clientName contactEmail isActive')
            .select('-password');
            
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'UserNotFound',
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                client: user.clientId ? {
                    id: user.clientId._id,
                    name: user.clientId.clientName,
                    email: user.clientId.contactEmail,
                    isActive: user.clientId.isActive
                } : null
            }
        });
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({
            success: false,
            error: 'ServerError',
            message: 'Token validation failed'
        });
    }
});

// GET /api/v1/auth/validate-permissions - Validate user permissions (for frontend auth check)
router.get('/validate-permissions', auth, async (req, res) => {
    try {
        // If we reach here, the auth middleware has already validated the token
        const user = await User.findById(req.user.id)
            .populate('clientId', 'clientName contactEmail isActive')
            .select('-password');
            
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Determine user level based on role
        let userLevel = 1; // Default: Public User
        if (user.role === 'client_user' || user.role === 'client_admin') {
            userLevel = 2; // Client User
        } else if (user.role === 'platform_admin') {
            userLevel = 3; // Admin User
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                level: userLevel,
                userLevel: userLevel,
                client: user.clientId ? {
                    id: user.clientId._id,
                    name: user.clientId.clientName,
                    email: user.clientId.contactEmail,
                    isActive: user.clientId.isActive
                } : null,
                permissions: {
                    canAccessPublic: true,
                    canAccessUploadDashboard: userLevel >= 2,
                    canAccessManagement: userLevel >= 2,
                    canAccessAdmin: userLevel >= 3
                }
            }
        });
    } catch (error) {
        console.error('Permission validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while validating permissions'
        });
    }
});

module.exports = router;