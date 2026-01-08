// Minimal typings to satisfy tsc for jsdom imports in tests without pulling @types/jsdom.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: unknown);
    window: Window & typeof globalThis;
    serialize(): string;
  }
}
