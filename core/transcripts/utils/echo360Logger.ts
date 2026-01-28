import { logWithPrefix } from './transcriptLogger';

const LOG_PREFIX = '[Lock-in Transcript:Echo360]';

export function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  requestId: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const prefix = `${LOG_PREFIX} [${requestId}]`;
  logWithPrefix(prefix, level, message, meta);
}
