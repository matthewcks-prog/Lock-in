import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MESSAGE_VALIDATION,
  validateContentLength,
  validateRole,
} from '../messageValidation';
import { ValidationError } from '../../../errors';

describe('messageValidation', () => {
  it('accepts valid roles', () => {
    expect(validateRole('user')).toBe('user');
    expect(validateRole('assistant')).toBe('assistant');
  });

  it('rejects invalid roles', () => {
    expect(() => validateRole('invalid')).toThrow(ValidationError);
  });

  it('rejects empty content', () => {
    expect(() => validateContentLength('')).toThrow(ValidationError);
  });

  it('rejects content exceeding max length', () => {
    const overLimit = 'x'.repeat(DEFAULT_MESSAGE_VALIDATION.maxContentLength + 1);
    expect(() => validateContentLength(overLimit, DEFAULT_MESSAGE_VALIDATION)).toThrow(
      ValidationError,
    );
  });
});
