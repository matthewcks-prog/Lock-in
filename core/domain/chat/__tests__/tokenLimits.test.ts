import { describe, expect, it } from 'vitest';
import {
  MODEL_TOKEN_LIMITS,
  calculateAvailablePromptTokens,
  getModelTokenLimits,
} from '../tokenLimits';

describe('tokenLimits', () => {
  it('returns exact match for known models', () => {
    expect(getModelTokenLimits('gpt-4o')).toEqual(MODEL_TOKEN_LIMITS['gpt-4o']);
  });

  it('returns prefix match for versioned models', () => {
    expect(getModelTokenLimits('gpt-4o-2024-05-13')).toEqual(MODEL_TOKEN_LIMITS['gpt-4o']);
  });

  it('falls back to default when model is unknown', () => {
    expect(getModelTokenLimits('unknown-model')).toEqual(MODEL_TOKEN_LIMITS['default']);
  });

  it('calculates available prompt tokens', () => {
    const limits = getModelTokenLimits('gpt-4o-mini');
    const available = calculateAvailablePromptTokens('gpt-4o-mini', 1000);
    expect(available).toBe(limits.contextWindow - 1000 - limits.reserveTokens);
  });
});
