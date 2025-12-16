/**
 * Content Script Libraries Entry Point
 *
 * Bundles the canonical LockIn content runtime for content scripts.
 * Bundled by vite.config.contentLibs.ts into extension/libs/contentLibs.js.
 */

import "./logger";
import "./messaging";
import "./storage";
import { createContentRuntime } from "./contentRuntime";

if (typeof window !== "undefined") {
  const runtime = createContentRuntime();
  (window as any).LockInContent = runtime;
  (window as any).LockInContent.__version = runtime.__version;
}

export { createContentRuntime };
