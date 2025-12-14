/**
 * Vite config for building initApi.js bundle
 * 
 * Bundles extension/libs/initApi.ts and its dependencies (api/client.ts, api/auth.ts)
 * into a single IIFE file that can be loaded by Chrome extension content scripts.
 */

import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "node:fs";

// Plugin to ensure ASCII-safe output for Chrome extension content scripts
function ensureAsciiSafeOutput() {
  return {
    name: "ensure-ascii-safe-output",
    closeBundle() {
      const filePath = resolve(process.cwd(), "extension/libs/initApi.js");
      try {
        let content = readFileSync(filePath, "utf8");
        // Remove BOM if present
        content = content.replace(/^\uFEFF/, "");
        // Escape non-ASCII characters to Unicode escapes for Chrome compatibility
        content = content.replace(/[^\x00-\x7F]/g, (char: string) => {
          const code = char.charCodeAt(0);
          if (code > 0xFFFF) {
            // Handle surrogate pairs for characters outside BMP
            const offset = code - 0x10000;
            const high = 0xD800 + (offset >> 10);
            const low = 0xDC00 + (offset & 0x3FF);
            return `\\u${high.toString(16).padStart(4, '0')}\\u${low.toString(16).padStart(4, '0')}`;
          }
          return `\\u${code.toString(16).padStart(4, '0')}`;
        });
        writeFileSync(filePath, content, { encoding: "utf8" });
        console.log("Processed initApi.js for ASCII compatibility");
      } catch (err) {
        console.error("Error processing initApi.js:", err);
      }
    },
  };
}

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process": JSON.stringify({}),
  },
  plugins: [ensureAsciiSafeOutput()],
  build: {
    outDir: "extension/libs",
    lib: {
      entry: resolve(process.cwd(), "./extension/libs/initApi.ts"),
      name: "LockInInit",
      formats: ["iife"],
      fileName: () => "initApi.js",
    },
    rollupOptions: {
      external: [],
      output: {
        format: "iife",
        name: "LockInInit",
        extend: true,
        inlineDynamicImports: true,
        generatedCode: {
          constBindings: false,
        },
      },
    },
    minify: false,
    sourcemap: true,
    target: "es2015",
  },
  resolve: {
    alias: {
      "@core": resolve(process.cwd(), "core"),
      "@api": resolve(process.cwd(), "api"),
    },
    extensions: [".ts", ".js"],
  },
});

