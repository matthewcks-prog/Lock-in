/**
 * Centralised configuration for the Lock-in backend.
 *
 * NOTE:
 * - All environment variable access should go through this module.
 * - This keeps configuration in one place and makes it easier to test.
 */

const PORT = process.env.PORT || 3000;

// Request/body limits
const MAX_SELECTION_LENGTH = 5000;
const MAX_USER_MESSAGE_LENGTH = 1500;

// Per-user rate limiting (requests per UTC day)
const DAILY_REQUEST_LIMIT =
  parseInt(process.env.DAILY_REQUEST_LIMIT, 10) || 100;

// Number of chats returned in the sidebar by default``
const DEFAULT_CHAT_LIST_LIMIT =
  parseInt(process.env.CHAT_LIST_LIMIT, 10) || 5;

// CORS configuration – in production prefer an explicit allow‑list
const ALLOWED_ORIGINS = [
  // Chrome extensions
  /^chrome-extension:\/\//,
  // Local development
  /localhost/,
  // Monash learning environment (e.g. https://learning.monash.edu)
  /^https:\/\/learning\.monash\.edu$/,
];

function isOriginAllowed(origin) {
  if (!origin) {
    // Allow non-browser clients (health checks, local tools, etc.)
    return true;
  }

  return ALLOWED_ORIGINS.some((pattern) =>
    typeof pattern === "string" ? origin === pattern : pattern.test(origin)
  );
}

module.exports = {
  PORT,
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
  DEFAULT_CHAT_LIST_LIMIT,
  isOriginAllowed,
};


