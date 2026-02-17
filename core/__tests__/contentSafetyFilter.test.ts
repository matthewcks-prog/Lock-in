/**
 * Content Safety Filter Tests
 *
 * Validates redaction of sensitive content before LLM submission.
 */

import { describe, it, expect } from 'vitest';
import { scanContent } from '../../core/services/contentSafetyFilter';

function expectCategoryMatch(input: string, category: string): ReturnType<typeof scanContent> {
  const result = scanContent(input);
  expect(result.hasSensitiveContent).toBe(true);
  expect(result.matches.some((match) => match.category === category)).toBe(true);
  return result;
}

function returnsCleanResultForNormalText(): void {
  const result = scanContent('What is a binary search tree?');
  expect(result.hasSensitiveContent).toBe(false);
  expect(result.matches).toHaveLength(0);
  expect(result.redactedText).toBe('What is a binary search tree?');
}

function returnsCleanForEmptyOrWhitespaceInput(): void {
  expect(scanContent('').hasSensitiveContent).toBe(false);
  expect(scanContent('   ').hasSensitiveContent).toBe(false);
}

function detectsAndRedactsEmailAddresses(): void {
  const result = expectCategoryMatch(
    'My email is student@monash.edu can you help?',
    'Email Address',
  );
  expect(result.redactedText).toContain('[REDACTED_EMAIL]');
  expect(result.redactedText).not.toContain('student@monash.edu');
}

function detectsOpenAIKeys(): void {
  const result = expectCategoryMatch(
    'My key is sk-abc123def456ghi789jkl012mno345',
    'OpenAI API Key',
  );
  expect(result.redactedText).toContain('[REDACTED_OPENAI_KEY]');
}

function detectsJwtTokens(): void {
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  const result = expectCategoryMatch(`Token: ${jwt}`, 'JWT Token');
  expect(result.redactedText).toContain('[REDACTED_JWT]');
}

function detectsGitHubTokens(): void {
  expectCategoryMatch('ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789', 'GitHub Token');
}

function detectsAwsAccessKeys(): void {
  expectCategoryMatch('My key is AKIAIOSFODNN7EXAMPLE', 'AWS Access Key');
}

function detectsFilePaths(): void {
  const result = expectCategoryMatch(
    'Check C:\\Users\\admin\\secrets.txt for details',
    'File Path',
  );
  expect(result.redactedText).toContain('[REDACTED_PATH]');
}

function detectsConnectionStrings(): void {
  expectCategoryMatch('Use postgres://user:pass@host:5432/db', 'Connection String');
}

function detectsBearerTokens(): void {
  const result = scanContent('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def');
  expect(result.hasSensitiveContent).toBe(true);
}

function handlesMultipleSensitiveItems(): void {
  const result = scanContent(
    'Email me at test@example.com, my key is sk-abc123def456ghi789jkl012mno345',
  );
  expect(result.hasSensitiveContent).toBe(true);
  expect(result.matches.length).toBeGreaterThanOrEqual(2);
  expect(result.summary).toContain('sensitive item');
}

function providesMaskedPreview(): void {
  const result = scanContent('sk-abc123def456ghi789jkl012mno345');
  const firstMatch = result.matches[0];
  expect(firstMatch).toBeDefined();
  expect(firstMatch?.preview).not.toBe('sk-abc123def456ghi789jkl012mno345');
  expect(firstMatch?.preview).toContain('***');
}

describe('scanContent', () => {
  it('returns clean result for normal text', returnsCleanResultForNormalText);
  it('returns clean for empty/whitespace input', returnsCleanForEmptyOrWhitespaceInput);
  it('detects and redacts email addresses', detectsAndRedactsEmailAddresses);
  it('detects OpenAI API keys', detectsOpenAIKeys);
  it('detects JWT tokens', detectsJwtTokens);
  it('detects GitHub tokens', detectsGitHubTokens);
  it('detects AWS access keys', detectsAwsAccessKeys);
  it('detects file paths', detectsFilePaths);
  it('detects connection strings', detectsConnectionStrings);
  it('detects Bearer tokens', detectsBearerTokens);
  it('handles multiple sensitive items in one text', handlesMultipleSensitiveItems);
  it('provides masked preview (not raw secret)', providesMaskedPreview);
});
