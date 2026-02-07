/**
 * Centralised configuration for the Lock-in backend.
 *
 * NOTE:
 * - All environment variable access should go through this module.
 * - This keeps configuration in one place and makes it easier to test.
 */

const env = require('./env');
const supabase = require('./supabase');
const server = require('./server');
const cors = require('./cors');
const assets = require('./assets');
const llm = require('./llm');
const transcripts = require('./transcripts');

module.exports = {
  ...env,
  ...supabase,
  ...server,
  isOriginAllowed: cors.isOriginAllowed,
  ...assets,
  ...llm,
  ...transcripts,
};
