// CORS configuration - in production prefer an explicit allow-list
const ALLOWED_ORIGINS = [
  // Chrome extensions
  /^chrome-extension:\/\//,
  // Local development
  /localhost/,
  // Monash learning environment (e.g. https://learning.monash.edu)
  /^https:\/\/learning\.monash\.edu$/,
  // Panopto (all regional domains, including multi-subdomain like monash.au.panopto.com)
  /^https:\/\/([a-z0-9.-]+\.)?panopto\.(com|eu)$/,
  // Echo360 (regional + QA domains)
  /^https:\/\/([a-z0-9-]+\.)?echo360qa\.(org|dev)$/,
  /^https:\/\/([a-z0-9-]+\.)?echo360\.(org|org\.au|net\.au|ca|org\.uk)$/,
];

function isOriginAllowed(origin) {
  if (!origin) {
    // Allow non-browser clients (health checks, local tools, etc.)
    return true;
  }

  return ALLOWED_ORIGINS.some((pattern) =>
    typeof pattern === 'string' ? origin === pattern : pattern.test(origin),
  );
}

module.exports = {
  isOriginAllowed,
};
