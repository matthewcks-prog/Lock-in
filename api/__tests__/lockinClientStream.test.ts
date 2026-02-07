import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLockinClient,
  type ProcessTextStreamParams,
  type StreamingConfig,
} from '../resources/lockinClient';
import type { ApiRequest } from '../fetcher';

const DEFAULT_SELECTION = 'test';
const STREAM_EVENT_COUNT = 3;

/**
 * Helper to create a mock SSE response
 */
function createSSEResponse(events: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(events));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

type StreamTestContext = {
  mockApiRequest: ApiRequest;
  createClient: () => ReturnType<typeof createLockinClient>;
  getFetch: () => ReturnType<typeof vi.fn<typeof fetch>>;
};

const buildStreamParams = (
  overrides: Partial<ProcessTextStreamParams> = {},
): ProcessTextStreamParams => ({
  selection: DEFAULT_SELECTION,
  ...overrides,
});

const runStream = async (
  ctx: StreamTestContext,
  events: string,
  overrides?: Partial<ProcessTextStreamParams>,
) => {
  ctx.getFetch().mockResolvedValue(createSSEResponse(events));
  return ctx.createClient().processTextStream(buildStreamParams(overrides));
};

const runStreamWithResponse = async (
  ctx: StreamTestContext,
  response: Response,
  overrides?: Partial<ProcessTextStreamParams>,
) => {
  ctx.getFetch().mockResolvedValue(response);
  return ctx.createClient().processTextStream(buildStreamParams(overrides));
};

function registerProcessTextStreamConfigTests(ctx: StreamTestContext): void {
  describe('processTextStream config', () => {
    it('throws if streamingConfig is not provided', async () => {
      const client = createLockinClient(ctx.mockApiRequest);

      await expect(client.processTextStream(buildStreamParams())).rejects.toThrow(
        'Streaming not configured',
      );
    });
  });
}

function registerProcessTextStreamHeaderTests(ctx: StreamTestContext): void {
  describe('processTextStream headers', () => {
    it('sends POST request to streaming endpoint', async () => {
      await runStream(ctx, 'event: done\ndata: {}\n\n', {
        selection: 'test selection',
      });

      expect(ctx.getFetch()).toHaveBeenCalledWith(
        'https://api.test.com/api/lockin/stream',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
            Accept: 'text/event-stream',
          }),
        }),
      );
    });

    it('includes idempotency key in headers', async () => {
      await runStream(ctx, 'event: done\ndata: {}\n\n', {
        idempotencyKey: 'idem-123',
      });

      expect(ctx.getFetch()).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': 'idem-123',
          }),
        }),
      );
    });
  });
}

function registerProcessTextStreamMetaDeltaTests(ctx: StreamTestContext): void {
  describe('processTextStream meta/delta callbacks', () => {
    it('calls onMeta callback with meta event data', async () => {
      const onMeta = vi.fn();

      await runStream(
        ctx,
        'event: meta\ndata: {"chatId":"c1","messageId":"m1","requestId":"r1"}\n\n' +
          'event: done\ndata: {}\n\n',
        { onMeta },
      );

      expect(onMeta).toHaveBeenCalledWith({
        chatId: 'c1',
        messageId: 'm1',
        requestId: 'r1',
      });
    });

    it('calls onDelta callback for each delta event', async () => {
      const onDelta = vi.fn();

      await runStream(
        ctx,
        'event: delta\ndata: {"content":"Hello "}\n\n' +
          'event: delta\ndata: {"content":"World"}\n\n' +
          'event: done\ndata: {}\n\n',
        { onDelta },
      );

      expect(onDelta).toHaveBeenCalledTimes(2);
      expect(onDelta).toHaveBeenNthCalledWith(1, { content: 'Hello ' });
      expect(onDelta).toHaveBeenNthCalledWith(2, { content: 'World' });
    });
  });
}

function registerProcessTextStreamFinalErrorTests(ctx: StreamTestContext): void {
  describe('processTextStream final/error callbacks', () => {
    it('calls onFinal callback with final event data', async () => {
      const onFinal = vi.fn();

      await runStream(
        ctx,
        'event: final\ndata: {"content":"Full response","usage":{"totalTokens":100}}\n\n' +
          'event: done\ndata: {}\n\n',
        { onFinal },
      );

      expect(onFinal).toHaveBeenCalledWith({
        content: 'Full response',
        usage: { totalTokens: 100 },
      });
    });

    it('calls onError callback on stream error event', async () => {
      const onError = vi.fn();

      const result = await runStream(
        ctx,
        'event: error\ndata: {"code":"PROVIDER_ERROR","message":"API failed","retryable":false}\n\n',
        { onError },
      );

      expect(onError).toHaveBeenCalledWith({
        code: 'PROVIDER_ERROR',
        message: 'API failed',
        retryable: false,
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROVIDER_ERROR');
    });
  });
}

function registerProcessTextStreamEventTests(ctx: StreamTestContext): void {
  describe('processTextStream event callbacks', () => {
    it('calls onEvent for all events', async () => {
      const onEvent = vi.fn();

      await runStream(
        ctx,
        'event: meta\ndata: {"chatId":"c1","messageId":"m1","requestId":"r1"}\n\n' +
          'event: delta\ndata: {"content":"test"}\n\n' +
          'event: done\ndata: {}\n\n',
        { onEvent },
      );

      expect(onEvent).toHaveBeenCalledTimes(STREAM_EVENT_COUNT);
    });
  });
}

function registerProcessTextStreamContentTests(ctx: StreamTestContext): void {
  describe('processTextStream content handling', () => {
    it('accumulates content from delta events', async () => {
      const result = await runStream(
        ctx,
        'event: delta\ndata: {"content":"Hello "}\n\n' +
          'event: delta\ndata: {"content":"World"}\n\n' +
          'event: done\ndata: {}\n\n',
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello World');
    });

    it('uses final content if provided instead of accumulated', async () => {
      const result = await runStream(
        ctx,
        'event: delta\ndata: {"content":"Partial "}\n\n' +
          'event: final\ndata: {"content":"Complete final response"}\n\n' +
          'event: done\ndata: {}\n\n',
      );

      expect(result.content).toBe('Complete final response');
    });
  });
}

function registerProcessTextStreamResultTests(ctx: StreamTestContext): void {
  describe('processTextStream result metadata', () => {
    it('returns chatId and messageId from meta event', async () => {
      const result = await runStream(
        ctx,
        'event: meta\ndata: {"chatId":"c1","messageId":"m1","requestId":"r1"}\n\n' +
          'event: done\ndata: {}\n\n',
      );

      expect(result.chatId).toBe('c1');
      expect(result.messageId).toBe('m1');
    });

    it('returns usage from final event', async () => {
      const result = await runStream(
        ctx,
        'event: final\ndata: {"content":"response","usage":{"totalTokens":150}}\n\n' +
          'event: done\ndata: {}\n\n',
      );

      expect(result.usage).toEqual({ totalTokens: 150 });
    });
  });
}

function registerProcessTextStreamHttpErrorTests(ctx: StreamTestContext): void {
  describe('processTextStream HTTP error handling', () => {
    it('handles HTTP errors before stream starts', async () => {
      const onError = vi.fn();

      const response = new Response(
        JSON.stringify({ error: { code: 'RATE_LIMIT', message: 'Too many requests' } }),
        { status: 429 },
      );

      const result = await runStreamWithResponse(ctx, response, { onError });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMIT');
      expect(result.error?.retryable).toBe(true);
      expect(onError).toHaveBeenCalled();
    });

    it('handles non-JSON HTTP error responses', async () => {
      const response = new Response('Internal Server Error', { status: 500 });
      const result = await runStreamWithResponse(ctx, response);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HTTP_500');
    });
  });
}

describe('createLockinClient streaming', () => {
  const mockApiRequest: ApiRequest = async <T>() => ({}) as T;
  let streamingConfig: StreamingConfig;
  let mockFetch: ReturnType<typeof vi.fn<typeof fetch>>;

  const createClient = () => createLockinClient(mockApiRequest, streamingConfig);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn<typeof fetch>();
    streamingConfig = {
      backendUrl: 'https://api.test.com',
      getAccessToken: vi.fn().mockResolvedValue('test-token'),
      fetcher: mockFetch,
    };
  });

  const ctx: StreamTestContext = {
    mockApiRequest,
    createClient,
    getFetch: () => mockFetch,
  };

  registerProcessTextStreamConfigTests(ctx);
  registerProcessTextStreamHeaderTests(ctx);
  registerProcessTextStreamMetaDeltaTests(ctx);
  registerProcessTextStreamFinalErrorTests(ctx);
  registerProcessTextStreamEventTests(ctx);
  registerProcessTextStreamContentTests(ctx);
  registerProcessTextStreamResultTests(ctx);
  registerProcessTextStreamHttpErrorTests(ctx);
});
