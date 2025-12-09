import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath, URL } from "node:url";

/**
 * Vite config for building React components for Chrome extension
 * 
 * Outputs to extension/ui/ directory as IIFE format that can be loaded
 * by Chrome extension content scripts (which don't support ES modules).
 * 
 * Includes Tailwind CSS processing for modern component styling.
 */
export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process": JSON.stringify({}),
  },
  css: {
    postcss: "./postcss.config.js",
  },
  plugins: [react()],
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
