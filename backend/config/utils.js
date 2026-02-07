const { TEN } = require('../constants/numbers');

function readNumber(value, fallback) {
  const parsed = parseInt(value, TEN);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  return fallback;
}

module.exports = {
  readNumber,
  readBoolean,
};
