// routes/auth-no-rate-limit.routes.js
// Temporary auth routes without rate limiting for testing

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User'); // User model (already updated)
const Client = require('../models/Client'); // <<<< ADD THIS: Import Client model
const Invite = require('../models/Invite');
const dotenv = require('dotenv');
const { sendVerificationEmail, sendWelcomeEmail } = require('../services/mediaUserEmailService');

// Import security middleware (without rate limiting)
const {
  validateInvitationToken,
  detectSuspiciousActivity,
  addSecurityHeaders
} = require('../middleware/tokenValidation');
const {
  ensureCompanyHasAdmin
} = require('../middleware/companySecurityMiddleware');

dotenv.config();

// --- Zod Schemas for Validation ---

// ENHANCED Schema for Registration Input - Landing Page Signups with Email Verification
const registerSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  name: z.string().min(1, { message: "Name is required" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long" }),
  confirmPassword: z.string().optional(), // Optional for backward compatibility
  jobTitle: z.string().optional(), // Optional for admin-created users
  country: z.string().optional(), // Optional for admin-created users
  company: z.string().optional(), // Company field (optional)
  role: z.enum([
      'client_user',      // A standard user belonging to a client company
      'client_admin',     // An admin user for a specific client company
      'platform_admin',   // Your team, managing the whole platform
      'media_user'        // Default for landing page signups
  ]).default('media_user'), // Default role for landing page signups
  clientId: z.string().optional(), // clientId is optional for media_user signups
  skipEmailVerification: z.boolean().optional() // Allow admin-created users to skip verification
}).refine((data) => {
  // Only require password confirmation for landing page signups (media_user without skipEmailVerification)
  if (data.role === 'media_user' && !data.skipEmailVerification && data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


const loginSchema = z.object({ // Login schema remains the same
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});


router.post('/register', addSecurityHeaders, detectSuspiciousActivity, async (req, res) => {
  console.log("API received request for POST /register");
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Registration validation failed:', parsed.error.flatten().fieldErrors);
      return res.status(400).json({ error: 'Invalid registration data.', details: parsed.error.flatten().fieldErrors });
    }

    // ENHANCED: Destructure all fields including new ones
    const { email, password, confirmPassword, name, jobTitle, country, company, role, clientId, skipEmailVerification } = parsed.data;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.warn(`Registration attempt failed: Email already exists - ${email}`);
      return res.status(400).json({ error: 'User already exists with this email address.' });
    }

    // ENHANCED: Create user object with backward compatibility
    const newUserObject = {
      email: email.toLowerCase(),
      password,
      name,
      role,
      isActive: true
    };

    // Add new fields only if provided (for landing page signups)
    if (jobTitle) newUserObject.jobTitle = jobTitle;
    if (country) newUserObject.country = country;
    if (company && company.trim()) newUserObject.company = company.trim();

    // Email verification logic - only for media_user from landing page
    const isLandingPageSignup = role === 'media_user' && !skipEmailVerification;
    if (isLandingPageSignup) {
      // Generate 6-digit verification code for landing page signups
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      newUserObject.emailVerified = false;
      newUserObject.verificationCode = verificationCode;
      newUserObject.verificationExpires = verificationExpires;
    } else {
      // Admin-created users are automatically verified
      newUserObject.emailVerified = true;
    }

    // Only validate clientId if it's provided and role requires it
    if (clientId && (role === 'client_user' || role === 'client_admin')) {
        try {
            const clientExists = await Client.findById(clientId);
            if (!clientExists) {
                return res.status(400).json({ error: 'Invalid Client ID provided.' });
            }
            newUserObject.clientId = clientId;
        } catch (clientError) {
            console.warn('Client validation skipped - Client model may not be available:', clientError.message);
            // For now, allow signup without client validation
        }
    }
    // No clientId needed for platform_admin or media_user roles


    const newUser = new User(newUserObject);
    await newUser.save();
    
    // Log with available fields
    const logFields = [`${newUser.email}`, `ID: ${newUser._id}`, `Role: ${newUser.role}`];
    if (newUser.country) logFields.push(`Country: ${newUser.country}`);
    if (newUser.jobTitle) logFields.push(`Job: ${newUser.jobTitle}`);
    console.log(`User registered successfully: ${logFields.join(', ')}`);

    // Send verification email for landing page signups
    if (isLandingPageSignup) {
      console.log(`Verification code for ${newUser.email}: ${newUserObject.verificationCode}`);
      
      // Send verification email
      const emailSent = await sendVerificationEmail(newUser, newUserObject.verificationCode);
      if (!emailSent) {
        console.warn(`Failed to send verification email to ${newUser.email}, but account was created`);
      }
      
      res.status(201).json({
        success: true,
        message: 'Account created successfully! Please check your email for verification code.',
        requiresVerification: true,
        user: {
          id: newUser._id,
          email: newUser.email,
          name: newUser.name,
          jobTitle: newUser.jobTitle,
          country: newUser.country,
          role: newUser.role,
          emailVerified: newUser.emailVerified,
          clientId: newUser.clientId
        }
      });
    } else {
      // Admin-created users get immediate access
      res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        requiresVerification: false,
        user: {
          id: newUser._id,
          email: newUser.email,
          name: newUser.name,
          jobTitle: newUser.jobTitle,
          country: newUser.country,
          role: newUser.role,
          emailVerified: newUser.emailVerified,
          clientId: newUser.clientId
        }
      });
    }

  } catch (err) {
    console.error('Error during user registration:', err);
    if (err.code === 11000) { 
         return res.status(400).json({ error: 'Email already exists.' });
    }
    res.status(500).json({ error: 'Server error during registration.' });
  }
});


// --- Route Definition 2: Login a user ---
// METHOD: POST
// PATH: /api/v1/auth/login
// REMOVED RATE LIMITING FOR TESTING
router.post('/login', addSecurityHeaders, detectSuspiciousActivity, async (req, res) => {
  console.log("API received request for POST /login");
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Login validation failed:', parsed.error.flatten().fieldErrors);
      return res.status(400).json({ error: 'Invalid login data.', details: parsed.error.flatten().fieldErrors });
    }

    const { email, password } = parsed.data;

    // Fetch user, explicitly including password AND clientId
    // Mongoose includes all fields by default unless select: false or projection is used.
    // If clientId was NOT explicitly selected but is in the schema, it would be fetched.
    // Password needs .select('+password')
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    // After this, 'user' object will contain 'role' and 'clientId' if they exist on the document.

    if (!user) {
      console.warn(`Login attempt failed: User not found - ${email}`);
      return res.status(401).json({ error: 'Invalid credentials.' }); 
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      console.warn(`Login attempt failed: Incorrect password for user - ${email}`);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Check email verification for media_user accounts
    if (user.role === 'media_user' && !user.emailVerified) {
      console.warn(`Login attempt failed: Email not verified for user - ${email}`);
      return res.status(403).json({
        error: 'Please verify your email address before signing in.',
        errorCode: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('FATAL ERROR: JWT_SECRET is not defined.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // --- MODIFIED JWT Payload ---
    // Ensure payload contains what your authMiddleware will need to reconstruct req.user
    const payload = {
      user: {
        id: user._id, 
        role: user.role,
        // ADD clientId to payload IF it exists for this user
        ...(user.clientId && { clientId: user.clientId.toString() }) // Convert ObjectId to string for JWT
      }
    };
    // --- END MODIFIED JWT Payload ---

    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '8h' }, 
      (err, token) => { 
        if (err) {
             console.error('Error signing JWT:', err);
             return res.status(500).json({ error: 'Error generating authentication token.' });
        }
        console.log(`User logged in successfully: ${user.email}, Role: ${user.role}, ClientID: ${user.clientId}`);
        res.json({
          success: true,
          message: 'Login successful.',
          token: token,
          user: { // Send relevant user info to the frontend
            id: user._id,
            email: user.email,
            name: user.name, 
            role: user.role,
            clientId: user.clientId ? user.clientId.toString() : null // Send clientId if it exists
          }
        });
      }
    );

  } catch (err) {
    console.error('Error during user login:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
}); 


// GET /api/v1/auth/validate-permissions - Validate user permissions (for frontend auth check)
const { authenticate } = require('../middleware/authMiddleware');

router.get('/validate-permissions', addSecurityHeaders, authenticate, async (req, res) => {
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

// POST /api/v1/auth/verify-email - Verify email with code (for landing page signups)
router.post('/verify-email', addSecurityHeaders, detectSuspiciousActivity, async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required',
        errorCode: 'MISSING_FIELDS'
      });
    }

    // Find user with verification code
    const user = await User.findOne({
      email: email.toLowerCase(),
      verificationCode: verificationCode,
      verificationExpires: { $gt: new Date() }
    }).select('+verificationCode +verificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
        errorCode: 'INVALID_CODE'
      });
    }

    // Mark email as verified and clear verification fields
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    console.log(`Email verified successfully for user: ${user.email}`);

    // Send welcome email
    const welcomeEmailSent = await sendWelcomeEmail(user);
    if (!welcomeEmailSent) {
      console.warn(`Failed to send welcome email to ${user.email}, but verification was successful`);
    }

    // Generate JWT token for authenticated access
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('FATAL ERROR: JWT_SECRET is not defined.');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const payload = {
      user: {
        id: user._id,
        role: user.role,
        ...(user.clientId && { clientId: user.clientId.toString() })
      }
    };

    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: '8h' },
      (err, token) => {
        if (err) {
          console.error('Error signing JWT after email verification:', err);
          return res.status(500).json({ error: 'Error generating authentication token.' });
        }

        res.json({
          success: true,
          message: 'Email verified successfully! Welcome to AutoMediaCenter.',
          token: token, // ✅ NOW INCLUDES TOKEN
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            jobTitle: user.jobTitle,
            country: user.country,
            role: user.role,
            emailVerified: user.emailVerified,
            clientId: user.clientId ? user.clientId.toString() : null
          }
        });
      }
    );

  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while verifying email',
      errorCode: 'VERIFICATION_ERROR'
    });
  }
});

// POST /api/v1/auth/resend-verification - Resend verification code
router.post('/resend-verification', addSecurityHeaders, detectSuspiciousActivity, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        errorCode: 'MISSING_EMAIL'
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerified: false
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found or already verified',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.verificationCode = verificationCode;
    user.verificationExpires = verificationExpires;
    await user.save();

    console.log(`New verification code for ${user.email}: ${verificationCode}`);

    // Send verification email with new code
    const emailSent = await sendVerificationEmail(user, verificationCode);
    if (!emailSent) {
      console.warn(`Failed to send verification email to ${user.email}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.',
        errorCode: 'EMAIL_SEND_FAILED'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent! Please check your email.'
    });

  } catch (error) {
    console.error('Error resending verification code:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while resending verification code',
      errorCode: 'RESEND_ERROR'
    });
  }
});

module.exports = router;