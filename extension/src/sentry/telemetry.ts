import type { ChromeLike } from './chromeTypes';

const TELEMETRY_OPT_OUT_KEY = 'lockin_telemetry_disabled';

export async function isTelemetryEnabled(chrome: ChromeLike | undefined): Promise<boolean> {
  try {
    const storage = chrome?.storage?.sync;
    if (storage === undefined) {
      return true;
    }
    const result = await storage.get([TELEMETRY_OPT_OUT_KEY]);
    return result[TELEMETRY_OPT_OUT_KEY] !== true;
  } catch {
    return true;
  }
}

export async function setTelemetryEnabled(
  chrome: ChromeLike | undefined,
  enabled: boolean,
): Promise<void> {
  try {
    const storage = chrome?.storage?.sync;
    if (storage !== undefined) {
      await storage.set({ [TELEMETRY_OPT_OUT_KEY]: !enabled });
    }
  } catch {
    // Ignore storage errors
  }
}
