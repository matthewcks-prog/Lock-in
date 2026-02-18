function parsePositiveRetryAfter(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function getRetryAfterHeader(error) {
  return (
    error?.headers?.get?.('Retry-After') ||
    error?.headers?.['retry-after'] ||
    error?.response?.headers?.['retry-after'] ||
    null
  );
}

function parseRetryAfterHeader(header) {
  if (!header) {
    return null;
  }

  const normalizedHeader = String(header);
  const seconds = Number.parseInt(normalizedHeader, 10);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds;
  }

  const date = Date.parse(normalizedHeader);
  if (Number.isNaN(date)) {
    return null;
  }

  const waitSeconds = Math.ceil((date - Date.now()) / 1000);
  return waitSeconds > 0 ? waitSeconds : null;
}

function parseRetryAfterMessage(message) {
  if (!message) {
    return null;
  }

  const patterns = [
    /retry\s+(?:after\s+|in\s+)?(\d+)\s*s(?:econds?)?/i,
    /wait\s+(\d+)\s*s(?:econds?)?/i,
    /Retry after (\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match) {
      continue;
    }
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parseRetryAfter(error) {
  const explicitRetryAfter =
    parsePositiveRetryAfter(error?.retryAfter) ?? parsePositiveRetryAfter(error?.retryAfterSeconds);
  if (explicitRetryAfter !== null) {
    return explicitRetryAfter;
  }

  const retryAfterHeader = getRetryAfterHeader(error);
  const headerRetryAfter = parseRetryAfterHeader(retryAfterHeader);
  if (headerRetryAfter !== null) {
    return headerRetryAfter;
  }

  return parseRetryAfterMessage(error?.message || '');
}

module.exports = {
  parseRetryAfter,
};
