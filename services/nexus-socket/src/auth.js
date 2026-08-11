/**
 * JWT authentication middleware for WebSocket connections.
 * Verifies JWT tokens on socket connection.
 */

const jwt = require('jsonwebtoken');

// Load JWT secret from environment
const isProd = process.env.ENV === 'production';
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (isProd) {
    console.error('Missing required environment variable in production: JWT_SECRET');
    process.exit(1);
  }
  JWT_SECRET = 'supersecret-dev-key';
}

/**
 * Socket.IO middleware that verifies JWT tokens.
 * Attaches decoded user info to socket.data.user on success.
 *
 * Usage:
 *   io.use(jwtAuthMiddleware);
 */
async function jwtAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.warn('[auth] Connection rejected — no token provided');
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.data.user = {
      uid: decoded.user_id,
      email: decoded.email,
      name: decoded.email, // We didn't encode display_name in JWT, use email as fallback
      picture: '',
    };
    console.log(`[auth] Authenticated: ${decoded.email}`);
    next();
  } catch (err) {
    console.warn(`[auth] Token verification failed: ${err.message}`);
    next(new Error('Invalid authentication token'));
  }
}

module.exports = { jwtAuthMiddleware };
