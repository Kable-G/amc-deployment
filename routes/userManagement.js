const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Company = require("../models/Company");
const User = require("../models/User");
const PublicUser = require("../models/PublicUser");
const Invite = require("../models/Invite");
const AuditEvent = require("../models/AuditEvent");
const UserCompanyPermissions = require("../models/UserCompanyPermissions");
const { authenticate } = require("../middleware/authMiddleware");
const {
  inviteCreationLimiter,
  inviteResendLimiter,
  userRoleChangeLimiter,
  userDeletionLimiter,
  generalApiLimiter,
  checkRecentViolations
} = require("../middleware/rateLimiter");

// Middleware to ensure company access (platform admin or client admin for specific company)
function requireCompanyAccess(req, res, next) {
  const companyId = req.params.companyId;
  
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

// Apply authentication and general rate limiting to all user management routes
router.use(authenticate);
router.use(generalApiLimiter);

// ✅ PLATFORM ADMIN ROUTES - Get all users across all companies (MUST BE BEFORE PARAMETERIZED ROUTES)

// GET /api/v1/user-management/admin/users - Get ALL users for platform admin (with company population)
router.get("/admin/users", async (req, res) => {
  try {
    console.log('🔍 DEBUG: /admin/users route called');
    console.log('🔍 DEBUG: User role:', req.user?.role);
    
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      console.log('❌ DEBUG: Access denied - not platform admin');
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    const { page = 1, limit = 100, role, status, sortBy = 'createdAt' } = req.query;
    console.log('🔍 DEBUG: Query params:', { page, limit, role, status, sortBy });
    
    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    console.log('🔍 DEBUG: Filter:', filter);

    console.log('🔍 DEBUG: About to query users from both collections...');
    
    // Query User and PublicUser collections
    const [users, publicUsers] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ [sortBy]: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit)),
      PublicUser.find(filter)
        .select('-password')
        .sort({ [sortBy]: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
    ]);

    // Normalize PublicUser data to match User schema format
    const normalizedPublicUsers = publicUsers.map(user => ({
      _id: user._id,
      email: user.email,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      firstName: user.firstName,
      lastName: user.lastName,
      role: 'media_user', // PublicUsers are media users
      isActive: user.isActive !== false,
      lastLoginAt: user.lastLogin, // PublicUser uses 'lastLogin', User uses 'lastLoginAt'
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      clientId: null // Media users don't have company associations
    }));

    // Merge and sort all users
    const allUsers = [...users, ...normalizedPublicUsers]
      .sort((a, b) => new Date(b[sortBy]) - new Date(a[sortBy]))
      .slice(0, parseInt(limit));

    console.log('🔍 DEBUG: Users found:', users.length);
    console.log('🔍 DEBUG: PublicUsers found:', publicUsers.length);
    console.log('🔍 DEBUG: Total merged users:', allUsers.length);

    // Get total counts from both collections
    const [userTotal, publicUserTotal] = await Promise.all([
      User.countDocuments(filter),
      PublicUser.countDocuments(filter)
    ]);
    const total = userTotal + publicUserTotal;
    console.log('🔍 DEBUG: Total count:', total);

    // Calculate role-based statistics from both collections
    const [userStats, publicUserStats] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),
      PublicUser.countDocuments({}) // All PublicUsers are media_users
    ]);

    const roleStats = {
      totalUsers: total,
      mediaUsers: publicUserStats, // Start with all PublicUsers as media users
      clientUsers: 0,
      clientAdmins: 0,
      platformAdmins: 0
    };

    // Process User collection stats
    userStats.forEach(stat => {
      switch (stat._id) {
        case 'media_user':
          roleStats.mediaUsers += stat.count; // Add User collection media_users
          break;
        case 'client_user':
          roleStats.clientUsers = stat.count;
          break;
        case 'client_admin':
          roleStats.clientAdmins = stat.count;
          break;
        case 'platform_admin':
          roleStats.platformAdmins = stat.count;
          break;
      }
    });

    res.json({
      success: true,
      users: allUsers, // Use merged users from both collections
      stats: roleStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching users"
    });
  }
});

// GET /api/v1/user-management/admin/users/stats - Get user statistics for platform admin
router.get("/admin/users/stats", async (req, res) => {
  try {
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    // Get current month start date
    const currentDate = new Date();
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Get total counts by role from both collections
    const [totalUserStats, totalPublicUserStats, monthlyUserStats, monthlyPublicUserStats] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),
      PublicUser.countDocuments({}), // All PublicUsers are media_users
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart }
          }
        },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),
      PublicUser.countDocuments({
        createdAt: { $gte: monthStart }
      }) // Monthly PublicUser growth
    ]);

    // Process stats
    const roleStats = {
      totalUsers: 0,
      mediaUsers: 0,
      clientUsers: 0,
      clientAdmins: 0,
      platformAdmins: 0,
      totalUsersChange: 0,
      mediaUsersChange: 0,
      clientUsersChange: 0,
      clientAdminsChange: 0,
      platformAdminsChange: 0
    };

    // Process total stats from User collection
    totalUserStats.forEach(stat => {
      roleStats.totalUsers += stat.count;
      switch (stat._id) {
        case 'media_user':
          roleStats.mediaUsers = stat.count;
          break;
        case 'client_user':
          roleStats.clientUsers = stat.count;
          break;
        case 'client_admin':
          roleStats.clientAdmins = stat.count;
          break;
        case 'platform_admin':
          roleStats.platformAdmins = stat.count;
          break;
      }
    });

    // Add PublicUser stats (all are media_users)
    roleStats.totalUsers += totalPublicUserStats;
    roleStats.mediaUsers += totalPublicUserStats;

    // Process monthly growth from User collection
    monthlyUserStats.forEach(stat => {
      roleStats.totalUsersChange += stat.count;
      switch (stat._id) {
        case 'media_user':
          roleStats.mediaUsersChange = stat.count;
          break;
        case 'client_user':
          roleStats.clientUsersChange = stat.count;
          break;
        case 'client_admin':
          roleStats.clientAdminsChange = stat.count;
          break;
        case 'platform_admin':
          roleStats.platformAdminsChange = stat.count;
          break;
      }
    });

    // Add PublicUser monthly growth (all are media_users)
    roleStats.totalUsersChange += monthlyPublicUserStats;
    roleStats.mediaUsersChange += monthlyPublicUserStats;

    res.json({
      success: true,
      ...roleStats
    });

  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching user statistics"
    });
  }
});

// ✅ PLATFORM ADMIN BULK OPERATIONS - Add missing endpoints for user management UI

// POST /api/v1/user-management/admin/users/bulk-suspend - Bulk suspend users
router.post("/admin/users/bulk-suspend", async (req, res) => {
  try {
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "userIds array is required"
      });
    }

    // Update multiple users to suspended status
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { isActive: false } }
    );

    // Log the bulk action
    await AuditEvent.logEvent({
      clientId: null, // Platform admin action
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.suspended",
      targetType: "user",
      targetId: userIds.join(','),
      metadata: {
        userCount: userIds.length,
        bulkOperation: true,
        suspendedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} users suspended successfully`
    });

  } catch (error) {
    console.error("Error bulk suspending users:", error);
    res.status(500).json({
      success: false,
      error: "Server error while suspending users"
    });
  }
});

// POST /api/v1/user-management/admin/users/bulk-activate - Bulk activate users
router.post("/admin/users/bulk-activate", async (req, res) => {
  try {
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "userIds array is required"
      });
    }

    // Update multiple users to active status
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { isActive: true } }
    );

    // Log the bulk action
    await AuditEvent.logEvent({
      clientId: null, // Platform admin action
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.reactivated",
      targetType: "user",
      targetId: userIds.join(','),
      metadata: {
        userCount: userIds.length,
        bulkOperation: true,
        activatedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} users activated successfully`
    });

  } catch (error) {
    console.error("Error bulk activating users:", error);
    res.status(500).json({
      success: false,
      error: "Server error while activating users"
    });
  }
});

// DELETE /api/v1/user-management/admin/users/bulk-delete - Bulk delete users
router.delete("/admin/users/bulk-delete", async (req, res) => {
  try {
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "userIds array is required"
      });
    }

    // Get user details before deletion for audit log
    const usersToDelete = await User.find({ _id: { $in: userIds } }).select('email role');

    // Permanently delete users from database
    const result = await User.deleteMany({ _id: { $in: userIds } });

    // Log the bulk deletion
    await AuditEvent.logEvent({
      clientId: null, // Platform admin action
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.deleted",
      targetType: "user",
      targetId: userIds.join(','),
      metadata: {
        userCount: userIds.length,
        bulkOperation: true,
        deletedUsers: usersToDelete.map(u => ({ email: u.email, role: u.role })),
        deletedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: `${result.deletedCount} users deleted successfully`
    });

  } catch (error) {
    console.error("Error bulk deleting users:", error);
    res.status(500).json({
      success: false,
      error: "Server error while deleting users"
    });
  }
});

// POST /api/v1/user-management/admin/users/:id/suspend - Suspend individual user
router.post("/admin/users/:id/suspend", async (req, res) => {
  try {
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    const { id } = req.params;

    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Log the action
    await AuditEvent.logEvent({
      clientId: user.clientId || null,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.suspended",
      targetType: "user",
      targetId: id,
      metadata: {
        targetUserEmail: user.email,
        targetUserRole: user.role,
        suspendedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "User suspended successfully",
      user: user
    });

  } catch (error) {
    console.error("Error suspending user:", error);
    res.status(500).json({
      success: false,
      error: "Server error while suspending user"
    });
  }
});

// POST /api/v1/user-management/admin/users/:id/activate - Activate individual user
router.post("/admin/users/:id/activate", async (req, res) => {
  try {
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    const { id } = req.params;

    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Log the action
    await AuditEvent.logEvent({
      clientId: user.clientId || null,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.reactivated",
      targetType: "user",
      targetId: id,
      metadata: {
        targetUserEmail: user.email,
        targetUserRole: user.role,
        activatedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "User activated successfully",
      user: user
    });

  } catch (error) {
    console.error("Error activating user:", error);
    res.status(500).json({
      success: false,
      error: "Server error while activating user"
    });
  }
});

// DELETE /api/v1/user-management/admin/users/:id - Delete individual user
router.delete("/admin/users/:id", async (req, res) => {
  try {
    // Check if user is platform admin
    if (req.user.role !== 'platform_admin') {
      return res.status(403).json({
        success: false,
        error: "Access denied: Platform admin access required"
      });
    }

    const { id } = req.params;

    // Get user details before deletion for audit log
    const user = await User.findById(id).select('email role clientId');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Permanently delete user from database
    await User.findByIdAndDelete(id);

    // Log the deletion
    await AuditEvent.logEvent({
      clientId: user.clientId || null,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.deleted",
      targetType: "user",
      targetId: id,
      metadata: {
        targetUserEmail: user.email,
        targetUserRole: user.role,
        deletedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      error: "Server error while deleting user"
    });
  }
});

// ✅ 3. USER MANAGEMENT PER COMPANY (Client Admin Self-Service)

// GET /api/companies/:companyId/users - List all users under company
router.get("/:companyId/users", requireCompanyAccess, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 20, role, status } = req.query;

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Build query
    const query = { clientId: companyId };
    if (role) query.role = role;
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await User.countDocuments(query);

    // Get additional permissions for each user
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        const permissions = await UserCompanyPermissions.findOne({
          userId: user._id,
          clientId: companyId,
          isActive: true
        });

        return {
          ...user.toObject(),
          permissions: permissions ? permissions.permissions : [],
          permissionRole: permissions ? permissions.role : user.role
        };
      })
    );

    res.json({
      success: true,
      users: usersWithPermissions,
      company: {
        id: company._id,
        name: company.name,
        companyId: company.companyId
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching company users:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching users"
    });
  }
});

// POST /api/companies/:companyId/users/invite - Client admin invites new user
router.post("/:companyId/users/invite", requireCompanyAccess, inviteCreationLimiter, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { email, role = "client_user", permissions } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required"
      });
    }

    if (!["client_user", "client_admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Must be client_user or client_admin"
      });
    }

    // Verify company exists and is active
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    if (!company.canOperate()) {
      return res.status(403).json({
        success: false,
        error: "Company is not active and cannot invite users"
      });
    }

    // Check if user already exists in this company
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      clientId: companyId,
      isActive: true
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User is already a member of this company"
      });
    }

    // Check if there's already a pending invite
    const existingInvite = await Invite.findOne({
      email: email.toLowerCase(),
      clientId: companyId,
      status: "pending"
    });

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        error: "There is already a pending invitation for this email"
      });
    }

    // Check company user limits
    const currentUserCount = await User.countDocuments({
      clientId: companyId,
      isActive: true
    });

    if (currentUserCount >= company.settings.maxUsers) {
      return res.status(400).json({
        success: false,
        error: `Company has reached maximum user limit of ${company.settings.maxUsers}`
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Create the invitation
    const invite = await Invite.create({
      email: email.toLowerCase(),
      clientId: companyId,
      role,
      token,
      invitedBy: req.user._id
    });

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.sent",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: { 
        email, 
        role, 
        companyName: company.name,
        invitedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    // TODO: Send email with invitation link
    // await sendInviteEmail(email, token, company.name, role);

    res.status(201).json({
      success: true,
      message: "Invitation sent successfully",
      invite: {
        id: invite._id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/accept-invite?token=${token}`
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

// PATCH /api/companies/:companyId/users/:userId - Update user role or permissions
router.patch("/:companyId/users/:userId", requireCompanyAccess, userRoleChangeLimiter, async (req, res) => {
  try {
    const { companyId, userId } = req.params;
    const { role, permissions, isActive } = req.body;

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Find the user
    const user = await User.findOne({
      _id: userId,
      clientId: companyId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found in this company"
      });
    }

    // Prevent self-demotion from client_admin
    if (req.user._id.toString() === userId && 
        req.user.role === "client_admin" && 
        role && role !== "client_admin") {
      return res.status(400).json({
        success: false,
        error: "Cannot demote yourself from client_admin role"
      });
    }

    // Track changes for audit
    const changes = {};
    if (role && role !== user.role) changes.role = { from: user.role, to: role };
    if (isActive !== undefined && isActive !== user.isActive) changes.isActive = { from: user.isActive, to: isActive };

    // Update user basic info
    const updateData = {};
    if (role && ["client_user", "client_admin"].includes(role)) {
      updateData.role = role;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length > 0) {
      await User.findByIdAndUpdate(userId, updateData);
    }

    // Update or create UserCompanyPermissions if permissions provided
    if (permissions && Array.isArray(permissions)) {
      await UserCompanyPermissions.findOneAndUpdate(
        { userId, clientId: companyId },
        { 
          role: role || user.role,
          permissions,
          assignedBy: req.user._id,
          isActive: isActive !== undefined ? isActive : true
        },
        { upsert: true, new: true }
      );
      changes.permissions = { to: permissions };
    }

    // Get updated user with permissions
    const updatedUser = await User.findById(userId).select('-password');
    const userPermissions = await UserCompanyPermissions.findOne({
      userId,
      clientId: companyId,
      isActive: true
    });

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.role_changed",
      targetType: "user",
      targetId: userId,
      metadata: { 
        changes,
        targetUserEmail: updatedUser.email,
        updatedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        ...updatedUser.toObject(),
        permissions: userPermissions ? userPermissions.permissions : [],
        permissionRole: userPermissions ? userPermissions.role : updatedUser.role
      }
    });

  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      error: "Server error while updating user"
    });
  }
});

// DELETE /api/companies/:companyId/users/:userId - Remove user (revoke access)
router.delete("/:companyId/users/:userId", requireCompanyAccess, userDeletionLimiter, async (req, res) => {
  try {
    const { companyId, userId } = req.params;
    const { reason } = req.body;

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Find the user
    const user = await User.findOne({
      _id: userId,
      clientId: companyId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found in this company"
      });
    }

    // Prevent self-deletion
    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        error: "Cannot remove yourself from the company"
      });
    }

    // Check if this is the last client_admin
    if (user.role === "client_admin") {
      const adminCount = await User.countDocuments({
        clientId: companyId,
        role: "client_admin",
        isActive: true
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: "Cannot remove the last client_admin. Assign another admin first."
        });
      }
    }

    // Convert user to media_user (safe deletion approach)
    await User.findByIdAndUpdate(userId, {
      role: "media_user",
      clientId: null,
      isActive: true // Keep them active as media_user
    });

    // Deactivate their company permissions
    await UserCompanyPermissions.findOneAndUpdate(
      { userId, clientId: companyId },
      { isActive: false }
    );

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.deleted",
      targetType: "user",
      targetId: userId,
      metadata: { 
        targetUserEmail: user.email,
        previousRole: user.role,
        convertedTo: "media_user",
        reason,
        removedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "User removed from company successfully. They have been converted to a media_user."
    });

  } catch (error) {
    console.error("Error removing user:", error);
    res.status(500).json({
      success: false,
      error: "Server error while removing user"
    });
  }
});

// GET /api/companies/:companyId/invites - Get pending invitations for company
router.get("/:companyId/invites", requireCompanyAccess, async (req, res) => {
  try {
    const { companyId } = req.params;

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    // Get pending invites
    const invites = await Invite.find({
      clientId: companyId,
      status: 'pending'
    }).populate('invitedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invites: invites.map(invite => ({
        id: invite._id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        invitedBy: invite.invitedBy
      }))
    });

  } catch (error) {
    console.error("Error fetching invites:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching invites"
    });
  }
});

// DELETE /api/companies/:companyId/invites/:inviteId - Cancel invitation
router.delete("/:companyId/invites/:inviteId", requireCompanyAccess, async (req, res) => {
  try {
    const { companyId, inviteId } = req.params;

    // Find the invite
    const invite = await Invite.findOne({
      _id: inviteId,
      clientId: companyId,
      status: 'pending'
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Pending invitation not found"
      });
    }

    // Mark as expired
    invite.status = 'expired';
    await invite.save();

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.revoked",
      targetType: "invite",
      targetId: inviteId,
      metadata: { 
        email: invite.email,
        role: invite.role,
        reason: "cancelled_by_client_admin"
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Invitation cancelled successfully"
    });

  } catch (error) {
    console.error("Error cancelling invite:", error);
    res.status(500).json({
      success: false,
      error: "Server error while cancelling invitation"
    });
  }
});

// ✅ ENHANCED INVITATION LIFECYCLE MANAGEMENT ROUTES

// GET /api/v1/user-management/users - Get users for current user's company
router.get("/users", async (req, res) => {
  try {
    // Get user's company ID
    const companyId = req.user.clientId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "User is not associated with any company"
      });
    }

    // Build query
    const query = { clientId: companyId };

    // Execute query
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.isActive ? 'active' : 'inactive',
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching users"
    });
  }
});

// GET /api/v1/user-management/invitations - Get pending invitations for current user's company
router.get("/invitations", async (req, res) => {
  try {
    // Get user's company ID
    const companyId = req.user.clientId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "User is not associated with any company"
      });
    }

    // Get pending invites only
    const invites = await Invite.find({
      clientId: companyId,
      status: 'pending'
    }).populate('invitedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        invitations: invites.map(invite => ({
          _id: invite._id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          invitedBy: invite.invitedBy
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching invitations"
    });
  }
});

// GET /api/v1/user-management/invitations/all - Get ALL invitations (pending, accepted, expired, revoked)
router.get("/invitations/all", async (req, res) => {
  try {
    // Get user's company ID
    const companyId = req.user.clientId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "User is not associated with any company"
      });
    }

    // Get all invites for the company
    const invites = await Invite.find({
      clientId: companyId
    }).populate('invitedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        invitations: invites.map(invite => ({
          _id: invite._id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          redeemedAt: invite.redeemedAt,
          revokedAt: invite.revokedAt,
          invitedBy: invite.invitedBy
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching all invitations:", error);
    res.status(500).json({
      success: false,
      error: "Server error while fetching invitations"
    });
  }
});

// POST /api/v1/user-management/invite - Send invitation (simplified endpoint)
router.post("/invite", inviteCreationLimiter, async (req, res) => {
  try {
    // Get user's company ID
    const companyId = req.user.clientId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "User is not associated with any company"
      });
    }

    const { email, role = "client_user", permissions } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required"
      });
    }

    if (!["client_user", "client_admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Must be client_user or client_admin"
      });
    }

    // Verify company exists and is active
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }

    if (!company.canOperate()) {
      return res.status(403).json({
        success: false,
        error: "Company is not active and cannot invite users"
      });
    }

    // Check if user already exists in this company
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      clientId: companyId,
      isActive: true
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User is already a member of this company"
      });
    }

    // Check if there's already a pending invite
    const existingInvite = await Invite.findOne({
      email: email.toLowerCase(),
      clientId: companyId,
      status: "pending"
    });

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        error: "There is already a pending invitation for this email"
      });
    }

    // Check company user limits
    const currentUserCount = await User.countDocuments({
      clientId: companyId,
      isActive: true
    });

    if (currentUserCount >= company.settings.maxUsers) {
      return res.status(400).json({
        success: false,
        error: `Company has reached maximum user limit of ${company.settings.maxUsers}`
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Create the invitation
    const invite = await Invite.create({
      email: email.toLowerCase(),
      clientId: companyId,
      role,
      token,
      invitedBy: req.user._id
    });

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.sent",
      targetType: "invite",
      targetId: invite._id.toString(),
      metadata: {
        email,
        role,
        companyName: company.name,
        invitedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    // TODO: Send email with invitation link
    // await sendInviteEmail(email, token, company.name, role);

    res.status(201).json({
      success: true,
      message: "Invitation sent successfully",
      data: {
        invite: {
          id: invite._id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite-accept.html?token=${token}`
        }
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

// POST /api/v1/user-management/invitations/:inviteId/resend - Resend invitation
router.post("/invitations/:inviteId/resend", async (req, res) => {
  try {
    // Get user's company ID
    const companyId = req.user.clientId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "User is not associated with any company"
      });
    }

    const { inviteId } = req.params;

    // Find the invite
    const invite = await Invite.findOne({
      _id: inviteId,
      clientId: companyId
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Invitation not found"
      });
    }

    // Check if invite can be resent (pending or expired)
    if (!['pending', 'expired'].includes(invite.status)) {
      return res.status(400).json({
        success: false,
        error: "Only pending or expired invitations can be resent"
      });
    }

    // Generate new token and reset expiry
    const newToken = crypto.randomBytes(32).toString("hex");
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 7); // 7 days from now

    // Update the invitation
    invite.token = newToken;
    invite.expiresAt = newExpiryDate;
    invite.status = 'pending';
    invite.revokedAt = null; // Clear any revocation
    await invite.save();

    // Get company info for email
    const company = await Company.findById(companyId);

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.resent",
      targetType: "invite",
      targetId: inviteId,
      metadata: {
        email: invite.email,
        role: invite.role,
        companyName: company?.name,
        resentByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    // TODO: Send email with new invitation link
    // await sendInviteEmail(invite.email, newToken, company.name, invite.role);

    res.json({
      success: true,
      message: "Invitation resent successfully",
      data: {
        invite: {
          id: invite._id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite-accept.html?token=${newToken}`
        }
      }
    });

  } catch (error) {
    console.error("Error resending invitation:", error);
    res.status(500).json({
      success: false,
      error: "Server error while resending invitation"
    });
  }
});

// DELETE /api/v1/user-management/invitations/:inviteId - Cancel invitation
router.delete("/invitations/:inviteId", async (req, res) => {
  try {
    // Get user's company ID
    const companyId = req.user.clientId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "User is not associated with any company"
      });
    }

    const { inviteId } = req.params;

    // Find the invite
    const invite = await Invite.findOne({
      _id: inviteId,
      clientId: companyId,
      status: 'pending'
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "Pending invitation not found"
      });
    }

    // Mark as revoked
    invite.status = 'revoked';
    invite.revokedAt = new Date();
    await invite.save();

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "invite.revoked",
      targetType: "invite",
      targetId: inviteId,
      metadata: {
        email: invite.email,
        role: invite.role,
        reason: "cancelled_by_client_admin"
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "Invitation cancelled successfully"
    });

  } catch (error) {
    console.error("Error cancelling invite:", error);
    res.status(500).json({
      success: false,
      error: "Server error while cancelling invitation"
    });
  }
});

// DELETE /api/v1/user-management/users/:userId - Remove user from company
router.delete("/users/:userId", async (req, res) => {
  try {
    // Get user's company ID
    const companyId = req.user.clientId || req.user.companyId;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "User is not associated with any company"
      });
    }

    const { userId } = req.params;
    const { reason } = req.body;

    // Find the user
    const user = await User.findOne({
      _id: userId,
      clientId: companyId
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found in this company"
      });
    }

    // Prevent self-deletion
    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        error: "Cannot remove yourself from the company"
      });
    }

    // Check if this is the last client_admin
    if (user.role === "client_admin") {
      const adminCount = await User.countDocuments({
        clientId: companyId,
        role: "client_admin",
        isActive: true
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: "Cannot remove the last client_admin. Assign another admin first."
        });
      }
    }

    // Convert user to media_user (safe deletion approach)
    await User.findByIdAndUpdate(userId, {
      role: "media_user",
      clientId: null,
      isActive: true // Keep them active as media_user
    });

    // Deactivate their company permissions
    await UserCompanyPermissions.findOneAndUpdate(
      { userId, clientId: companyId },
      { isActive: false }
    );

    // Log the event
    await AuditEvent.logEvent({
      clientId: companyId,
      userId: req.user._id,
      emailSnapshot: req.user.email,
      action: "user.deleted",
      targetType: "user",
      targetId: userId,
      metadata: {
        targetUserEmail: user.email,
        previousRole: user.role,
        convertedTo: "media_user",
        reason,
        removedByRole: req.user.role
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.json({
      success: true,
      message: "User removed from company successfully. They have been converted to a media_user."
    });

  } catch (error) {
    console.error("Error removing user:", error);
    res.status(500).json({
      success: false,
      error: "Server error while removing user"
    });
  }
});


module.exports = router;