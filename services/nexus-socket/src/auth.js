/**
 * Firebase Admin SDK initialization for WebSocket authentication.
 * Verifies Firebase ID tokens on socket connection.
 */

const admin = require('firebase-admin');
const config = require('./config');

// Initialize Firebase Admin — uses Application Default Credentials in GKE,
// or GOOGLE_APPLICATION_CREDENTIALS env var for local development.
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;

  try {
    admin.initializeApp({
      projectId: config.FIREBASE_PROJECT_ID || undefined,
    });
    firebaseInitialized = true;
    console.log('[auth] Firebase Admin initialized');
  } catch (err) {
    console.warn('[auth] Firebase init failed — auth will be disabled:', err.message);
  }
}

/**
 * Socket.IO middleware that verifies Firebase ID tokens.
 * Attaches decoded user info to socket.data.user on success.
 *
 * Usage:
 *   io.use(firebaseAuthMiddleware);
 */
async function firebaseAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.warn('[auth] Connection rejected — no token provided');
    return next(new Error('Authentication required'));
  }

  // Skip Firebase verification if not initialized (local dev mode)
  if (!firebaseInitialized) {
    console.warn('[auth] Firebase not initialized — allowing connection in dev mode');
    socket.data.user = { uid: 'dev-user', email: 'dev@nexus.local', name: 'Dev User' };
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    socket.data.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email,
      picture: decoded.picture || '',
    };
    console.log(`[auth] Authenticated: ${decoded.email}`);
    next();
  } catch (err) {
    console.warn(`[auth] Token verification failed: ${err.message}`);
    next(new Error('Invalid authentication token'));
  }
}

module.exports = { initFirebase, firebaseAuthMiddleware };
