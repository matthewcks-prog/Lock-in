import type { LockInContentRuntime } from "./contentRuntime";

declare global {
  interface Window {
    LockInContent: LockInContentRuntime;
  }
}

export {};
