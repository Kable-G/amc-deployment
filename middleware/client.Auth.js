// middleware/clientAuth.js
/**
 * Middleware to check if the authenticated user has 'client' or 'admin' role.
 * Assumes the `auth` middleware has already run and attached the user object to `req.user`.
 * The user object must have a `role` property.
 * Used to protect routes accessible only by clients managing their content, or admins.
 */
module.exports = function(req, res, next) {
    // First, ensure auth middleware ran and req.user exists with a role
    if (!req.user || typeof req.user.role === 'undefined') {
      console.warn('ClientAuth middleware: User/Role missing from req.user.');
      // Use 403 Forbidden as the core issue is lack of permission/role info
      return res.status(403).json({ error: 'Forbidden: User role information missing.' });
    }
  
    // Check if the user's role allows client access - updated for new role structure
    const allowedRoles = ['client_user', 'client_admin', 'platform_admin'];
    if (!allowedRoles.includes(req.user.role)) {
      // User is authenticated but does not have the required client or admin role
      console.warn(`ClientAuth middleware: Access denied for user ${req.user.id}. Role: ${req.user.role}`);
      return res.status(403).json({ error: 'Forbidden: Client or Admin access required.' });
    }
  
    // User has appropriate role, allow access
    console.log(`ClientAuth middleware: Check passed for user ${req.user.id}. Role: ${req.user.role}`);
    next(); // Proceed to the next middleware or route handler
  };