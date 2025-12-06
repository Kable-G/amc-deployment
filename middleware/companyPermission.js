const Company = require("../models/Company");
const User = require("../models/User");

// Middleware to enforce company scope and prevent cross-tenant access
const enforceCompanyScope = (req, res, next) => {
  const { role, clientId } = req.user;
  
  // Platform admin has access to all companies
  if (role === "platform_admin") {
    return next();
  }
  
  // Media users don't have company access
  if (role === "media_user") {
    return res.status(403).json({
      success: false,
      error: "Access denied: media users cannot access company resources"
    });
  }
  
  // Client users and admins must have a clientId
  if (!clientId) {
    return res.status(403).json({
      success: false,
      error: "Access denied: no company association found"
    });
  }
  
  // Attach company scope to request for controllers to use
  req.companyScope = { clientId };
  next();
};

// Middleware to check if user can access specific company
const requireCompanyAccess = (paramName = 'companyId') => {
  return async (req, res, next) => {
    try {
      const targetCompanyId = req.params[paramName];
      const { role, clientId } = req.user;
      
      // Platform admin has access to all companies
      if (role === "platform_admin") {
        return next();
      }
      
      // Client admin/user must belong to the target company
      if ((role === "client_admin" || role === "client_user") && 
          clientId && 
          clientId.toString() === targetCompanyId) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        error: "Access denied: insufficient permissions for this company"
      });
      
    } catch (error) {
      console.error("Error in requireCompanyAccess middleware:", error);
      return res.status(500).json({
        success: false,
        error: "Server error while checking company access"
      });
    }
  };
};

// Middleware to check if company is active and can operate
const requireActiveCompany = async (req, res, next) => {
  try {
    const companyId = req.params.companyId || req.params.id;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: "Company ID is required"
      });
    }
    
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }
    
    // Check if company can operate (active status and billing OK)
    if (!company.canOperate()) {
      return res.status(403).json({
        success: false,
        error: `Company is ${company.status} and cannot perform this operation`,
        companyStatus: company.status,
        billingStatus: company.billingStatus
      });
    }
    
    // Attach company to request for controllers
    req.company = company;
    next();
    
  } catch (error) {
    console.error("Error in requireActiveCompany middleware:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while checking company status"
    });
  }
};

// Middleware to check if user has specific role within their company
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const { role } = req.user;
    
    // Platform admin always has access
    if (role === "platform_admin") {
      return next();
    }
    
    // Check if user has any of the allowed roles
    if (allowedRoles.includes(role)) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: "Access denied: insufficient role permissions",
      requiredRoles: allowedRoles,
      userRole: role
    });
  };
};

// Middleware to prevent users from modifying themselves in certain ways
const preventSelfModification = (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user._id.toString();
  
  // Allow platform admin to modify anyone
  if (req.user.role === "platform_admin") {
    return next();
  }
  
  // Prevent self-modification for certain operations
  if (targetUserId === currentUserId) {
    const { role, isActive } = req.body;
    
    // Prevent self-demotion from admin role
    if (role && req.user.role === "client_admin" && role !== "client_admin") {
      return res.status(400).json({
        success: false,
        error: "Cannot demote yourself from client_admin role"
      });
    }
    
    // Prevent self-deactivation
    if (isActive === false) {
      return res.status(400).json({
        success: false,
        error: "Cannot deactivate your own account"
      });
    }
  }
  
  next();
};

// Middleware to ensure at least one admin remains in company
const ensureAdminExists = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const companyId = req.params.companyId;
    
    // Only check when removing or demoting an admin
    const { role, isActive } = req.body;
    const isRemoval = req.method === 'DELETE';
    const isDemotion = role && role !== "client_admin";
    const isDeactivation = isActive === false;
    
    if (isRemoval || isDemotion || isDeactivation) {
      // Check if target user is currently an admin
      const targetUser = await User.findById(targetUserId);
      
      if (targetUser && targetUser.role === "client_admin") {
        // Count remaining active admins
        const adminCount = await User.countDocuments({
          clientId: companyId,
          role: "client_admin",
          isActive: true,
          _id: { $ne: targetUserId } // Exclude the target user
        });
        
        if (adminCount === 0) {
          return res.status(400).json({
            success: false,
            error: "Cannot remove the last client_admin. Assign another admin first."
          });
        }
      }
    }
    
    next();
    
  } catch (error) {
    console.error("Error in ensureAdminExists middleware:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while checking admin requirements"
    });
  }
};

// Middleware to check company user limits before inviting
const checkUserLimits = async (req, res, next) => {
  try {
    const companyId = req.params.companyId;
    
    if (!companyId) {
      return next(); // Skip if no company context
    }
    
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: "Company not found"
      });
    }
    
    // Count current active users
    const currentUserCount = await User.countDocuments({
      clientId: companyId,
      isActive: true
    });
    
    // Check against company limits
    if (currentUserCount >= company.settings.maxUsers) {
      return res.status(400).json({
        success: false,
        error: `Company has reached maximum user limit of ${company.settings.maxUsers}`,
        currentUsers: currentUserCount,
        maxUsers: company.settings.maxUsers
      });
    }
    
    // Attach counts to request for controllers
    req.userCounts = {
      current: currentUserCount,
      max: company.settings.maxUsers,
      remaining: company.settings.maxUsers - currentUserCount
    };
    
    next();
    
  } catch (error) {
    console.error("Error in checkUserLimits middleware:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while checking user limits"
    });
  }
};

module.exports = {
  enforceCompanyScope,
  requireCompanyAccess,
  requireActiveCompany,
  requireRole,
  preventSelfModification,
  ensureAdminExists,
  checkUserLimits
};