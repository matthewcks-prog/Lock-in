import { HTTP_STATUS } from '../fetcher/constants';
import type { StreamErrorEvent } from '../fetcher/sseParser';

type ParsedStreamErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

function parseStreamErrorPayload(errorText: string): ParsedStreamErrorPayload | null {
  try {
    const parsed: unknown = JSON.parse(errorText);
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }

    const errorCandidate = (parsed as { error?: unknown }).error;
    if (
      errorCandidate === null ||
      errorCandidate === undefined ||
      typeof errorCandidate !== 'object'
    ) {
      return {};
    }

    const code = (errorCandidate as { code?: unknown }).code;
    const message = (errorCandidate as { message?: unknown }).message;

    return {
      error: {
        ...(typeof code === 'string' ? { code } : {}),
        ...(typeof message === 'string' ? { message } : {}),
      },
    };
  } catch {
    return null;
  }
}

export async function parseHttpStreamError(response: Response): Promise<StreamErrorEvent> {
  const errorText = await response.text();
  const parsed = parseStreamErrorPayload(errorText);

  if (parsed !== null) {
    return {
      code: parsed.error?.code ?? `HTTP_${response.status}`,
      message: parsed.error?.message ?? response.statusText,
      retryable:
        response.status === HTTP_STATUS.SERVICE_UNAVAILABLE ||
        response.status === HTTP_STATUS.TOO_MANY_REQUESTS,
    };
  }

  return {
    code: `HTTP_${response.status}`,
    message: response.statusText,
    retryable: false,
  };
}
