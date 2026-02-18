const HTTP_STATUS = require('../../../constants/httpStatus');
const { FALLBACK_ERROR_PATTERNS, NO_FALLBACK_ERROR_PATTERNS } = require('./patterns');
const { getErrorStatus } = require('./errorStatus');

function shouldFallback(error) {
  const message = (error?.message || String(error)).toLowerCase();
  const status = getErrorStatus(error);

  if (
    status === HTTP_STATUS.BAD_REQUEST ||
    status === HTTP_STATUS.UNAUTHORIZED ||
    status === HTTP_STATUS.FORBIDDEN
  ) {
    return false;
  }

  if (status === HTTP_STATUS.TOO_MANY_REQUESTS || status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return true;
  }

  for (const pattern of NO_FALLBACK_ERROR_PATTERNS) {
    if (message.includes(pattern)) {
      return false;
    }
  }

  for (const pattern of FALLBACK_ERROR_PATTERNS) {
    if (message.includes(pattern)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  shouldFallback,
};
