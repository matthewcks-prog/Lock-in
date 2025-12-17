/**
 * Tests for validation utilities
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  VALID_MODES,
  validateMode,
  validateLanguageCode,
  validateDifficultyLevel,
  validateUUID,
  validateChatHistory,
  validateText,
} = require("./validation");

// ============================================================================
// validateMode tests
// ============================================================================

test("validateMode: accepts all valid modes including 'general'", () => {
  const expectedModes = ["explain", "general"];

  // Verify VALID_MODES matches expected
  assert.deepEqual(VALID_MODES, expectedModes);

  // Verify each mode validates correctly
  for (const mode of expectedModes) {
    const result = validateMode(mode);
    assert.equal(result.valid, true, `Mode "${mode}" should be valid`);
    assert.equal(result.error, undefined);
  }
});

test("validateMode: rejects invalid mode strings", () => {
  const invalidModes = ["invalid", "EXPLAIN", "Simplify", "foo", ""];

  for (const mode of invalidModes) {
    const result = validateMode(mode);
    assert.equal(result.valid, false, `Mode "${mode}" should be invalid`);
    assert.ok(result.error, `Mode "${mode}" should have an error message`);
  }
});

test("validateMode: rejects non-string modes", () => {
  const nonStrings = [null, undefined, 123, {}, [], true];

  for (const mode of nonStrings) {
    const result = validateMode(mode);
    assert.equal(result.valid, false);
    assert.equal(result.error, "Mode must be a string");
  }
});

// ============================================================================
// validateLanguageCode tests
// ============================================================================

test("validateLanguageCode: accepts valid language codes", () => {
  const validCodes = ["en", "es", "zh", "fr", "de", "ja"];

  for (const code of validCodes) {
    const result = validateLanguageCode(code);
    assert.equal(result.valid, true);
    assert.equal(result.normalized, code.toLowerCase());
  }
});

test("validateLanguageCode: normalizes uppercase codes", () => {
  const result = validateLanguageCode("EN");
  assert.equal(result.valid, true);
  assert.equal(result.normalized, "en");
});

test("validateLanguageCode: rejects invalid language codes", () => {
  const result = validateLanguageCode("xyz");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

// ============================================================================
// validateDifficultyLevel tests
// ============================================================================

test("validateDifficultyLevel: accepts valid difficulty levels", () => {
  const validLevels = ["highschool", "university"];

  for (const level of validLevels) {
    const result = validateDifficultyLevel(level);
    assert.equal(result.valid, true);
    assert.equal(result.normalized, level);
  }
});

test("validateDifficultyLevel: rejects invalid difficulty levels", () => {
  const result = validateDifficultyLevel("invalid");
  assert.equal(result.valid, false);
  assert.ok(result.error);
});

// ============================================================================
// validateUUID tests
// ============================================================================

test("validateUUID: accepts valid UUIDs", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";
  const result = validateUUID(validUUID);
  assert.equal(result.valid, true);
});

test("validateUUID: rejects invalid UUIDs", () => {
  const invalidUUIDs = ["not-a-uuid", "123", ""];

  for (const id of invalidUUIDs) {
    const result = validateUUID(id);
    assert.equal(result.valid, false);
  }
});

// ============================================================================
// validateChatHistory tests
// ============================================================================

test("validateChatHistory: accepts valid chat history", () => {
  const history = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
  ];

  const result = validateChatHistory(history);
  assert.equal(result.valid, true);
  assert.equal(result.sanitized.length, 2);
});

test("validateChatHistory: filters out invalid messages", () => {
  const history = [
    { role: "user", content: "Hello" },
    { role: "invalid", content: "Bad role" },
    { role: "assistant", content: "" },
    null,
  ];

  const result = validateChatHistory(history);
  assert.equal(result.valid, true);
  assert.equal(result.sanitized.length, 1);
});

test("validateChatHistory: rejects non-array input", () => {
  const result = validateChatHistory("not an array");
  assert.equal(result.valid, false);
  assert.equal(result.error, "Chat history must be an array");
});

// ============================================================================
// validateText tests
// ============================================================================

test("validateText: accepts valid text", () => {
  const result = validateText("Hello world", 100, "Test");
  assert.equal(result.valid, true);
  assert.equal(result.sanitized, "Hello world");
});

test("validateText: trims whitespace", () => {
  const result = validateText("  Hello world  ", 100, "Test");
  assert.equal(result.valid, true);
  assert.equal(result.sanitized, "Hello world");
});

test("validateText: rejects text that exceeds max length", () => {
  const longText = "a".repeat(101);
  const result = validateText(longText, 100, "Test");
  assert.equal(result.valid, false);
  assert.match(result.error, /too long/i);
});

test("validateText: rejects empty text", () => {
  const result = validateText("   ", 100, "Test");
  assert.equal(result.valid, false);
  assert.match(result.error, /cannot be empty/i);
});
