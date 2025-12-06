const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Company = require("../models/Company");
const User = require("../models/User");
const Invite = require("../models/Invite");
const AuditEvent = require("../models/AuditEvent");
const { authenticate } = require("../middleware/authMiddleware");
const { sendInviteEmail } = require("../inviteMailer");

// 🔐 SECURITY: Rate limiting for invitation endpoints
const rateLimit = require("express-rate-limit");

// Rate limiter for invite creation (per IP)
const inviteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Max 20 invites per hour per IP
  message: {
    success: false,
    error: "Too many invitation requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for invite acceptance (per IP)
const acceptRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 acceptance attempts per 15 minutes per IP
  message: {
    success: false,
    error: "Too many invitation acceptance attempts. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to ensure only platform_admin can use these routes
function requirePlatformAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Authentication required"
    });
  }
  
  if (req.user.role !== "platform_admin") {
    return res.status(403).json({
      success: false,
      error: "Access denied: platform admin only"
    });
  }
  
  next();
}

// Middleware to ensure company scope for client admins
function requireCompanyAccess(req, res, next) {
  const companyId = req.params.id || req.params.companyId;
  
  // Platform admin has access to all companies
  if (req.user.role === "platform_admin") {
    return next();
  }
  
  // Client admin must belong to the company they're accessing
  if (req.user.role === "client_admin" && 
      req.user.clientId && 
      req.user.clientId.toString() === companyId) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    error: "Access denied: insufficient permissions for this company"
  });
}

// ✅ 1. PUBLIC INVITATION ENDPOINTS (NO AUTHENTICATION REQUIRED)

// GET /api/companies/validate-invite/:token - Validate invitation token before showing form
router.get("/validate-invite/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Find invitation by token
    const invite = await Invite.findOne({ token }).populate('clientId', 'name contactEmail status');
    
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found",
        errorType: "NOT_FOUND"
      });
    }

    // Check if already accepted
    if (invite.status === 'accepted') {
      return res.status(400).json({
        success: false,
        error: "This invitation has already been used",
        errorType: "ALREADY_USED"
      });
    }

    // Check if expired
    if (invite.status === 'expired' || invite.isExpired()) {
      return res.status(400).json({
        success: false,
        error: "This invitation has expired",
        errorType: "EXPIRED",
        expiredAt: invite.expiresAt
      });
    }

    // Check if company is still active
    if (invite.clientId.status !== 'pending' && invite.clientId.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: "Company is no longer accepting invitations",
        errorType: "COMPANY_INACTIVE"
      });
    }

    // Valid invitation
    res.json({
      success: true,
      invitation: {
        email: invite.email,
        role: invite.role,
        company: {
          name: invite.clientId.name,
          contactEmail: invite.clientId.contactEmail
        },
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt
      }
    });

  } catch (error) {
    console.error("Error validating invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while validating invitation",
      errorType: "SERVER_ERROR"
    });
  }
});

// POST /api/companies/accept-invite/:token - Accept invite and activate company
router.post("/accept-invite/:token", acceptRateLimit, async (req, res) => {
  try {
    const { token } = req.params;
    const { name, password, email } = req.body;

    // Validate input
    if (!name || !password || !email) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters long"
      });
    }

    // Find valid invitation
    const invite = await Invite.findValidInvitation(token);
    if (!invite) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired invitation token"
      });
    }

    // 🔐 SECURITY: Email ownership validation - prevent invite hijacking
    if (email.toLowerCase().trim() !== invite.email.toLowerCase().trim()) {
      return res.status(400).json({
        success: false,
        error: "Email address must match the invitation recipient"
      });
    }

    // 🔐 SECURITY: Single-use enforcement - check if already accepted
    if (invite.status === 'accepted') {
      return res.status(400).json({
        success: false,
        error: "This invitation has already been used"
      });
    }

    // Check if user already exists
    let user = await User.findOne({ email: invite.email });
    
    if (user) {
      // User exists, update their role and company
      user.name = name;
      user.password = password; // Will be hashed by pre-save middleware
      user.role = invite.role;
      user.clientId = invite.clientId;
      user.isActive = true;
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        email: invite.email,
        name,
        password, // Will be hashed by pre-save middleware
        role: invite.role,
        clientId: invite.clientId,
        isActive: true,
        lastLoginAt: new Date()
      });
    }

    // 🔐 SECURITY: Mark invitation as accepted (single-use enforcement)
    await invite.markAccepted(user._id);

    // Activate the company
    const company = await Company.findByIdAndUpdate(
      invite.clientId,
      { status: "active", updatedAt: new Date() },
      { new: true }
    );

    // Log the events
    await AuditEvent.logEvent({
      clientId: company._id,
      userId: user._id,
      emailSnapshot: user.email,
      action: "invite.accepted",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { role: invite.role, companyName: company.name },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    await AuditEvent.logEvent({
      clientId: company._id,
      userId: user._id,
      emailSnapshot: user.email,
      action: "company.reactivated",
      targetType: "company",
      targetId: company._id.toString(),
      metadata: { status: "active", firstAdmin: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    // Generate JWT token for immediate login
    const jwt = require('jsonwebtoken');
    const jwtToken = jwt.sign(
      {
        user: {
          id: user._id,
          role: user.role,
          clientId: user.clientId.toString()
        }
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: "Invitation accepted successfully. Company is now active!",
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientId: user.clientId
      },
      company: {
        id: company._id,
        companyId: company.companyId,
        name: company.name,
        status: company.status
      }
    });

  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while accepting invitation"
    });
  }
});

// Apply authentication to all remaining company routes
router.use(authenticate);

// ✅ 2. AUTHENTICATED COMPANY INVITATION & ONBOARDING

// POST /api/companies/invite - Platform admin creates company and sends invite
router.post("/invite", (req, res, next) => {
  console.log('🔥 COMPANY ROUTE HIT: POST /invite');
  console.log('🔥 Request method:', req.method);
  console.log('🔥 Request headers:', req.headers);
  console.log('🔥 Request body:', req.body);
  next();
}, requirePlatformAdmin, async (req, res) => {
  try {
    const {
      companyName,
      legalName,
      primaryDomain,
      contactEmail,
      contactPerson,
      contactPhone,
      companyWebsite,
      planType = 'enterprise'
    } = req.body;

    // Validate required fields
    if (!companyName || !contactEmail) {
      return res.status(400).json({
        success: false,
        error: "Company name and contact email are required"
      });
    }

    // Generate unique company ID by finding the next available ID
    let companyId;
    let attempts = 0;
    const maxAttempts = 1000; // Safety limit
    
    do {
      // Find the highest existing company ID number
      const lastCompany = await Company.findOne(
        { companyId: { $regex: /^COMP\d{3}$/ } },
        { companyId: 1 }
      ).sort({ companyId: -1 });
      
      let nextNumber = 1;
      if (lastCompany && lastCompany.companyId) {
        const lastNumber = parseInt(lastCompany.companyId.replace('COMP', ''));
        nextNumber = lastNumber + 1;
      }
      
      companyId = `COMP${String(nextNumber).padStart(3, '0')}`;
      
      // Check if this ID already exists
      const existingCompany = await Company.findOne({ companyId });
      if (!existingCompany) {
        break; // Found available ID
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique company ID after maximum attempts');
      }
      
      // If ID exists, we'll try the next number in the next iteration
      // This handles edge cases where there might be gaps in the sequence
      
    } while (attempts < maxAttempts);

    // Create the company
    const company = await Company.create({
      companyId,
      name: companyName,
      legalName,
      primaryDomain,
      contactEmail,
      contactPerson,
      contactPhone,
      companyWebsite,
      planType,
      status: "pending" // Always starts as pending until first admin accepts invite
    });

    // Generate secure invitation token
    const token = crypto.randomBytes(32).toString("hex");

    // Extract first name from contact person for personalized email greeting
    const extractFirstName = (fullName) => {
      if (!fullName) return "";
      return fullName.trim().split(/\s+/)[0]; // Split by whitespace and take first part
    };

    // Create the invitation for the first client_admin
    const invite = await Invite.create({
      email: contactEmail.toLowerCase(),
      clientId: company._id,
      firstName: extractFirstName(contactPerson),
      companyName: companyName,
      role: "client_admin",
      token,
      emailStatus: "pending",
      invitedBy: req.user._id
    });

    // Log the event
    await AuditEvent.logEvent({
      clientId: company._id,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "company.created",
      targetType: "company",
      targetId: company._id.toString(),
      metadata: { companyName, contactEmail, planType, companyId },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    await AuditEvent.logEvent({
      clientId: company._id,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.sent",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { email: contactEmail, role: "client_admin", companyName },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    // Send email with invitation link
    console.log('🔥 COMPANY ROUTE: About to send invitation email');
    console.log('🔥 COMPANY ROUTE: Invite object:', {
      email: invite.email,
      token: invite.token,
      firstName: invite.firstName,
      companyName: invite.companyName
    });
    
    const emailSent = await sendInviteEmail(invite);
    
    console.log('🔥 COMPANY ROUTE: Email send result:', emailSent);
    
    if (!emailSent || !emailSent.success) {
      console.warn(`Failed to send invitation email to ${contactEmail} for company ${companyName}`);
      console.warn('Email send result:', emailSent);
    } else {
      console.log(`✅ Successfully sent invitation email to ${contactEmail} for company ${companyName}`);
    }

    res.status(201).json({
      success: true,
      message: emailSent ?
        "Company created and invitation sent successfully" :
        "Company created but invitation email failed - will retry automatically",
      company: {
        id: company._id,
        companyId: company.companyId,
        name: company.name,
        contactEmail: company.contactEmail,
        status: company.status,
        planType: company.planType
      },
      invite: {
        id: invite._id,
        email: invite.email,
        role: invite.role,
        emailStatus: invite.emailStatus,
        expiresAt: invite.expiresAt,
        inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/accept-invite?token=${token}`
      }
    });

  } catch (error) {
    console.error("Error creating company and sending invite:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "A company with this name already exists"
      });
    }
    
    res.status(500).json({
      success: false,
      error: "Server error while creating company"
    });
  }
});

// POST /api/companies/resend-invite - Resend invitation email
router.post("/resend-invite", inviteRateLimit, requirePlatformAdmin, async (req, res) => {
  try {
    const { inviteId } = req.body;

    const invite = await Invite.findById(inviteId).populate('clientId', 'name');
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found"
      });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: "Can only resend pending invitations"
      });
    }

    // Generate new token and extend expiry
    const newToken = crypto.randomBytes(32).toString("hex");
    invite.token = newToken;
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await invite.save();

    // Send email with new invitation link
    console.log('🔥 RESEND ROUTE: About to resend invitation email');
    console.log('🔥 RESEND ROUTE: Invite object:', {
      email: invite.email,
      token: invite.token,
      firstName: invite.firstName,
      companyName: invite.companyName
    });
    
    const emailSent = await sendInviteEmail(invite);
    
    console.log('🔥 RESEND ROUTE: Email send result:', emailSent);
    
    if (!emailSent || !emailSent.success) {
      console.warn(`Failed to resend invitation email to ${invite.email} for company ${invite.clientId.name}`);
      console.warn('Resend email result:', emailSent);
    } else {
      console.log(`✅ Successfully resent invitation email to ${invite.email} for company ${invite.clientId.name}`);
    }

    // Log the event
    await AuditEvent.logEvent({
      clientId: invite.clientId._id,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.sent",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { email: invite.email, resent: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: emailSent ?
        "Invitation resent successfully" :
        "Invitation updated but email failed - will retry automatically",
      emailSent,
      inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/accept-invite?token=${newToken}`
    });

  } catch (error) {
    console.error("Error resending invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while resending invitation"
    });
  }
});

// DELETE /api/companies/cancel-invite/:id - Cancel pending invitation
router.delete("/cancel-invite/:id", requirePlatformAdmin, async (req, res) => {
  try {
    const invite = await Invite.findById(req.params.id).populate('clientId', 'name');
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found"
      });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: "Can only cancel pending invitations"
      });
    }

    // Mark as expired instead of deleting for audit trail
    invite.status = 'expired';
    await invite.save();

    // Log the event
    await AuditEvent.logEvent({
      clientId: invite.clientId._id,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.revoked",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { email: invite.email, reason: "cancelled_by_admin" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Invitation cancelled successfully"
    });

  } catch (error) {
    console.error("Error cancelling invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while cancelling invitation"
    });
  }
});

// ✅ 3. COMPANY LIFECYCLE MANAGEMENT

// GET /api/companies - List all companies with filters (Platform Admin)
router.get("/", requirePlatformAdmin, async (req, res) => {
  try {
    const { 
      status, 
      billingStatus, 
      planType,
      search,
      page = 1, 
      limit = 20 
    } = req.query;

    // Build query
    const query = {};
    if (status) query.status = status;
    if (billingStatus) query.billingStatus = billingStatus;
    if (planType) query.planType = planType;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { companyId: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const companies = await Company.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count for pagination
    const total = await Company.countDocuments(query);

    // Get user counts and pending invites for each company
    const companiesWithCounts = await Promise.all(
      companies.map(async (company) => {
        const userCount = await User.countDocuments({ 
          clientId: company._id, 
          isActive: true 
        });
        
        const adminCount = await User.countDocuments({ 
          clientId: company._id, 
          role: 'client_admin',
          isActive: true 
        });

        const pendingInvites = await Invite.countDocuments({
          clientId: company._id,
          status: 'pending'
        });

        return {
          ...company.toObject(),
          userCount,
          adminCount,
          pendingInvites
        };
      })
    );

    res.json({
      success: true,
      companies: companiesWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching companies"
    });
  }
});

// GET /api/companies/:id - Get single company details
router.get("/:id", requireCompanyAccess, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Get users for this company
    const users = await User.find({ 
      clientId: company._id, 
      isActive: true 
    }).select('-password');

    // Get pending invites
    const pendingInvites = await Invite.find({
      clientId: company._id,
      status: 'pending'
    }).populate('invitedBy', 'name email');

    res.json({
      success: true,
      company: {
        ...company.toObject(),
        users,
        pendingInvites
      }
    });

  } catch (error) {
    console.error("Error fetching company:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching company"
    });
  }
});

// PATCH /api/companies/:id - Update company info
router.patch("/:id", requirePlatformAdmin, async (req, res) => {
  try {
    const {
      name,
      legalName,
      primaryDomain,
      contactEmail,
      contactPerson,
      contactPhone,
      companyWebsite,
      planType,
      settings
    } = req.body;
    
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Track changes for audit
    const changes = {};
    if (name && name !== company.name) changes.name = { from: company.name, to: name };
    if (legalName && legalName !== company.legalName) changes.legalName = { from: company.legalName, to: legalName };
    if (primaryDomain && primaryDomain !== company.primaryDomain) changes.primaryDomain = { from: company.primaryDomain, to: primaryDomain };
    if (contactEmail && contactEmail !== company.contactEmail) changes.contactEmail = { from: company.contactEmail, to: contactEmail };
    if (planType && planType !== company.planType) changes.planType = { from: company.planType, to: planType };

    // Update the company
    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(legalName && { legalName }),
        ...(primaryDomain && { primaryDomain }),
        ...(contactEmail && { contactEmail }),
        ...(contactPerson && { contactPerson }),
        ...(contactPhone && { contactPhone }),
        ...(companyWebsite && { companyWebsite }),
        ...(planType && { planType }),
        ...(settings && { settings }),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    // Log the event
    await AuditEvent.logEvent({
      clientId: company._id,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "company.updated",
      targetType: "company",
      targetId: company._id.toString(),
      metadata: { changes },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Company updated successfully",
      company: updatedCompany
    });

  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({
      success: false,
      error: "Server error while updating company"
    });
  }
});

// PATCH /api/companies/:id/status - Update company status (suspend/cancel/reactivate)
router.patch("/:id/status", requirePlatformAdmin, async (req, res) => {
  try {
    const { status, billingStatus, reason } = req.body;
    
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Track what changed for audit log
    const changes = {};
    if (status && status !== company.status) changes.status = { from: company.status, to: status };
    if (billingStatus && billingStatus !== company.billingStatus) changes.billingStatus = { from: company.billingStatus, to: billingStatus };

    // Update the company
    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      { 
        ...(status && { status }),
        ...(billingStatus && { billingStatus }),
        updatedAt: new Date() 
      },
      { new: true, runValidators: true }
    );

    // Determine audit action
    let action = "company.updated";
    if (changes.status) {
      if (changes.status.to === "suspended") action = "company.suspended";
      else if (changes.status.to === "cancelled") action = "company.cancelled";
      else if (changes.status.to === "active") action = "company.reactivated";
    }

    // Log the event
    await AuditEvent.logEvent({
      clientId: company._id,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action,
      targetType: "company",
      targetId: company._id.toString(),
      metadata: { changes, reason },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    // If company is cancelled, expire all pending invites
    if (status === "cancelled") {
      await Invite.updateMany(
        { clientId: company._id, status: 'pending' },
        { status: 'expired' }
      );
    }

    res.json({
      success: true,
      message: `Company ${action.split('.')[1]} successfully`,
      company: updatedCompany
    });

  } catch (error) {
    console.error("Error updating company status:", error);
    res.status(500).json({
      success: false,
      error: "Server error while updating company status"
    });
  }
});

// DELETE /api/companies/:id - Delete company (Platform Admin only)
router.delete("/:id", requirePlatformAdmin, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Check if company has active users
    const activeUsers = await User.countDocuments({
      clientId: company._id,
      isActive: true
    });

    if (activeUsers > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete company with active users. Please deactivate all users first."
      });
    }

    // Delete the company
    await Company.findByIdAndDelete(req.params.id);

    // Cancel all pending invites
    await Invite.updateMany(
      { clientId: company._id, status: 'pending' },
      { status: 'expired' }
    );

    // Log the event
    await AuditEvent.logEvent({
      clientId: company._id,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "company.deleted",
      targetType: "company",
      targetId: company._id.toString(),
      metadata: { companyName: company.name, activeUsers },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Company deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({
      success: false,
      error: "Server error while deleting company"
    });
  }
});

module.exports = router;