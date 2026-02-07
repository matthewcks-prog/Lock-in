/**
 * Message schema validation for background/content script messaging.
 *
 * Bundled into extension/dist/libs/messageSchemas.js and exposed as LockInMessageSchemas.
 */

import { z } from 'zod';
import { createRuntimeValidators, type RuntimeValidators } from './runtimeSchemas';

export type MessageValidationResult =
  | { ok: true; payload?: Record<string, unknown> }
  | {
      ok: false;
      error: string;
      meta?: Record<string, unknown>;
      fallback?: Record<string, unknown>;
    };

type MessageValidator = (message: unknown) => MessageValidationResult;

const OptionalRecord = z.record(z.unknown()).nullable().optional();
const OptionalUnknown = z.unknown().optional();

const MessageWithPayloadSchema = z
  .object({
    payload: z.record(z.unknown()).optional(),
  })
  .passthrough();

const SessionMessageSchema = z
  .object({
    sessionData: OptionalUnknown,
    payload: z.object({ sessionData: OptionalUnknown }).optional(),
  })
  .passthrough();

const SettingsMessageSchema = z
  .object({
    settings: OptionalRecord,
    payload: z.object({ settings: OptionalRecord }).optional(),
  })
  .passthrough();

const VideoMessageSchema = z
  .object({
    video: OptionalUnknown,
    payload: z.object({ video: OptionalUnknown }).optional(),
  })
  .passthrough();

const ContextMessageSchema = z
  .object({
    context: OptionalUnknown,
    payload: z.object({ context: OptionalUnknown }).optional(),
  })
  .passthrough();

const TokenMessageSchema = z
  .object({
    token: z.string().optional(),
    payload: z.object({ token: z.string().optional() }).optional(),
  })
  .passthrough();

const errorFromZod = (error: z.ZodError): MessageValidationResult => ({
  ok: false,
  error: 'Invalid message format',
  meta: { issues: error.issues },
});

const ensureObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

export function createMessageValidators(): Record<string, MessageValidator> {
  return {
    getTabId: () => ({ ok: true }),
    GET_TAB_ID: () => ({ ok: true }),
    getSession: () => ({ ok: true }),
    GET_SESSION: () => ({ ok: true }),
    saveSession: (message) => {
      const parsed = SessionMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return {
        ok: true,
        payload: {
          sessionData: parsed.data.sessionData ?? parsed.data.payload?.sessionData,
        },
      };
    },
    SAVE_SESSION: (message) => {
      const parsed = SessionMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return {
        ok: true,
        payload: {
          sessionData: parsed.data.sessionData ?? parsed.data.payload?.sessionData,
        },
      };
    },
    clearSession: () => ({ ok: true }),
    CLEAR_SESSION: () => ({ ok: true }),
    getSettings: () => ({ ok: true }),
    GET_SETTINGS: () => ({ ok: true }),
    saveSettings: (message) => {
      const parsed = SettingsMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return {
        ok: true,
        payload: {
          settings: ensureObject(parsed.data.settings ?? parsed.data.payload?.settings),
        },
      };
    },
    UPDATE_SETTINGS: (message) => {
      const parsed = SettingsMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return {
        ok: true,
        payload: {
          settings: ensureObject(parsed.data.settings ?? parsed.data.payload?.settings),
        },
      };
    },
    extractTranscript: (message) => {
      const parsed = VideoMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return { ok: true, payload: { video: parsed.data.video ?? parsed.data.payload?.video } };
    },
    EXTRACT_TRANSCRIPT: (message) => {
      const parsed = VideoMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return { ok: true, payload: { video: parsed.data.video ?? parsed.data.payload?.video } };
    },
    DETECT_ECHO360_VIDEOS: (message) => {
      const parsed = ContextMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return {
        ok: true,
        payload: { context: parsed.data.context ?? parsed.data.payload?.context },
      };
    },
    FETCH_PANOPTO_MEDIA_URL: (message) => {
      const parsed = VideoMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return { ok: true, payload: { video: parsed.data.video ?? parsed.data.payload?.video } };
    },
    TRANSCRIBE_MEDIA_AI: (message) => {
      const parsed = MessageWithPayloadSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return { ok: true, payload: ensureObject(parsed.data.payload ?? parsed.data) };
    },
    MEDIA_CHUNK: (message) => {
      const parsed = MessageWithPayloadSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return { ok: true, payload: ensureObject(parsed.data.payload) };
    },
    LIST_ACTIVE_TRANSCRIPT_JOBS: (message) => {
      const parsed = TokenMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return { ok: true, payload: { token: parsed.data.token ?? parsed.data.payload?.token } };
    },
    CANCEL_ALL_ACTIVE_TRANSCRIPT_JOBS: (message) => {
      const parsed = TokenMessageSchema.safeParse(message);
      if (!parsed.success) return errorFromZod(parsed.error);
      return { ok: true, payload: { token: parsed.data.token ?? parsed.data.payload?.token } };
    },
  };
}

const root = typeof globalThis !== 'undefined' ? globalThis : self;
type MessageSchemaRegistry = {
  createMessageValidators: () => Record<string, MessageValidator>;
  createRuntimeValidators?: () => RuntimeValidators;
};

const rootWithRegistry = root as typeof globalThis & {
  LockInMessageSchemas?: MessageSchemaRegistry;
};

const registry: MessageSchemaRegistry = rootWithRegistry.LockInMessageSchemas ?? {
  createMessageValidators,
};

registry.createMessageValidators = createMessageValidators;
registry.createRuntimeValidators = createRuntimeValidators;
rootWithRegistry.LockInMessageSchemas = registry;

export { registry as LockInMessageSchemas };
