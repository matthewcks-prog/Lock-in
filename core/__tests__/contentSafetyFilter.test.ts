/**
 * Content Safety Filter Tests
 *
 * Validates redaction of sensitive content before LLM submission.
 */

import { describe, it, expect } from 'vitest';
import { scanContent } from '../../core/services/contentSafetyFilter';

describe('scanContent', () => {
  it('returns clean result for normal text', () => {
    const result = scanContent('What is a binary search tree?');
    expect(result.hasSensitiveContent).toBe(false);
    expect(result.matches).toHaveLength(0);
    expect(result.redactedText).toBe('What is a binary search tree?');
  });

  it('returns clean for empty/whitespace input', () => {
    expect(scanContent('').hasSensitiveContent).toBe(false);
    expect(scanContent('   ').hasSensitiveContent).toBe(false);
  });

  it('detects and redacts email addresses', () => {
    const result = scanContent('My email is student@monash.edu can you help?');
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.some((m) => m.category === 'Email Address')).toBe(true);
    expect(result.redactedText).toContain('[REDACTED_EMAIL]');
    expect(result.redactedText).not.toContain('student@monash.edu');
  });

  it('detects OpenAI API keys', () => {
    const result = scanContent('My key is sk-abc123def456ghi789jkl012mno345');
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.some((m) => m.category === 'OpenAI API Key')).toBe(true);
    expect(result.redactedText).toContain('[REDACTED_OPENAI_KEY]');
  });

  it('detects JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = scanContent(`Token: ${jwt}`);
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.some((m) => m.category === 'JWT Token')).toBe(true);
    expect(result.redactedText).toContain('[REDACTED_JWT]');
  });

  it('detects GitHub tokens', () => {
    const result = scanContent('ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789');
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.some((m) => m.category === 'GitHub Token')).toBe(true);
  });

  it('detects AWS access keys', () => {
    const result = scanContent('My key is AKIAIOSFODNN7EXAMPLE');
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.some((m) => m.category === 'AWS Access Key')).toBe(true);
  });

  it('detects file paths', () => {
    const result = scanContent('Check C:\\Users\\admin\\secrets.txt for details');
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.some((m) => m.category === 'File Path')).toBe(true);
    expect(result.redactedText).toContain('[REDACTED_PATH]');
  });

  it('detects connection strings', () => {
    const result = scanContent('Use postgres://user:pass@host:5432/db');
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.some((m) => m.category === 'Connection String')).toBe(true);
  });

  it('detects Bearer tokens', () => {
    const result = scanContent(
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def',
    );
    expect(result.hasSensitiveContent).toBe(true);
  });

  it('handles multiple sensitive items in one text', () => {
    const result = scanContent(
      'Email me at test@example.com, my key is sk-abc123def456ghi789jkl012mno345',
    );
    expect(result.hasSensitiveContent).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
    expect(result.summary).toContain('sensitive item');
  });

  it('provides masked preview (not raw secret)', () => {
    const result = scanContent('sk-abc123def456ghi789jkl012mno345');
    const firstMatch = result.matches[0];
    expect(firstMatch).toBeDefined();
    expect(firstMatch?.preview).not.toBe('sk-abc123def456ghi789jkl012mno345');
    expect(firstMatch?.preview).toContain('***');
  });
});
