// middleware/admin.js
/**
 * Middleware to check if the authenticated user has an 'admin' role.
 * Assumes the `auth` middleware has already run and attached the user object to `req.user`.
 * The user object must have a `role` property.
 */
module.exports = function(req, res, next) {
    // Check if req.user exists and if the role is 'admin'
    // Add defensive checks in case the auth middleware failed silently or user structure is wrong
    if (!req.user || typeof req.user.role === 'undefined') {
      console.warn('Admin middleware called without req.user or req.user.role being set.');
      // Return 403 Forbidden because even if auth passed, role info is missing for admin check
      return res.status(403).json({ error: 'Forbidden: User role information missing.' });
    }
  
    // IMPORTANT: Check if user has platform admin role
    if (req.user.role !== 'platform_admin') {
      // User is authenticated but does not have the required admin role
      console.warn(`Admin access denied for user ${req.user.id}. Role: ${req.user.role}`); // Log denial
      return res.status(403).json({ error: 'Forbidden: Platform admin access required.' });
    }
  
    // User has the 'platform_admin' role, proceed to the next middleware or route handler
    console.log(`Admin check passed for user: ${req.user.id}`); // Optional: Log success
    next(); // Let the request continue
  };