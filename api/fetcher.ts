import type { AuthClient } from "./auth";

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryableStatuses: [429, 502, 503, 504],
};

function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  const jitter = cappedDelay * (Math.random() * 0.3);
  return Math.floor(cappedDelay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ApiRequestOptions extends RequestInit {
  signal?: AbortSignal;
  retry?: boolean;
  retryConfig?: Partial<RetryConfig>;
  ifUnmodifiedSince?: string;
}

export class ConflictError extends Error {
  code = "CONFLICT";
  status = 409;
  serverVersion?: string;

  constructor(message: string, serverVersion?: string) {
    super(message);
    this.name = "ConflictError";
    this.serverVersion = serverVersion;
  }
}

async function createApiError(response: Response, originalError: Error | null = null): Promise<Error> {
  let errorMessage = "API request failed";
  let errorCode = "API_ERROR";

  try {
    const errorBody = await response.json();
    errorMessage =
      errorBody?.error?.message ||
      errorBody?.message ||
      (typeof errorBody?.error === "string" ? errorBody.error : null) ||
      errorMessage;

    if (response.status === 401 || response.status === 403) {
      errorCode = "AUTH_REQUIRED";
    } else if (response.status === 429) {
      errorCode = "RATE_LIMIT";
    } else if (response.status === 400) {
      errorCode = "BAD_REQUEST";
    } else if (response.status >= 500) {
      errorCode = "SERVER_ERROR";
    }
  } catch (_) {
    try {
      const text = await response.text();
      if (text) {
        errorMessage = text;
      }
    } catch (_) {
      // Ignore parse errors
    }
  }

  const error = new Error(errorMessage);
  (error as any).code = errorCode;
  (error as any).status = response.status;
  if (originalError) {
    (error as any).cause = originalError;
  }
  return error;
}

export type ApiRequest = <T = any>(endpoint: string, options?: ApiRequestOptions) => Promise<T>;

export interface FetcherConfig {
  backendUrl: string;
  authClient: AuthClient;
}

export function createFetcher(config: FetcherConfig) {
  const { backendUrl, authClient } = config;
  const clientConfig = { backendUrl };

  async function apiRequest<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { retry = true, retryConfig: customRetryConfig, ifUnmodifiedSince, ...fetchOptions } = options;

    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...customRetryConfig };
    const url = endpoint.startsWith("http") ? endpoint : `${backendUrl}${endpoint}`;

    if (fetchOptions.signal?.aborted) {
      const error = new Error("Request was aborted");
      (error as any).code = "ABORTED";
      throw error;
    }

    const accessToken = await authClient.getValidAccessToken();
    if (!accessToken) {
      const error = new Error("Please sign in via the Lock-in popup before using the assistant.");
      (error as any).code = "AUTH_REQUIRED";
      throw error;
    }

    if (fetchOptions.signal?.aborted) {
      const error = new Error("Request was aborted");
      (error as any).code = "ABORTED";
      throw error;
    }

    const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(ifUnmodifiedSince ? { "If-Unmodified-Since": ifUnmodifiedSince } : {}),
      ...(fetchOptions.headers || {}),
    };

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= (retry ? retryConfig.maxRetries : 0); attempt++) {
      if (fetchOptions.signal?.aborted) {
        const error = new Error("Request was aborted");
        (error as any).code = "ABORTED";
        throw error;
      }

      if (attempt > 0) {
        const delay = calculateRetryDelay(attempt - 1, retryConfig);
        // eslint-disable-next-line no-console
        console.log(`[API] Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await sleep(delay);

        if (fetchOptions.signal?.aborted) {
          const error = new Error("Request was aborted");
          (error as any).code = "ABORTED";
          throw error;
        }
      }

      let response: Response;
      try {
        response = await fetch(url, requestOptions);
      } catch (networkError: any) {
        if (networkError.name === "AbortError" || fetchOptions.signal?.aborted) {
          const error = new Error("Request was aborted");
          (error as any).code = "ABORTED";
          throw error;
        }

        lastError = new Error("Unable to reach Lock-in. Please check your connection.");
        (lastError as any).code = "NETWORK_ERROR";
        (lastError as any).cause = networkError;

        if (retry && attempt < retryConfig.maxRetries) {
          continue;
        }
        throw lastError;
      }

      if (response.status === 409) {
        let serverVersion: string | undefined;
        try {
          const body = await response.json();
          serverVersion = body?.updatedAt || body?.updated_at;
        } catch {}
        throw new ConflictError(
          "Note was modified by another session. Please refresh and try again.",
          serverVersion,
        );
      }

      if (retry && retryConfig.retryableStatuses.includes(response.status) && attempt < retryConfig.maxRetries) {
        lastError = await createApiError(response);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        await authClient.signOut().catch(() => {});
      }

      if (!response.ok) {
        throw await createApiError(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      try {
        const contentLength = response.headers.get("content-length");
        const contentType = response.headers.get("content-type");

        if (contentLength === "0" || !contentType?.includes("application/json")) {
          return undefined as T;
        }

        const data = await response.json();
        if (data && data.success === false) {
          const error = new Error(data.error?.message || "Request failed");
          (error as any).code = data.error?.code || "API_ERROR";
          throw error;
        }
        return data;
      } catch (parseError: any) {
        if (parseError instanceof Error && (parseError as any).code) {
          throw parseError;
        }
        const error = new Error("Failed to parse API response");
        (error as any).code = "PARSE_ERROR";
        (error as any).cause = parseError;
        throw error;
      }
    }

    throw lastError || new Error("Request failed after retries");
  }

  function getBackendUrl(): string {
    return clientConfig.backendUrl;
  }

  return {
    apiRequest,
    getBackendUrl,
  };
}
