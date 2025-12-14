/**
 * Vite config for building content script libraries bundle
 * 
 * Bundles extension/src/contentLibs.ts and its dependencies into a single IIFE file
 * at extension/libs/contentLibs.js that can be loaded by Chrome extension content scripts.
 * 
 * This includes:
 * - Logger (window.LockInLogger)
 * - Messaging (window.LockInMessaging)
 * - Storage (window.LockInStorage)
 * - Page context resolver with adapters (window.LockInContent.resolveAdapterContext)
 */

import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "node:fs";

// Plugin to ensure ASCII-safe output for Chrome extension content scripts
function ensureAsciiSafeOutput() {
  return {
    name: "ensure-ascii-safe-output",
    closeBundle() {
      const filePath = resolve(process.cwd(), "extension/libs/contentLibs.js");
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
        console.log("Processed contentLibs.js for ASCII compatibility");
      } catch (err) {
        console.error("Error processing contentLibs.js:", err);
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
    emptyOutDir: false, // Don't delete other files in libs/
    lib: {
      entry: resolve(process.cwd(), "./extension/src/contentLibs.ts"),
      name: "LockInContentLibs",
      formats: ["iife"],
      fileName: () => "contentLibs.js",
    },
    rollupOptions: {
      external: [],
      output: {
        format: "iife",
        name: "LockInContentLibs",
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
      "@integrations": resolve(process.cwd(), "integrations"),
    },
    extensions: [".ts", ".js"],
  },
});
