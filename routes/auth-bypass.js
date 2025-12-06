// routes/auth-bypass.js - Fake authentication routes that always return success
// This allows frontend to work without real authentication

const express = require('express');
const router = express.Router();

// Fake login route - always returns success
router.post('/login', async (req, res) => {
  console.log("FAKE AUTH: Login request received - returning fake success");
  
  // Return a fake successful login response
  res.json({
    success: true,
    message: 'Login successful (fake auth)',
    token: 'fake-jwt-token-for-frontend',
    user: {
      id: '507f1f77bcf86cd799439011', // Valid 24-character hex ObjectId
      email: req.body.email || 'fake@example.com',
      name: 'Fake User',
      role: 'platform_admin', // Give admin role so all pages are accessible
      clientId: '507f1f77bcf86cd799439012' // Valid 24-character hex ObjectId
    }
  });
});

// Fake register route - always returns success
router.post('/register', async (req, res) => {
  console.log("FAKE AUTH: Register request received - returning fake success");
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully (fake auth)',
    user: {
      id: '507f1f77bcf86cd799439011', // Valid 24-character hex ObjectId
      email: req.body.email || 'fake@example.com',
      name: req.body.name || 'Fake User',
      role: req.body.role || 'platform_admin',
      clientId: req.body.clientId || '507f1f77bcf86cd799439012' // Valid 24-character hex ObjectId
    }
  });
});

// Fake validate-permissions route - always returns admin permissions
router.get('/validate-permissions', (req, res) => {
  console.log("FAKE AUTH: Validate permissions request - returning fake admin permissions");
  
  res.json({
    success: true,
    user: {
      id: '507f1f77bcf86cd799439011', // Valid 24-character hex ObjectId
      email: 'fake@example.com',
      name: 'Fake User',
      role: 'platform_admin',
      level: 3,
      userLevel: 3,
      client: null,
      permissions: {
        canAccessPublic: true,
        canAccessUploadDashboard: true,
        canAccessManagement: true,
        canAccessAdmin: true
      }
    }
  });
});

module.exports = router;