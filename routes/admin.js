const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../models/User");
const Client = require("../models/Client");
const Invite = require("../models/Invite");
const UserCompanyPermissions = require("../models/UserCompanyPermissions");
const { authenticate } = require("../middleware/authMiddleware");
const { sendInviteEmail } = require("../inviteMailer");

// Middleware to ensure only platform_admin can use these routes
function requirePlatformAdmin(req, res, next) {
  if (req.user.role !== "platform_admin") {
    return res.status(403).json({ message: "Access denied: platform admin only" });
  }
  next();
}

// Apply authentication to all admin routes
router.use(authenticate);
router.use(requirePlatformAdmin);

// ✅ Get all users with their client assignments
router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("clientId", "clientName contactEmail");
    
    // Get additional permissions for each user
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        const permissions = await UserCompanyPermissions.find({ userId: user._id, isActive: true })
          .populate("clientId", "clientName contactEmail");
        
        return {
          ...user.toObject(),
          additionalPermissions: permissions
        };
      })
    );
    
    res.json(usersWithPermissions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
});

// ✅ Get all clients
router.get("/clients", async (req, res) => {
  try {
    const clients = await Client.find({ isActive: true });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: "Error fetching clients", error: error.message });
  }
});

// ✅ Assign user to a client with specific role and permissions
router.post("/assign", async (req, res) => {
  try {
    const { userId, clientId, role, permissions } = req.body;

    if (!["client_user", "client_admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role for assignment" });
    }

    // Check if user and client exist
    const user = await User.findById(userId);
    const client = await Client.findById(clientId);
    
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!client) return res.status(404).json({ message: "Client not found" });

    // Check if assignment already exists
    const existingAssignment = await UserCompanyPermissions.findOne({ userId, clientId });
    if (existingAssignment) {
      return res.status(400).json({ message: "User already assigned to this client" });
    }

    const assignment = new UserCompanyPermissions({
      userId,
      clientId,
      role,
      permissions: permissions || [], // Will be set by pre-save middleware if not provided
      assignedBy: req.user.id
    });

    await assignment.save();
    
    const populatedAssignment = await UserCompanyPermissions.findById(assignment._id)
      .populate("userId", "email name role")
      .populate("clientId", "clientName contactEmail");

    res.json({ 
      message: "User assigned to client successfully", 
      assignment: populatedAssignment 
    });
  } catch (error) {
    res.status(500).json({ message: "Error assigning user", error: error.message });
  }
});

// ✅ Get permissions for a specific user
router.get("/user/:userId/permissions", async (req, res) => {
  try {
    const permissions = await UserCompanyPermissions.find({ 
      userId: req.params.userId,
      isActive: true 
    })
      .populate("userId", "email name role")
      .populate("clientId", "clientName contactEmail");

    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user permissions", error: error.message });
  }
});

// ✅ Update user role and permissions for a specific client
router.put("/user/:userId/client/:clientId", async (req, res) => {
  try {
    const { role, permissions } = req.body;

    if (role && !["client_user", "client_admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const assignment = await UserCompanyPermissions.findOneAndUpdate(
      { userId: req.params.userId, clientId: req.params.clientId },
      { 
        ...(role && { role }),
        ...(permissions && { permissions }),
        assignedBy: req.user.id
      },
      { new: true }
    ).populate("userId", "email name role")
     .populate("clientId", "clientName contactEmail");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ message: "Assignment updated successfully", assignment });
  } catch (error) {
    res.status(500).json({ message: "Error updating assignment", error: error.message });
  }
});

// ✅ Remove user from client (deactivate assignment)
router.delete("/user/:userId/client/:clientId", async (req, res) => {
  try {
    const assignment = await UserCompanyPermissions.findOneAndUpdate(
      { userId: req.params.userId, clientId: req.params.clientId },
      { isActive: false },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json({ message: "User removed from client successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error removing user from client", error: error.message });
  }
});

// ✅ Get all users for a specific client
router.get("/client/:clientId/users", async (req, res) => {
  try {
    const users = await UserCompanyPermissions.getClientUsers(req.params.clientId);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching client users", error: error.message });
  }
});

// ✅ Create a new client
router.post("/clients", async (req, res) => {
  try {
    const { clientName, contactPerson, contactEmail } = req.body;
    
    const client = new Client({
      clientName,
      contactPerson,
      contactEmail
    });

    await client.save();
    res.status(201).json({ message: "Client created successfully", client });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Client name already exists" });
    }
    res.status(500).json({ message: "Error creating client", error: error.message });
  }
});

// ✅ Create and send invitation
router.post("/invite", async (req, res) => {
  try {
    const { email, clientId, firstName, companyName, role } = req.body;

    // Validate required fields
    if (!email || !clientId) {
      return res.status(400).json({ message: "Email and client ID are required" });
    }

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Check if there's already a pending invite for this email and client
    const existingInvite = await Invite.findOne({
      email: email.toLowerCase(),
      clientId,
      status: "pending"
    });
    if (existingInvite) {
      return res.status(400).json({ message: "Pending invitation already exists for this email and client" });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days

    // Extract first name for personalized email greeting
    const extractFirstName = (fullName) => {
      if (!fullName) return "";
      return fullName.trim().split(/\s+/)[0]; // Split by whitespace and take first part
    };

    // Create invite
    const invite = await Invite.create({
      email: email.toLowerCase(),
      clientId,
      firstName: extractFirstName(firstName) || "",
      companyName: companyName || client.clientName,
      role: role || "client_user",
      token,
      expiresAt,
      status: "pending",
      emailStatus: "pending",
      invitedBy: req.user.id
    });

    // Send email
    const emailSent = await sendInviteEmail(invite);
    
    if (emailSent) {
      res.json({
        success: true,
        message: "Invite created and email sent successfully",
        invite: {
          id: invite._id,
          email: invite.email,
          companyName: invite.companyName,
          status: invite.status,
          emailStatus: invite.emailStatus,
          expiresAt: invite.expiresAt
        }
      });
    } else {
      res.json({
        success: true,
        message: "Invite created but email sending failed - will retry automatically",
        invite: {
          id: invite._id,
          email: invite.email,
          companyName: invite.companyName,
          status: invite.status,
          emailStatus: invite.emailStatus,
          expiresAt: invite.expiresAt
        }
      });
    }
  } catch (error) {
    console.error("Invite creation error:", error);
    res.status(500).json({ success: false, message: "Error creating invite", error: error.message });
  }
});

// ✅ Get all pending invites
router.get("/invites", async (req, res) => {
  try {
    const invites = await Invite.find({ status: "pending" })
      .populate("clientId", "clientName contactEmail")
      .populate("invitedBy", "email name")
      .sort({ createdAt: -1 });
    
    res.json(invites);
  } catch (error) {
    res.status(500).json({ message: "Error fetching invites", error: error.message });
  }
});

// ✅ Resend invitation email
router.post("/invite/:inviteId/resend", async (req, res) => {
  try {
    const invite = await Invite.findById(req.params.inviteId);
    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status !== "pending") {
      return res.status(400).json({ message: "Can only resend pending invitations" });
    }

    // Reset email status and send again
    invite.emailStatus = "pending";
    invite.emailAttempts = 0;
    invite.emailError = undefined;
    await invite.save();

    const emailSent = await sendInviteEmail(invite);
    
    if (emailSent) {
      res.json({ success: true, message: "Invitation email resent successfully" });
    } else {
      res.json({ success: false, message: "Failed to resend invitation email" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error resending invite", error: error.message });
  }
});

// ✅ Revoke invitation
router.delete("/invite/:inviteId", async (req, res) => {
  try {
    const invite = await Invite.findById(req.params.inviteId);
    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    await invite.markRevoked();
    res.json({ message: "Invitation revoked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error revoking invite", error: error.message });
  }
});

// ✅ Send invitation for existing company
router.post("/company/:companyId/send-invitation", async (req, res) => {
  try {
    const { companyId } = req.params;
    const { email, firstName, role } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if company exists
    const company = await Client.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Check if there's already a pending invite for this email and company
    const existingInvite = await Invite.findOne({
      email: email.toLowerCase(),
      clientId: companyId,
      status: "pending"
    });
    if (existingInvite) {
      return res.status(400).json({ message: "Pending invitation already exists for this email and company" });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days

    // Extract first name for personalized email greeting
    const extractFirstName = (fullName) => {
      if (!fullName) return "";
      return fullName.trim().split(/\s+/)[0]; // Split by whitespace and take first part
    };

    // Create invite
    const invite = await Invite.create({
      email: email.toLowerCase(),
      clientId: companyId,
      firstName: extractFirstName(firstName) || "",
      companyName: company.clientName || company.name,
      role: role || "client_user",
      token,
      expiresAt,
      status: "pending",
      emailStatus: "pending",
      invitedBy: req.user.id
    });

    // Send email
    const emailSent = await sendInviteEmail(invite);
    
    if (emailSent) {
      res.json({
        success: true,
        message: "Invitation sent successfully",
        invite: {
          id: invite._id,
          email: invite.email,
          companyName: invite.companyName,
          status: invite.status,
          emailStatus: invite.emailStatus,
          expiresAt: invite.expiresAt
        }
      });
    } else {
      res.json({
        success: true,
        message: "Invitation created but email sending failed - will retry automatically",
        invite: {
          id: invite._id,
          email: invite.email,
          companyName: invite.companyName,
          status: invite.status,
          emailStatus: invite.emailStatus,
          expiresAt: invite.expiresAt
        }
      });
    }
  } catch (error) {
    console.error("Send invitation error:", error);
    res.status(500).json({ success: false, message: "Error sending invitation", error: error.message });
  }
});

module.exports = router;