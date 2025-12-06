const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserCompanyPermissions = require('../models/UserCompanyPermissions');

// Authentication middleware - verifies JWT token
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Access token is required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Access token is required'
            });
        }

        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find the user in the database - fix JWT payload structure
        const userId = decoded.user?.id || decoded.userId || decoded.id;
        const user = await User.findById(userId).select('-password').populate('clientId', 'name contactEmail status billingStatus');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid access token'
            });
        }

        // 🚨 CRITICAL SECURITY CHECK: Validate user is still active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'User account has been deactivated',
                action: 'redirect_login'
            });
        }

        // 🚨 CRITICAL SECURITY CHECK: For company users, validate company status
        if (['client_user', 'client_admin'].includes(user.role) && user.clientId) {
            if (!user.clientId.canOperate || user.clientId.status !== 'active') {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden',
                    message: `Company is ${user.clientId.status} and cannot access the system`,
                    companyStatus: user.clientId.status,
                    action: 'contact_admin'
                });
            }
        }

        // Attach client permissions if client_user or client_admin
        if (['client_user', 'client_admin'].includes(user.role)) {
            const clientPermissions = await UserCompanyPermissions.find({
                userId: user._id,
                isActive: true
            }).populate('clientId', 'name contactEmail');
            
            user.clientPermissions = clientPermissions.map(permission => ({
                clientId: permission.clientId._id,
                clientName: permission.clientId.name,
                role: permission.role,
                permissions: permission.permissions
            }));
        }

        // Add user to request object
        req.user = user;
        next();
        
    } catch (error) {
        console.error('Authentication error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid access token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Access token has expired'
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'ServerError',
            message: 'Authentication failed'
        });
    }
};

// Authorization middleware - checks user roles/permissions
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        // Check if user has any of the allowed roles
        const hasPermission = allowedRoles.some(role => {
            // Direct role matching first
            if (req.user.role === role) {
                return true;
            }
            
            // Legacy role mapping for backward compatibility
            switch (role) {
                case 'public':
                    return req.user.role === 'media_user';
                case 'client':
                    return req.user.role === 'client_user' || req.user.role === 'client_admin';
                case 'client_user':
                    return req.user.role === 'client_user' || req.user.role === 'client_admin';
                case 'client_admin':
                    return req.user.role === 'client_admin';
                case 'platform_admin':
                    return req.user.role === 'platform_admin';
                case 'admin':
                    return req.user.role === 'client_admin' || req.user.role === 'platform_admin';
                default:
                    return false;
            }
        });

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                message: 'Insufficient permissions to access this resource',
                requiredRoles: allowedRoles,
                userRole: req.user.role
            });
        }

        next();
    };
};

// Middleware to serve protected HTML pages
const serveProtectedPage = (pagePath, requiredRoles = []) => {
    return async (req, res, next) => {
        try {
            let user = null;

            // For browser requests, we need to check if there's a way to get the token
            // Since browsers don't automatically send Authorization headers for page requests,
            // we'll serve an intermediate page that checks localStorage and makes the decision
            
            // If no roles required, allow access
            if (requiredRoles.length === 0) {
                return next();
            }

            // For admin pages, serve an authentication check page that will:
            // 1. Check localStorage for auth tokens
            // 2. Validate the token with the server
            // 3. Either redirect to access denied or load the actual page content
            
            const authCheckPage = generateAuthCheckPage(pagePath, requiredRoles);
            return res.status(200).send(authCheckPage);
            
        } catch (error) {
            console.error('Error in serveProtectedPage middleware:', error);
            return res.status(500).send(generateAccessDeniedPage('Server Error', 'An error occurred while checking your permissions.'));
        }
    };
};

// Generate an authentication check page that validates client-side tokens
const generateAuthCheckPage = (pagePath, requiredRoles) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading... - AutoMediaCenter</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f8f9fa;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .loading-container {
            text-align: center;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #0d6efd;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .loading-text {
            color: #6c757d;
            font-size: 1.1rem;
        }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="spinner"></div>
        <div class="loading-text">Verifying access permissions...</div>
    </div>

    <script>
        (async function() {
            try {
                // Get token from localStorage (both old and new systems)
                const token = localStorage.getItem('token') || localStorage.getItem('authToken');
                
                if (!token) {
                    // No token found, redirect to login
                    window.location.href = '/access-denied?reason=auth_required&page=${encodeURIComponent(pagePath)}';
                    return;
                }

                // Validate token with server
                const response = await fetch('/api/v1/auth-test/validate-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    }
                });

                if (!response.ok) {
                    // Token invalid, redirect to login
                    localStorage.removeItem('token');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userEmail');
                    localStorage.removeItem('currentUser');
                    window.location.href = '/access-denied?reason=invalid_token&page=${encodeURIComponent(pagePath)}';
                    return;
                }

                const userData = await response.json();
                
                if (!userData.success || !userData.data) {
                    window.location.href = '/access-denied?reason=invalid_user&page=${encodeURIComponent(pagePath)}';
                    return;
                }

                const user = userData.data;
                const requiredRoles = ${JSON.stringify(requiredRoles)};
                
                // Check if user has required permissions
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
                    window.location.href = '/access-denied?reason=insufficient_permissions&page=${encodeURIComponent(pagePath)}&role=' + encodeURIComponent(user.role);
                    return;
                }

                // User has permission, load the actual page content
                window.location.href = '/admin-content/${pagePath}?token=' + encodeURIComponent(token);
                
            } catch (error) {
                console.error('Authentication check failed:', error);
                window.location.href = '/access-denied?reason=server_error&page=${encodeURIComponent(pagePath)}';
            }
        })();
    </script>
</body>
</html>`;
};

// Generate professional access denied HTML page
const generateAccessDeniedPage = (title, message) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - AutoMediaCenter</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #f8f9fa;
            --bg-secondary: #ffffff;
            --text-primary: #212529;
            --text-secondary: #6c757d;
            --accent-primary: #0d6efd;
            --accent-danger: #dc3545;
            --border-primary: #dee2e6;
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .access-denied-container {
            background-color: var(--bg-secondary);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            padding: 3rem 2rem;
            text-align: center;
            max-width: 500px;
            width: 90%;
            border: 1px solid var(--border-primary);
        }
        
        .access-denied-icon {
            font-size: 4rem;
            color: var(--accent-danger);
            margin-bottom: 1.5rem;
        }
        
        .access-denied-title {
            font-size: 2rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 1rem;
        }
        
        .access-denied-message {
            font-size: 1.1rem;
            color: var(--text-secondary);
            margin-bottom: 2rem;
            line-height: 1.5;
        }
        
        .access-denied-actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .btn-primary {
            background-color: var(--accent-primary);
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #0b5ed7;
            transform: translateY(-1px);
        }
        
        .btn-secondary {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            border: 1px solid var(--border-primary);
        }
        
        .btn-secondary:hover {
            background-color: #e9ecef;
            transform: translateY(-1px);
        }
        
        .footer-text {
            margin-top: 2rem;
            font-size: 0.9rem;
            color: var(--text-secondary);
        }
        
        @media (max-width: 480px) {
            .access-denied-container {
                padding: 2rem 1.5rem;
            }
            
            .access-denied-title {
                font-size: 1.5rem;
            }
            
            .access-denied-actions {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="access-denied-container">
        <div class="access-denied-icon">
            <i class="fas fa-shield-alt"></i>
        </div>
        <h1 class="access-denied-title">${title}</h1>
        <p class="access-denied-message">${message}</p>
        <div class="access-denied-actions">
            <a href="login-test-mongodb.html" class="btn btn-primary">
                <i class="fas fa-sign-in-alt"></i>
                Sign In
            </a>
            <a href="automediacenter.html" class="btn btn-secondary">
                <i class="fas fa-home"></i>
                Go Home
            </a>
        </div>
        <p class="footer-text">
            If you believe this is an error, please contact your administrator.
        </p>
    </div>
</body>
</html>`;
};

module.exports = {
    authenticate,
    authorize,
    serveProtectedPage,
    generateAccessDeniedPage
};