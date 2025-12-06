// middleware/auth.js

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv'); // To access environment variables

// Load environment variables (needed to get JWT_SECRET)
dotenv.config();

/**
 * Middleware to authenticate requests using JSON Web Tokens (JWT).
 * Expects the token to be sent in the Authorization header as 'Bearer <token>'.
 * If valid, decodes the token and attaches the user payload to `req.user`.
 * If invalid or missing, sends a 401 Unauthorized response.
 */
module.exports = function(req, res, next) {
  // 1. Get token from header
  const authHeader = req.header('Authorization');
  console.log('Auth middleware: Received Authorization header:', authHeader); // Log for debugging

  // 2. Check if token exists in the expected format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Auth middleware: No token found or incorrect format.');
    return res.status(401).json({ error: 'Unauthorized: No token provided or invalid format.' });
  }

  // Extract the token part (remove 'Bearer ')
  const token = authHeader.split(' ')[1];
  if (!token) {
      console.warn('Auth middleware: Token format correct, but token value is missing.');
      return res.status(401).json({ error: 'Unauthorized: Token value missing.' });
  }
  // console.log('Auth middleware: Extracted token:', token); // Optional: Log token value (be careful in production)

  // 3. Verify token
  try {
    // Get the secret key from environment variables
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      // This is a server configuration error
      console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
      return res.status(500).json({ error: 'Server configuration error: JWT Secret missing.' });
    }

    // Verify the token using the secret key
    // jwt.verify throws an error if the token is invalid or expired
    const decoded = jwt.verify(token, jwtSecret);

    // 4. Attach user payload to request object
    // IMPORTANT: Handle both payload structures for compatibility
    let userPayload;
    
    if (decoded.user && decoded.user.id && decoded.user.role) {
        // New structure: { user: { id, role, clientId? } }
        userPayload = decoded.user;
    } else if (decoded.userId && decoded.role) {
        // Legacy structure: { userId, role, clientId? }
        userPayload = {
            id: decoded.userId,
            role: decoded.role,
            ...(decoded.clientId && { clientId: decoded.clientId })
        };
    } else {
        console.error('Auth middleware: Decoded JWT payload is missing required user data. Payload:', decoded);
        return res.status(401).json({ error: 'Unauthorized: Invalid token payload structure.' });
    }

    req.user = userPayload; // Attach the user object to the request

    // ***** ADDED THIS BLOCK FOR TESTING *****
    console.log(
        ">>>> [middleware/auth.js] req.user (from token payload):", 
        JSON.stringify(req.user, null, 2) // Using JSON.stringify for pretty print
    ); 
    // ***** END OF ADDED BLOCK *****
    
    // MODIFIED existing log to include clientId if present
    console.log(`Auth middleware: Token verified. User ID: ${req.user.id}, Role: ${req.user.role}, ClientID: ${req.user.clientId || 'N/A'}`);


    // 5. Call next middleware
    next();

  } catch (err) {
    // Handle errors during verification (e.g., invalid signature, expired token)
    console.warn('Auth middleware: Token verification failed.', err.message);
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Unauthorized: Token has expired.' });
    }
    if (err.name === 'JsonWebTokenError') {
         return res.status(401).json({ error: 'Unauthorized: Invalid token signature.' });
    }
    // Handle other potential errors
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }
};