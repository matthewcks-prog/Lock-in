import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Vite config for building React components for Chrome extension
 * 
 * Outputs to extension/ui/ directory as IIFE format that can be loaded
 * by Chrome extension content scripts (which don't support ES modules).
 * 
 * Includes Tailwind CSS processing for modern component styling.
 */

// Plugin to ensure ASCII-safe output for Chrome extension content scripts
function ensureAsciiSafeOutput() {
  return {
    name: "ensure-ascii-safe-output",
    closeBundle() {
      const filePath = resolve(process.cwd(), "extension/ui/index.js");
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
        console.log("Processed output file for ASCII compatibility");
      } catch (err) {
        console.error("Error processing output file:", err);
      }
    },
  };
}

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process": JSON.stringify({}),
  },
  css: {
    postcss: "./postcss.config.js",
  },
  plugins: [react(), ensureAsciiSafeOutput()],
  build: {
    outDir: "extension/ui",
    lib: {
      // Source entry lives under ui/extension, build outputs to extension/ui
      entry: resolve(process.cwd(), "ui/extension/index.tsx"),
      name: "LockInUI",
      formats: ["iife"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [],
      output: {
        format: "iife",
        name: "LockInUI",
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
      "@shared/ui": resolve(process.cwd(), "shared/ui"),
    },
  },
});
