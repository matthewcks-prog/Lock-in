/**
 * Validation utilities for Lock-in backend
 */

const VALID_MODES = ["explain", "simplify", "translate"];
const VALID_DIFFICULTY_LEVELS = ["highschool", "university"];
const VALID_LANGUAGE_CODES = [
  "en", "es", "zh", "fr", "de", "ja", "ko", "pt", "it", "ru",
  "ar", "hi", "nl", "pl", "sv", "tr", "vi", "th", "id", "cs",
];

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate mode
 * @param {*} mode - Mode to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateMode(mode) {
  if (!mode || typeof mode !== "string") {
    return { valid: false, error: "Mode must be a string" };
  }
  if (!VALID_MODES.includes(mode)) {
    return { valid: false, error: `Mode must be one of: ${VALID_MODES.join(", ")}` };
  }
  return { valid: true };
}

/**
 * Validate language code
 * @param {*} code - Language code to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateLanguageCode(code) {
  if (!code || typeof code !== "string") {
    return { valid: false, error: "Language code must be a string" };
  }
  const normalized = code.toLowerCase().trim();
  if (!VALID_LANGUAGE_CODES.includes(normalized)) {
    return { valid: false, error: `Invalid language code. Supported: ${VALID_LANGUAGE_CODES.join(", ")}` };
  }
  return { valid: true, normalized };
}

/**
 * Validate difficulty level
 * @param {*} level - Difficulty level to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateDifficultyLevel(level) {
  if (!level || typeof level !== "string") {
    return { valid: false, error: "Difficulty level must be a string" };
  }
  const normalized = level.toLowerCase().trim();
  if (!VALID_DIFFICULTY_LEVELS.includes(normalized)) {
    return { valid: false, error: `Difficulty level must be one of: ${VALID_DIFFICULTY_LEVELS.join(", ")}` };
  }
  return { valid: true, normalized };
}

/**
 * Validate UUID
 * @param {*} id - ID to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateUUID(id) {
  if (!id || typeof id !== "string") {
    return { valid: false, error: "ID must be a string" };
  }
  if (!UUID_REGEX.test(id)) {
    return { valid: false, error: "ID must be a valid UUID" };
  }
  return { valid: true };
}

/**
 * Validate chat history array
 * @param {*} history - Chat history to validate
 * @returns {{valid: boolean, sanitized?: Array, error?: string}}
 */
function validateChatHistory(history) {
  if (!Array.isArray(history)) {
    return { valid: false, error: "Chat history must be an array" };
  }
  
  const sanitized = [];
  for (let i = 0; i < history.length; i++) {
    const message = history[i];
    if (!message || typeof message !== "object") {
      continue; // Skip invalid messages
    }
    
    const role = message.role;
    const content = message.content;
    
    if (role !== "user" && role !== "assistant" && role !== "system") {
      continue; // Skip invalid roles
    }
    
    if (typeof content !== "string" || content.length === 0) {
      continue; // Skip empty content
    }
    
    // Limit content length to prevent abuse
    if (content.length > 10000) {
      continue; // Skip overly long messages
    }
    
    sanitized.push({
      role,
      content: content.trim(),
    });
  }
  
  // Limit total history length
  const MAX_HISTORY_LENGTH = 50;
  if (sanitized.length > MAX_HISTORY_LENGTH) {
    return {
      valid: true,
      sanitized: sanitized.slice(-MAX_HISTORY_LENGTH), // Keep last N messages
    };
  }
  
  return { valid: true, sanitized };
}

/**
 * Validate text input
 * @param {*} text - Text to validate
 * @param {number} maxLength - Maximum length
 * @param {string} fieldName - Field name for error messages
 * @returns {{valid: boolean, sanitized?: string, error?: string}}
 */
function validateText(text, maxLength, fieldName = "Text") {
  if (text === null || text === undefined) {
    return { valid: false, error: `${fieldName} is required` };
  }
  
  if (typeof text !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  const trimmed = text.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty` };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} is too long. Maximum ${maxLength} characters.` };
  }
  
  return { valid: true, sanitized: trimmed };
}

module.exports = {
  VALID_MODES,
  VALID_DIFFICULTY_LEVELS,
  VALID_LANGUAGE_CODES,
  validateMode,
  validateLanguageCode,
  validateDifficultyLevel,
  validateUUID,
  validateChatHistory,
  validateText,
};

