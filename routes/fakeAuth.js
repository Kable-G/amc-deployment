// routes/fakeAuth.js - Fake authentication routes that always return success
// NO REAL AUTHENTICATION - EVERYONE GETS ACCESS

const express = require('express');
const router = express.Router();

// Fake login route - always returns success
router.post('/login', async (req, res) => {
  console.log('🚫 FAKE AUTH: Login attempt - ALWAYS SUCCEEDS');
  console.log('Email:', req.body.email);
  
  // Always return success with fake user data
  const fakeUser = {
    id: '507f1f77bcf86cd799439011',
    email: req.body.email || 'fake@user.com',
    name: 'Fake User',
    role: 'client_admin', // Always give admin access
    clientId: '507f1f77bcf86cd799439012'
  };

  const fakeToken = 'fake-jwt-token-no-real-auth';

  res.json({
    success: true,
    message: 'Fake login successful - NO REAL AUTHENTICATION',
    token: fakeToken,
    user: fakeUser
  });
});

// Fake register route - always returns success
router.post('/register', async (req, res) => {
  console.log('🚫 FAKE AUTH: Register attempt - ALWAYS SUCCEEDS');
  
  const fakeUser = {
    id: '507f1f77bcf86cd799439013',
    email: req.body.email || 'fake@user.com',
    name: req.body.name || 'Fake User',
    role: 'client_admin', // Always give admin access
    clientId: '507f1f77bcf86cd799439012'
  };

  res.json({
    success: true,
    message: 'Fake registration successful - NO REAL AUTHENTICATION',
    user: fakeUser
  });
});

// Fake validate-permissions route - always returns success
router.get('/validate-permissions', (req, res) => {
  console.log('🚫 FAKE AUTH: Permission validation - ALWAYS SUCCEEDS');
  
  const fakeUser = {
    id: '507f1f77bcf86cd799439011',
    email: 'fake@user.com',
    name: 'Fake User',
    role: 'client_admin',
    level: 2,
    clientId: '507f1f77bcf86cd799439012',
    client: {
      id: '507f1f77bcf86cd799439012',
      name: 'Fake Client Corp'
    },
    permissions: {
      canAccessPublic: true,
      canAccessClient: true,
      canAccessAdmin: true
    }
  };

  res.json({
    success: true,
    user: fakeUser
  });
});

module.exports = router;