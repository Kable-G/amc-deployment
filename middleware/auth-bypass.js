// middleware/auth-bypass.js - Fake auth middleware that always allows access

const mongoose = require('mongoose');

const authBypass = async (req, res, next) => {
  // ENHANCED AUTH BYPASS: Try to get real user data first, fallback to fake data
  let realUserFound = false;
  
  console.log(`🔍 AUTH BYPASS DEBUG: Processing request to ${req.url}`);
  console.log(`📋 Headers received:`, {
    authorization: req.headers.authorization ? 'Present' : 'Missing',
    authHeaderLength: req.headers.authorization ? req.headers.authorization.length : 0
  });
  
  // Check if we have a real authentication token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log(`🎫 TOKEN FOUND: Bearer token detected, length: ${authHeader.length}`);
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      
      console.log(`🔐 JWT_SECRET available: ${process.env.JWT_SECRET ? 'Yes' : 'No'}`);
      if (process.env.JWT_SECRET) {
        console.log(`🔓 Attempting to verify token...`);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`✅ Token decoded successfully:`, { userId: decoded.user?.id || decoded.userId, role: decoded.role });
        
        // Get real user data from database
        const User = require('../models/User');
        const realUser = await User.findById(decoded.user?.id || decoded.userId)
          .populate('clientId', 'clientName contactEmail')
          .select('email name role clientId');
        
        if (realUser) {
          // Use real user data - this ensures proper email logging
          // For platform_admin users without clientId, use a default clientId
          let finalClientId = realUser.clientId?._id;
          if (!finalClientId && realUser.role === 'platform_admin') {
            finalClientId = '507f1f77bcf86cd799439012'; // Default clientId for platform admins
          }
          
          req.user = {
            id: realUser._id,
            role: realUser.role,
            clientId: finalClientId,
            email: realUser.email,
            name: realUser.name,
            level: realUser.role === 'platform_admin' ? 3 :
                   (realUser.role === 'client_admin' ? 2 : 1)
          };
          realUserFound = true;
          console.log(`✅ AUTH BYPASS: Real user detected - ${realUser.email} (${realUser.role}) - Email will be logged properly`);
          console.log(`📧 USER DATA: ID=${realUser._id}, Email=${realUser.email}, Role=${realUser.role}, ClientID=${realUser.clientId?._id}`);
          
          // Special logging for radar alert creation
          if (req.url && req.url.includes('/radar')) {
            console.log(`🎯 RADAR ALERT: User ${realUser.email} is creating/accessing radar alerts - real email will be stored`);
          }
        }
      }
    } catch (tokenError) {
      // Token invalid or expired, will use fake data below
      console.log('❌ AUTH BYPASS: Token validation failed:', tokenError.message);
      console.log('🔄 Will use fake user data instead');
    }
  } else {
    console.log(`❌ NO VALID TOKEN: authHeader=${authHeader ? 'exists but invalid format' : 'missing'}`);
  }
  
  // Fallback to fake user data if no real user found
  if (!realUserFound) {
    req.user = {
      id: '507f1f77bcf86cd799439011', // Valid 24-character hex ObjectId
      role: 'platform_admin', // Give admin role so all access checks pass
      clientId: '507f1f77bcf86cd799439012', // Valid 24-character hex ObjectId
      email: 'fake@example.com',
      level: 3 // Add level for compatibility
    };
    console.log('AUTH BYPASS: Using fake admin user for URL:', req.url);
  }
  
  next();
};

module.exports = authBypass;