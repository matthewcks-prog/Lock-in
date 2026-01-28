import '../validators.js';

const { validators } = globalThis.LockInBackground;

describe('background validators', () => {
  test('getMessageType prefers type then action', () => {
    expect(validators.getMessageType({ type: 'PING', action: 'PONG' })).toBe('PING');
    expect(validators.getMessageType({ action: 'PONG' })).toBe('PONG');
  });

  test('getMessageType returns undefined for invalid input', () => {
    expect(validators.getMessageType(null)).toBeUndefined();
    expect(validators.getMessageType('bad')).toBeUndefined();
  });

  test('extractTranscript validator pulls video from payload', () => {
    const validate = validators.createMessageValidators().EXTRACT_TRANSCRIPT;
    const result = validate({ payload: { video: { id: 'v1' } } });
    expect(result.ok).toBe(true);
    expect(result.payload.video.id).toBe('v1');
  });

  test('saveSettings validator normalizes settings object', () => {
    const validate = validators.createMessageValidators().UPDATE_SETTINGS;
    const result = validate({ settings: null });
    expect(result.ok).toBe(true);
    expect(result.payload.settings).toEqual({});
  });
});
