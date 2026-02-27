const express = require('express');
const path = require('path');
const { serveProtectedPage } = require('../middleware/authMiddleware');

const router = express.Router();

// Define admin pages and their required permissions
// All users except public users (media_user) can access admin pages
const adminPages = {
    'AssetDBmenu1.6.html': ['client_user', 'client_admin', 'platform_admin'], // Upload Hub
    'radar_analytics.html': ['client_user', 'client_admin', 'platform_admin'], // Analytics
    'radar_history.html': ['client_user', 'client_admin', 'platform_admin'], // History
    'manage_releases.html': ['client_user', 'client_admin', 'platform_admin'], // Release Management
    'automediavault.html': ['media_user', 'client_user', 'client_admin', 'platform_admin'] // Vault Portal
};

// Create explicit routes for each admin page to avoid path-to-regexp issues with dots
const createAdminRoute = (pageName, requiredRoles) => {
    router.get(`/${pageName}`, (req, res, next) => {
        // AUTHENTICATION COMPLETELY DISABLED - DIRECT FILE SERVING
        console.log(`🚫 AUTH DISABLED: Serving ${pageName} without any authentication checks`);
        
        // Serve the file directly without any authentication
        const filePath = path.join(__dirname, '..', '..', 'Frontend', pageName);
        res.sendFile(filePath, (sendErr) => {
            if (sendErr) {
                console.error(`Error serving admin page ${pageName}:`, sendErr);
                if (!res.headersSent) {
                    res.status(404).send(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Page Not Found - AutoMediaCenter</title>
                            <style>
                                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                .error-container { max-width: 500px; margin: 0 auto; }
                                h1 { color: #dc3545; }
                                .btn { display: inline-block; padding: 10px 20px; background: #0d6efd; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            </style>
                        </head>
                        <body>
                            <div class="error-container">
                                <h1>Page Not Found</h1>
                                <p>The requested admin page could not be found.</p>
                                <a href="automediacenter.html" class="btn">Go Home</a>
                            </div>
                        </body>
                        </html>
                    `);
                }
            }
        });
    });
};

// Create routes for each admin page
createAdminRoute('AssetDBmenu1.6.html', ['client_user', 'client_admin', 'platform_admin']);
createAdminRoute('radar_analytics.html', ['client_user', 'client_admin', 'platform_admin']);
createAdminRoute('radar_history.html', ['client_user', 'client_admin', 'platform_admin']);
createAdminRoute('manage_releases.html', ['client_user', 'client_admin', 'platform_admin']);
createAdminRoute('automediavault.html', ['media_user', 'client_user', 'client_admin', 'platform_admin']);

// Legacy route handler for any remaining admin page requests
router.get('/:pageName', (req, res, next) => {
    const pageName = req.params.pageName;
    
    // Check if the requested page is an admin page
    if (!adminPages[pageName]) {
        return next(); // Not an admin page, let other routes handle it
    }
    
    // This should redirect to access denied for admin pages that weren't caught above
    return res.redirect('/access-denied?reason=auth_required&page=' + encodeURIComponent(pageName));
});

// Route to serve actual admin content after authentication check
router.get('/admin-content/:pageName', async (req, res, next) => {
    const pageName = req.params.pageName;
    const token = req.query.token;
    
    // Verify the token is provided
    if (!token) {
        return res.redirect('/access-denied?reason=missing_token&page=' + encodeURIComponent(pageName));
    }
    
    try {
        // Verify JWT token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user to get current role
        const User = require('../models/User');
        const user = await User.findById(decoded.userId || decoded.user?.id).select('-password');
        
        if (!user) {
            return res.redirect('/access-denied?reason=invalid_user&page=' + encodeURIComponent(pageName));
        }
        
        // Check if page exists in adminPages
        if (!adminPages[pageName]) {
            return res.status(404).send('Page not found');
        }
        
        const requiredRoles = adminPages[pageName];
        
        // Check permissions - PRESERVE Level 1 (media_user) blocking
        const hasPermission = requiredRoles.some(role => {
            // Direct role matching first
            if (user.role === role) {
                return true;
            }
            
            // Legacy role mapping for backward compatibility
            switch (role) {
                case 'public':
                    return user.role === 'media_user';
                case 'client':
                    return user.role === 'client_user' || user.role === 'client_admin';
                case 'client_user':
                    return user.role === 'client_user' || user.role === 'client_admin';
                case 'client_admin':
                    return user.role === 'client_admin';
                case 'platform_admin':
                    return user.role === 'platform_admin';
                case 'admin':
                    return user.role === 'client_admin' || user.role === 'platform_admin';
                default:
                    return false;
            }
        });
        
        if (!hasPermission) {
            return res.redirect('/access-denied?reason=insufficient_permissions&page=' + encodeURIComponent(pageName) + '&role=' + encodeURIComponent(user.role));
        }
        
        // User has permission, serve the actual file
        const path = require('path');
        const filePath = path.join(__dirname, '..', '..', 'Frontend', pageName);
        res.sendFile(filePath, (sendErr) => {
            if (sendErr) {
                console.error(`Error serving admin content ${pageName}:`, sendErr);
                if (!res.headersSent) {
                    res.status(404).send(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Page Not Found - AutoMediaCenter</title>
                            <style>
                                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                                .error-container { max-width: 500px; margin: 0 auto; }
                                h1 { color: #dc3545; }
                                .btn { display: inline-block; padding: 10px 20px; background: #0d6efd; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            </style>
                        </head>
                        <body>
                            <div class="error-container">
                                <h1>Page Not Found</h1>
                                <p>The requested admin page could not be found.</p>
                                <a href="automediacenter.html" class="btn">Go Home</a>
                            </div>
                        </body>
                        </html>
                    `);
                }
            }
        });
        
    } catch (error) {
        console.error('Error in admin-content route:', error);
        return res.redirect('/access-denied?reason=server_error&page=' + encodeURIComponent(pageName));
    }
});

module.exports = router;