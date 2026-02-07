const chatLimits = require('../../core/config/chatLimits.json');
const { readNumber } = require('./utils');
const { FIVE, THREE, HUNDRED, THOUSAND } = require('../constants/numbers');

// Server
const PORT = process.env.PORT || THREE * THOUSAND;

// Request/body limits
const MAX_SELECTION_LENGTH = FIVE * THOUSAND;
const MAX_USER_MESSAGE_LENGTH = THOUSAND + FIVE * HUNDRED;

// Per-user rate limiting (requests per UTC day)
const DAILY_REQUEST_LIMIT = readNumber(process.env.DAILY_REQUEST_LIMIT, HUNDRED);

// Chat list limits
const DEFAULT_CHAT_LIST_LIMIT = readNumber(
  process.env.CHAT_LIST_LIMIT,
  chatLimits.DEFAULT_CHAT_LIST_LIMIT,
);
const MAX_CHAT_LIST_LIMIT = readNumber(
  process.env.MAX_CHAT_LIST_LIMIT,
  chatLimits.MAX_CHAT_LIST_LIMIT,
);

module.exports = {
  PORT,
  MAX_SELECTION_LENGTH,
  MAX_USER_MESSAGE_LENGTH,
  DAILY_REQUEST_LIMIT,
  DEFAULT_CHAT_LIST_LIMIT,
  MAX_CHAT_LIST_LIMIT,
};
