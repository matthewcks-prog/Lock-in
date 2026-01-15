type TestRequire = {
  (id: string): any;
  cache: Record<string, { exports?: any } | undefined>;
  resolve: (id: string) => string;
};

declare module 'node:module' {
  export function createRequire(url: string): TestRequire;
}

declare const process: {
  env: Record<string, string | undefined>;
};
