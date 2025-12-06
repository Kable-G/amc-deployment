const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const EnhancedUser = require('../models/EnhancedUser');
const router = express.Router();

// OAuth provider routes
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

router.get('/microsoft', passport.authenticate('microsoft', { 
  scope: ['user.read'] 
}));

router.get('/linkedin', passport.authenticate('linkedin', { 
  scope: ['r_liteprofile', 'r_emailaddress'] 
}));

router.get('/github', passport.authenticate('github', { 
  scope: ['user:email'] 
}));

// OAuth callback handler
async function handleOAuthCallback(req, res) {
  try {
    if (!req.user) {
      return res.redirect('/login.html?error=oauth_failed');
    }

    const { provider, profile } = req.user;
    const email = profile.emails?.[0]?.value || profile.email;
    
    if (!email) {
      return res.redirect('/login.html?error=no_email');
    }

    // Check if user exists by email
    let user = await EnhancedUser.findOne({ email: email.toLowerCase() });
    
    if (user) {
      // User exists - add OAuth provider if not already connected
      const existingProvider = user.getOAuthProvider(provider);
      
      if (!existingProvider) {
        user.oauthProviders.push({
          provider: provider,
          providerId: profile.id,
          email: email,
          profile: {
            name: profile.displayName || profile.name,
            avatar: profile.photos?.[0]?.value || profile.avatar_url
          }
        });
        await user.save();
      }
      
      // Update last login
      user.lastLogin = new Date();
      user.loginCount += 1;
      await user.save();
      
    } else {
      // Create new user with OAuth provider
      user = new EnhancedUser({
        email: email.toLowerCase(),
        role: 'media_user', // Default to Level 1
        level: 1,
        status: 'active',
        emailVerified: true, // OAuth emails are pre-verified
        profile: {
          firstName: profile.name?.givenName || profile.displayName?.split(' ')[0],
          lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' '),
          avatar: profile.photos?.[0]?.value || profile.avatar_url
        },
        oauthProviders: [{
          provider: provider,
          providerId: profile.id,
          email: email,
          profile: {
            name: profile.displayName || profile.name,
            avatar: profile.photos?.[0]?.value || profile.avatar_url
          }
        }],
        lastLogin: new Date(),
        loginCount: 1
      });
      
      await user.save();
    }

    // Generate JWT token
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        level: user.level
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Redirect to success page with token
    const redirectUrl = `/oauth-success.html?token=${token}&user=${encodeURIComponent(JSON.stringify({
      id: user._id,
      email: user.email,
      role: user.role,
      level: user.level,
      permissions: user.permissions,
      profile: user.profile
    }))}`;

    res.redirect(redirectUrl);

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/login.html?error=server_error');
  }
}

// OAuth callback routes
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login.html?error=google_failed' }),
  handleOAuthCallback
);

router.get('/microsoft/callback', 
  passport.authenticate('microsoft', { failureRedirect: '/login.html?error=microsoft_failed' }),
  handleOAuthCallback
);

router.get('/linkedin/callback', 
  passport.authenticate('linkedin', { failureRedirect: '/login.html?error=linkedin_failed' }),
  handleOAuthCallback
);

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login.html?error=github_failed' }),
  handleOAuthCallback
);

// Disconnect OAuth provider
router.delete('/disconnect/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await EnhancedUser.findById(decoded.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user has password or other OAuth providers
    const hasPassword = !!user.password;
    const otherProviders = user.oauthProviders.filter(p => p.provider !== provider);
    
    if (!hasPassword && otherProviders.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot disconnect last authentication method. Please set a password first.' 
      });
    }

    // Remove the OAuth provider
    user.oauthProviders = otherProviders;
    await user.save();

    res.json({ 
      success: true, 
      message: `${provider} account disconnected successfully` 
    });

  } catch (error) {
    console.error('OAuth disconnect error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;