# AutoMediaCenter Authentication Integration Guide

## Overview

This guide shows you how to integrate the MongoDB-based three-level authentication system with your existing AutoMediaCenter platform while preserving your current test account and data.

## 🏗️ Architecture

### Three Authentication Levels

1. **Level 1 - Public User** (`media_user` role)
   - Access: Public pages only (AutoMediaRadar, AutoMediaCenter)
   - Cannot upload or manage content

2. **Level 2 - Client User** (`client_user` / `client_admin` roles)
   - Access: Public pages + Upload dashboard + Management tools
   - Associated with a specific client company
   - Your existing `test@example.com` account will be this level

3. **Level 3 - Platform Admin** (`platform_admin` role)
   - Access: Everything + User management + System settings
   - Full platform control

## 📁 Files Created

### Backend Files

1. **`../Backend/routes/authTestRoutes.js`**
   - Authentication testing API endpoints
   - User permission checking
   - Page access validation
   - Action simulation

2. **`../Backend/setup-test-auth.js`**
   - Database setup script
   - Creates test users and clients
   - Preserves your existing `test@example.com` account
   - Updates your account to `client_user` role

### Frontend Files

3. **`login-test-mongodb.html`**
   - MongoDB-integrated authentication test portal
   - Real backend authentication
   - Permission testing interface
   - Preserves your existing account (highlighted in gold)

## 🚀 Setup Instructions

### Step 1: Update Your Backend Server

Add the authentication test routes to your main server file (usually `server.js` or `app.js`):

```javascript
// Add this line with your other route imports
const authTestRoutes = require('./routes/authTestRoutes');

// Add this line with your other route registrations
app.use('/api/v1/auth-test', authTestRoutes);
```

### Step 2: Run Database Setup

Execute the setup script to create test users and clients:

```bash
cd Backend
node setup-test-auth.js
```

This will:
- Create test client companies
- Preserve your existing `test@example.com` account
- Update your account to `client_user` role with Test Client Corp
- Create additional test users for each authentication level

### Step 3: Test the Integration

1. Make sure your backend server is running on `http://localhost:5000`
2. Open `login-test-mongodb.html` in your browser
3. Test each authentication level:
   - **Your Account**: `test@example.com` / `password123` (your existing data preserved)
   - **Public User**: `public@test.com` / `password123`
   - **Client Admin**: `clientadmin@test.com` / `password123`
   - **Platform Admin**: `admin@test.com` / `password123`

## 🔧 Integration with Existing Pages

### Adding Authentication to Your Pages

To protect your existing pages, add authentication checks:

```javascript
// Add to the top of protected pages (AssetDBmenu1.6.html, manage_releases.html, etc.)
const authToken = localStorage.getItem('authToken');
if (!authToken) {
    // Redirect to login or show login modal
    window.location.href = 'login-test-mongodb.html';
}

// Verify token is still valid
fetch('/api/v1/auth-test/user-info', {
    headers: { 'Authorization': `Bearer ${authToken}` }
})
.then(response => response.json())
.then(data => {
    if (!data.success) {
        localStorage.removeItem('authToken');
        window.location.href = 'login-test-mongodb.html';
    }
    // User is authenticated, proceed with page functionality
})
.catch(error => {
    console.error('Auth check failed:', error);
    window.location.href = 'login-test-mongodb.html';
});
```

### Page-Level Permission Checks

```javascript
// Check if user can access specific functionality
async function checkPageAccess(pageName) {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return false;
    
    try {
        const response = await fetch(`/api/v1/auth-test/page-access/${pageName}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        return data.success && data.data.hasAccess;
    } catch (error) {
        console.error('Permission check failed:', error);
        return false;
    }
}

// Usage example
if (await checkPageAccess('AssetDBmenu1.6.html')) {
    // Show upload functionality
} else {
    // Hide or disable upload functionality
}
```

## 🔐 API Endpoints

### Authentication Test Endpoints

- `GET /api/v1/auth-test/user-info` - Get current user information and permissions
- `GET /api/v1/auth-test/page-access/:page` - Check access to specific page
- `POST /api/v1/auth-test/simulate-action` - Test user action permissions
- `GET /api/v1/auth-test/available-pages` - Get list of pages available to user

### Existing Authentication Endpoints

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration (admin only)

## 📊 User Roles and Permissions

### Database Schema

```javascript
// User Model
{
    email: String,
    password: String (hashed),
    name: String,
    role: ['client_user', 'client_admin', 'platform_admin', 'media_user'],
    clientId: ObjectId (ref: 'Client') // null for platform_admin and media_user
}

// Client Model
{
    clientName: String,
    contactPerson: String,
    contactEmail: String,
    isActive: Boolean
}
```

### Permission Matrix

| Feature | Public User | Client User | Client Admin | Platform Admin |
|---------|-------------|-------------|--------------|----------------|
| View public pages | ✅ | ✅ | ✅ | ✅ |
| Upload releases | ❌ | ✅ | ✅ | ✅ |
| Manage own releases | ❌ | ✅ | ✅ | ✅ |
| Delete own releases | ❌ | ❌ | ✅ | ✅ |
| View analytics | ❌ | ✅ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ❌ | ✅ |
| Delete any content | ❌ | ❌ | ❌ | ✅ |

## 🧪 Testing Scenarios

### Test Cases to Verify

1. **Your Existing Account**
   - Login with `test@example.com`
   - Verify all your existing releases are still accessible
   - Confirm upload dashboard works
   - Check client association (Test Client Corp)

2. **Public User Restrictions**
   - Login with `public@test.com`
   - Try to access upload dashboard (should be denied)
   - Verify public pages are accessible

3. **Client Admin Permissions**
   - Login with `clientadmin@test.com`
   - Test upload functionality
   - Try admin functions (should be denied)

4. **Platform Admin Access**
   - Login with `admin@test.com`
   - Verify access to all functionality
   - Test user management capabilities

## 🔄 Migration Strategy

### Phase 1: Testing (Current)
- Use `login-test-mongodb.html` to validate authentication
- Test all permission levels
- Verify your existing data is preserved

### Phase 2: Integration
- Add authentication checks to existing pages
- Implement permission-based UI hiding/showing
- Add logout functionality to all pages

### Phase 3: Production
- Replace mock authentication with real MongoDB authentication
- Add user registration flow for new clients
- Implement session management across all pages

## 🛡️ Security Considerations

### JWT Token Management
- Tokens expire after 8 hours
- Store tokens in localStorage (consider httpOnly cookies for production)
- Validate tokens on every protected request

### Password Security
- Passwords are hashed with bcrypt (10 rounds)
- Minimum 6 characters required
- Consider adding password complexity requirements

### Client Isolation
- Client users can only see their own releases
- Client ID is embedded in JWT token
- Database queries filter by clientId automatically

## 🚨 Important Notes

### Your Existing Data
- ✅ Your `test@example.com` account is preserved
- ✅ All your existing releases remain accessible
- ✅ Account is upgraded to `client_user` role
- ✅ Associated with "Test Client Corp" client

### Database Changes
- User role enum updated to new values
- Client association added to user model
- No existing data is deleted or modified

### Backward Compatibility
- Existing API endpoints continue to work
- New authentication is additive, not replacing
- Can run both systems in parallel during testing

## 📞 Support

If you encounter any issues:

1. Check backend server is running on port 5000
2. Verify MongoDB connection is working
3. Run the setup script if test users are missing
4. Check browser console for authentication errors
5. Use the test portal to debug permission issues

## 🎯 Next Steps

1. Run the setup script: `node ../Backend/setup-test-auth.js`
2. Add auth test routes to your server
3. Test with `login-test-mongodb.html`
4. Gradually integrate authentication into existing pages
5. Plan production deployment strategy

Your existing workflow and data are completely preserved while adding the new authentication system!