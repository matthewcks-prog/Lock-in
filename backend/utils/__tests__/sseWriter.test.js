/**
 * Tests for SSE Writer Utility
 */

const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('assert');
const {
  configureSSE,
  writeSSEEvent,
  writeKeepAlive,
  endSSE,
  createSSEWriter,
} = require('../sseWriter');

function parseSseData(payload) {
  const dataLine = payload
    .trim()
    .split('\n')
    .find((line) => line.startsWith('data: '));
  return dataLine ? JSON.parse(dataLine.replace('data: ', '')) : null;
}

describe('sseWriter', () => {
  describe('configureSSE', () => {
    it('sets required SSE headers', () => {
      const headers = {};
      const res = {
        setHeader: (key, value) => {
          headers[key] = value;
        },
        flushHeaders: mock.fn(),
      };

      configureSSE(res);

      assert.strictEqual(headers['Content-Type'], 'text/event-stream');
      assert.strictEqual(headers['Cache-Control'], 'no-cache, no-store, must-revalidate');
      assert.strictEqual(headers['Connection'], 'keep-alive');
      assert.strictEqual(headers['X-Accel-Buffering'], 'no');
      assert.strictEqual(res.flushHeaders.mock.calls.length, 1);
    });
  });

  describe('writeSSEEvent', () => {
    let res;
    let written;

    beforeEach(() => {
      written = [];
      res = {
        writableEnded: false,
        destroyed: false,
        write: (data) => {
          written.push(data);
          return true;
        },
        flush: mock.fn(),
      };
    });

    it('writes formatted SSE event', () => {
      const result = writeSSEEvent(res, 'delta', { content: 'Hello' });

      assert.strictEqual(result, true);
      assert.strictEqual(written[0], 'event: delta\ndata: {"content":"Hello"}\n\n');
      assert.deepStrictEqual(parseSseData(written[0]), { content: 'Hello' });
    });

    it('calls flush if available', () => {
      writeSSEEvent(res, 'delta', { content: 'test' });
      assert.strictEqual(res.flush.mock.calls.length, 1);
    });

    it('returns false if response is ended', () => {
      res.writableEnded = true;
      const result = writeSSEEvent(res, 'delta', { content: 'test' });
      assert.strictEqual(result, false);
      assert.strictEqual(written.length, 0);
    });

    it('returns false if response is destroyed', () => {
      res.destroyed = true;
      const result = writeSSEEvent(res, 'delta', { content: 'test' });
      assert.strictEqual(result, false);
    });
  });

  describe('writeKeepAlive', () => {
    it('writes keep-alive comment', () => {
      const written = [];
      const res = {
        writableEnded: false,
        destroyed: false,
        write: (data) => {
          written.push(data);
        },
      };

      const result = writeKeepAlive(res);

      assert.strictEqual(result, true);
      assert.strictEqual(written[0], ': keep-alive\n\n');
    });
  });

  describe('endSSE', () => {
    it('writes done event and ends response', () => {
      const written = [];
      const res = {
        writableEnded: false,
        destroyed: false,
        write: (data) => {
          written.push(data);
        },
        end: mock.fn(),
      };

      endSSE(res);

      assert.strictEqual(written[0], 'event: done\ndata: {}\n\n');
      assert.deepStrictEqual(parseSseData(written[0]), {});
      assert.strictEqual(res.end.mock.calls.length, 1);
    });

    it('does not write if already ended', () => {
      const res = {
        writableEnded: true,
        destroyed: false,
        write: mock.fn(),
        end: mock.fn(),
      };

      endSSE(res);

      assert.strictEqual(res.write.mock.calls.length, 0);
      assert.strictEqual(res.end.mock.calls.length, 0);
    });
  });

  describe('createSSEWriter', () => {
    let res;
    let written;
    let headers;

    beforeEach(() => {
      written = [];
      headers = {};
      res = {
        writableEnded: false,
        destroyed: false,
        setHeader: (key, value) => {
          headers[key] = value;
        },
        flushHeaders: mock.fn(),
        write: (data) => {
          written.push(data);
          return true;
        },
        flush: mock.fn(),
        end: mock.fn(),
      };
    });

    it('creates writer with all methods', () => {
      const writer = createSSEWriter(res);

      assert.strictEqual(typeof writer.write, 'function');
      assert.strictEqual(typeof writer.writeMeta, 'function');
      assert.strictEqual(typeof writer.writeDelta, 'function');
      assert.strictEqual(typeof writer.writeFinal, 'function');
      assert.strictEqual(typeof writer.writeError, 'function');
      assert.strictEqual(typeof writer.keepAlive, 'function');
      assert.strictEqual(typeof writer.end, 'function');
      assert.strictEqual(typeof writer.isWritable, 'function');
    });

    it('configures SSE on creation', () => {
      createSSEWriter(res);

      assert.strictEqual(headers['Content-Type'], 'text/event-stream');
      assert.strictEqual(res.flushHeaders.mock.calls.length, 1);
    });

    it('writeMeta sends meta event', () => {
      const writer = createSSEWriter(res);

      writer.writeMeta({ chatId: '123', messageId: '456', requestId: '789' });

      assert.strictEqual(
        written[0],
        'event: meta\ndata: {"chatId":"123","messageId":"456","requestId":"789"}\n\n',
      );
      const data = parseSseData(written[0]);
      assert.strictEqual(data.chatId, '123');
      assert.strictEqual(data.messageId, '456');
    });

    it('writeDelta sends delta event with content', () => {
      const writer = createSSEWriter(res);

      writer.writeDelta('Hello ');
      writer.writeDelta('World');

      assert.strictEqual(written[0], 'event: delta\ndata: {"content":"Hello "}\n\n');
      const delta1 = parseSseData(written[0]);
      assert.strictEqual(delta1.content, 'Hello ');

      assert.strictEqual(written[1], 'event: delta\ndata: {"content":"World"}\n\n');
      const delta2 = parseSseData(written[1]);
      assert.strictEqual(delta2.content, 'World');
    });

    it('writeFinal sends final event with content and usage', () => {
      const writer = createSSEWriter(res);
      const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };

      writer.writeFinal('Full response text', usage);

      assert.strictEqual(
        written[0],
        'event: final\ndata: {"content":"Full response text","usage":{"promptTokens":100,"completionTokens":50,"totalTokens":150}}\n\n',
      );
      const data = parseSseData(written[0]);
      assert.strictEqual(data.content, 'Full response text');
      assert.deepStrictEqual(data.usage, usage);
    });

    it('writeFinal works without usage', () => {
      const writer = createSSEWriter(res);

      writer.writeFinal('Response without usage');

      assert.strictEqual(
        written[0],
        'event: final\ndata: {"content":"Response without usage"}\n\n',
      );
      const data = parseSseData(written[0]);
      assert.strictEqual(data.content, 'Response without usage');
      assert.strictEqual(data.usage, undefined);
    });

    it('writeError sends error event', () => {
      const writer = createSSEWriter(res);

      writer.writeError('RATE_LIMIT', 'Too many requests', true);

      assert.strictEqual(
        written[0],
        'event: error\ndata: {"code":"RATE_LIMIT","message":"Too many requests","retryable":true}\n\n',
      );
      const data = parseSseData(written[0]);
      assert.strictEqual(data.code, 'RATE_LIMIT');
      assert.strictEqual(data.message, 'Too many requests');
      assert.strictEqual(data.retryable, true);
    });

    it('isWritable returns correct state', () => {
      const writer = createSSEWriter(res);

      assert.strictEqual(writer.isWritable(), true);

      res.writableEnded = true;
      assert.strictEqual(writer.isWritable(), false);
    });
  });
});
