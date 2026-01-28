type TestRequire = {
  (id: string): unknown;
  cache: Record<string, { exports?: unknown } | undefined>;
  resolve: (id: string) => string;
};

declare module 'node:module' {
  export function createRequire(url: string): TestRequire;
}

declare const process: {
  env: Record<string, string | undefined>;
};
