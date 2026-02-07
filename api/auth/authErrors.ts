type AuthClientError = Error & { code: string; details?: unknown };

const AUTH_ERROR_CODE_RULES: Array<{ pattern: string; code: string }> = [
  { pattern: 'already registered', code: 'USER_ALREADY_REGISTERED' },
  { pattern: 'invalid login', code: 'INVALID_LOGIN' },
  { pattern: 'email not confirmed', code: 'EMAIL_NOT_CONFIRMED' },
  { pattern: 'invalid email', code: 'INVALID_EMAIL' },
];

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return typeof value === 'object' && value !== null ? (value as RecordValue) : null;
}

function firstString(candidates: Array<unknown>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
}

async function readErrorPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (_) {
    try {
      const text = await response.text();
      return text.length > 0 ? { message: text } : null;
    } catch (_) {
      return null;
    }
  }
}

function resolveAuthErrorMessage(
  payloadRecord: RecordValue | null,
  nestedRecord: RecordValue | null,
  fallbackMessage: string,
): string {
  const nestedError = payloadRecord?.['error'];
  const message = firstString([
    payloadRecord?.['error_description'],
    nestedRecord?.['message'],
    typeof nestedError === 'string' ? nestedError : undefined,
    payloadRecord?.['message'],
  ]);

  return message !== undefined ? message : fallbackMessage;
}

function mapAuthErrorCode(message: string): string {
  const normalized = (message.length > 0 ? message : '').toLowerCase();
  for (const rule of AUTH_ERROR_CODE_RULES) {
    if (normalized.includes(rule.pattern)) {
      return rule.code;
    }
  }
  return 'AUTH_ERROR';
}

function createAuthError(
  message: string,
  code: string = 'AUTH_ERROR',
  details?: unknown,
): AuthClientError {
  const safeMessage = message.length > 0 ? message : 'Authentication failed';
  const error = new Error(safeMessage) as AuthClientError;
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

async function parseErrorResponse(
  response: Response,
  fallbackMessage: string,
): Promise<{ message: string; code: string; details?: Record<string, unknown> }> {
  const payload = await readErrorPayload(response);
  const payloadRecord = asRecord(payload);
  const nestedRecord = asRecord(payloadRecord?.['error']);
  const message = resolveAuthErrorMessage(payloadRecord, nestedRecord, fallbackMessage);
  const code = mapAuthErrorCode(message);
  const parsed: { message: string; code: string; details?: Record<string, unknown> } = {
    message,
    code,
  };
  if (payloadRecord !== null) {
    parsed.details = payloadRecord;
  }
  return parsed;
}

export { createAuthError, parseErrorResponse, type AuthClientError };
