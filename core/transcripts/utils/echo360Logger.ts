const LOG_PREFIX = '[Lock-in Transcript:Echo360]';

export function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  requestId: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const logFn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'debug'
          ? console.debug
          : console.info;
  const msg = `${LOG_PREFIX} [${requestId}] ${message}`;
  meta ? logFn(msg, meta) : logFn(msg);
}
