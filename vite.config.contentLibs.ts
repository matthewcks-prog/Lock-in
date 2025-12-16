/**
 * Vite config for building content script libraries bundle
 * 
 * Bundles extension/src/contentLibs.ts and its dependencies into a single IIFE file
 * at extension/libs/contentLibs.js that can be loaded by Chrome extension content scripts.
 * 
 * This includes:
 * - Canonical runtime (window.LockInContent)
 * - Logger (window.LockInLogger)
 * - Messaging (window.LockInMessaging)
 * - Storage (window.LockInStorage)
 */

import { defineConfig } from "vite";
import { resolve } from "path";
import {
  createAliases,
  createIifeBuildConfig,
  ensureAsciiSafeOutput,
  sharedDefines,
} from "./build/viteShared";

export default defineConfig({
  define: sharedDefines,
  plugins: [
    ensureAsciiSafeOutput(
      resolve(process.cwd(), "extension/libs/contentLibs.js"),
      "Processed contentLibs.js for ASCII compatibility"
    ),
  ],
  build: createIifeBuildConfig({
    outDir: "extension/libs",
    emptyOutDir: false, // Don't delete other files in libs/
    entry: "./extension/src/contentLibs.ts",
    name: "LockInContentLibs",
    fileName: "contentLibs.js",
  }),
  resolve: {
    alias: createAliases({ includeIntegrations: true }),
    extensions: [".ts", ".js"],
  },
});
