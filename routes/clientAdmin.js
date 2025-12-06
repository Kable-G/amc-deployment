const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../models/User");
const Company = require("../models/Company");
const Invite = require("../models/Invite");
const AuditEvent = require("../models/AuditEvent");
const { authenticate } = require("../middleware/authMiddleware");
const { sendInviteEmail } = require("../inviteMailer");
const {
  validateActiveUserAndCompany,
  enforceCompanyDataIsolation,
  validateCompanyParameters
} = require("../middleware/securityAudit");

// Middleware to ensure only client_admin can use these routes
function requireClientAdmin(req, res, next) {
  if (req.user.role !== "client_admin") {
    return res.status(403).json({ 
      success: false,
      error: "Access denied: client admin only" 
    });
  }
  next();
}

// Middleware to ensure user can only access their own company data
function requireCompanyAccess(req, res, next) {
  // Client admin can only access their own company
  if (!req.user.clientId) {
    return res.status(403).json({
      success: false,
      error: "Access denied: no company association"
    });
  }
  
  // Add company ID to request for easy access
  req.companyId = req.user.clientId;
  next();
}

// Apply authentication and CRITICAL SECURITY validation to all routes
router.use(authenticate);
router.use(validateActiveUserAndCompany);        // 🚨 CRITICAL: Validate user/company status
router.use(enforceCompanyDataIsolation);         // 🚨 CRITICAL: Enforce data isolation
router.use(validateCompanyParameters);           // 🚨 CRITICAL: Prevent cross-company access
router.use(requireClientAdmin);
router.use(requireCompanyAccess);

// ✅ 1. COMPANY DATA ENDPOINTS

// GET /api/client-admin/company - Get own company details
router.get("/company", async (req, res) => {
  try {
    const company = await Company.findById(req.companyId);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    res.json({
      success: true,
      company: {
        id: company._id,
        companyId: company.companyId,
        name: company.name,
        legalName: company.legalName,
        primaryDomain: company.primaryDomain,
        contactEmail: company.contactEmail,
        contactPerson: company.contactPerson,
        contactPhone: company.contactPhone,
        companyWebsite: company.companyWebsite,
        status: company.status,
        billingStatus: company.billingStatus,
        planType: company.planType,
        settings: company.settings,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt
      }
    });

  } catch (error) {
    console.error("Error fetching company:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching company data"
    });
  }
});

// PATCH /api/client-admin/company - Update own company details
router.patch("/company", async (req, res) => {
  try {
    const {
      legalName,
      primaryDomain,
      contactPerson,
      contactPhone,
      companyWebsite
    } = req.body;
    
    const company = await Company.findById(req.companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Track changes for audit
    const changes = {};
    if (legalName && legalName !== company.legalName) {
      changes.legalName = { from: company.legalName, to: legalName };
    }
    if (primaryDomain && primaryDomain !== company.primaryDomain) {
      changes.primaryDomain = { from: company.primaryDomain, to: primaryDomain };
    }
    if (contactPerson && contactPerson !== company.contactPerson) {
      changes.contactPerson = { from: company.contactPerson, to: contactPerson };
    }
    if (contactPhone && contactPhone !== company.contactPhone) {
      changes.contactPhone = { from: company.contactPhone, to: contactPhone };
    }
    if (companyWebsite && companyWebsite !== company.companyWebsite) {
      changes.companyWebsite = { from: company.companyWebsite, to: companyWebsite };
    }

    // Update the company (client admin can only update certain fields)
    const updatedCompany = await Company.findByIdAndUpdate(
      req.companyId,
      {
        ...(legalName && { legalName }),
        ...(primaryDomain && { primaryDomain }),
        ...(contactPerson && { contactPerson }),
        ...(contactPhone && { contactPhone }),
        ...(companyWebsite && { companyWebsite }),
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
      metadata: { changes, updatedBy: "client_admin" },
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

// ✅ 2. TEAM MEMBER MANAGEMENT

// GET /api/client-admin/team - Get all team members for own company
router.get("/team", async (req, res) => {
  try {
    const users = await User.find({ 
      clientId: req.companyId, 
      isActive: true 
    }).select('-password');

    res.json({
      success: true,
      teamMembers: users
    });

  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching team members"
    });
  }
});

// GET /api/client-admin/team/:userId - Get specific team member details
router.get("/team/:userId", async (req, res) => {
  try {
    const user = await User.findOne({ 
      _id: req.params.userId,
      clientId: req.companyId, 
      isActive: true 
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Team member not found"
      });
    }

    res.json({
      success: true,
      teamMember: user
    });

  } catch (error) {
    console.error("Error fetching team member:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching team member"
    });
  }
});

// PATCH /api/client-admin/team/:userId - Update team member (limited fields)
router.patch("/team/:userId", async (req, res) => {
  try {
    const { name, role } = req.body;
    
    // Validate role - client admin can only assign client_user or client_admin roles
    if (role && !['client_user', 'client_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Can only assign client_user or client_admin"
      });
    }

    const user = await User.findOne({ 
      _id: req.params.userId,
      clientId: req.companyId, 
      isActive: true 
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Team member not found"
      });
    }

    // Track changes for audit
    const changes = {};
    if (name && name !== user.name) changes.name = { from: user.name, to: name };
    if (role && role !== user.role) changes.role = { from: user.role, to: role };

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { 
        ...(name && { name }),
        ...(role && { role })
      },
      { new: true, runValidators: true }
    ).select('-password');

    // Log the event
    await AuditEvent.logEvent({
      clientId: req.companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.updated",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: { changes, updatedBy: "client_admin" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Team member updated successfully",
      teamMember: updatedUser
    });

  } catch (error) {
    console.error("Error updating team member:", error);
    res.status(500).json({
      success: false,
      error: "Server error while updating team member"
    });
  }
});

// DELETE /api/client-admin/team/:userId - Deactivate team member
router.delete("/team/:userId", async (req, res) => {
  try {
    const user = await User.findOne({ 
      _id: req.params.userId,
      clientId: req.companyId, 
      isActive: true 
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Team member not found"
      });
    }

    // Prevent client admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: "Cannot deactivate your own account"
      });
    }

    // Deactivate the user
    await User.findByIdAndUpdate(req.params.userId, { isActive: false });

    // Log the event
    await AuditEvent.logEvent({
      clientId: req.companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.deactivated",
      targetType: "user",
      targetId: user._id.toString(),
      metadata: { deactivatedBy: "client_admin", userName: user.name, userEmail: user.email },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Team member deactivated successfully"
    });

  } catch (error) {
    console.error("Error deactivating team member:", error);
    res.status(500).json({
      success: false,
      error: "Server error while deactivating team member"
    });
  }
});

// ✅ 3. CLIENT USER INVITATION SYSTEM

// POST /api/client-admin/invite - Send invitation to new client user
router.post("/invite", async (req, res) => {
  try {
    const { email, name, role = 'client_user' } = req.body;

    // Validate required fields
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: "Email and name are required"
      });
    }

    // Validate role
    if (!['client_user', 'client_admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Can only invite client_user or client_admin"
      });
    }

    // Get company details
    const company = await Company.findById(req.companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email already exists"
      });
    }

    // Check if there's already a pending invite for this email and company
    const existingInvite = await Invite.findOne({
      email: email.toLowerCase(),
      clientId: req.companyId,
      status: "pending"
    });
    if (existingInvite) {
      return res.status(400).json({
        success: false,
        error: "Pending invitation already exists for this email"
      });
    }

    // Extract first name for personalized email greeting
    const extractFirstName = (fullName) => {
      if (!fullName) return "";
      return fullName.trim().split(/\s+/)[0];
    };

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Create invite
    const invite = await Invite.create({
      email: email.toLowerCase(),
      clientId: req.companyId,
      firstName: extractFirstName(name),
      companyName: company.name,
      role: role,
      token,
      emailStatus: "pending",
      invitedBy: req.user._id
    });

    // Send email
    const emailSent = await sendInviteEmail(invite);
    
    // Log the event
    await AuditEvent.logEvent({
      clientId: req.companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.sent",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { email, role, companyName: company.name, invitedBy: "client_admin" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: emailSent ?
        "Invitation sent successfully" :
        "Invitation created but email sending failed - will retry automatically",
      invite: {
        id: invite._id,
        email: invite.email,
        role: invite.role,
        emailStatus: invite.emailStatus,
        expiresAt: invite.expiresAt
      }
    });

  } catch (error) {
    console.error("Error sending invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while sending invitation"
    });
  }
});

// GET /api/client-admin/invites - Get all pending invitations for own company
router.get("/invites", async (req, res) => {
  try {
    const invites = await Invite.find({ 
      clientId: req.companyId,
      status: "pending" 
    })
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invitations: invites
    });

  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching invitations"
    });
  }
});

// POST /api/client-admin/invites/:inviteId/resend - Resend invitation
router.post("/invites/:inviteId/resend", async (req, res) => {
  try {
    const invite = await Invite.findOne({
      _id: req.params.inviteId,
      clientId: req.companyId
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found"
      });
    }

    if (invite.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Can only resend pending invitations"
      });
    }

    // Reset email status and send again
    invite.emailStatus = "pending";
    invite.emailAttempts = 0;
    invite.emailError = undefined;
    await invite.save();

    const emailSent = await sendInviteEmail(invite);
    
    // Log the event
    await AuditEvent.logEvent({
      clientId: req.companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.resent",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { email: invite.email, resentBy: "client_admin" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: emailSent ?
        "Invitation resent successfully" :
        "Invitation updated but email sending failed - will retry automatically"
    });

  } catch (error) {
    console.error("Error resending invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while resending invitation"
    });
  }
});

// DELETE /api/client-admin/invites/:inviteId - Revoke invitation
router.delete("/invites/:inviteId", async (req, res) => {
  try {
    const invite = await Invite.findOne({
      _id: req.params.inviteId,
      clientId: req.companyId
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found"
      });
    }

    await invite.markRevoked();

    // Log the event
    await AuditEvent.logEvent({
      clientId: req.companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.revoked",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { email: invite.email, revokedBy: "client_admin" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Invitation revoked successfully"
    });

  } catch (error) {
    console.error("Error revoking invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while revoking invitation"
    });
  }
});

module.exports = router;