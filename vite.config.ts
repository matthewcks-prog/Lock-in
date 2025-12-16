import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import {
  createAliases,
  createIifeBuildConfig,
  ensureAsciiSafeOutput,
  sharedDefines,
} from "./build/viteShared";

export default defineConfig({
  define: sharedDefines,
  css: {
    postcss: "./postcss.config.js",
  },
  plugins: [
    react(),
    ensureAsciiSafeOutput(
      resolve(process.cwd(), "extension/ui/index.js"),
      "Processed output file for ASCII compatibility"
    ),
  ],
  build: createIifeBuildConfig({
    outDir: "extension/ui",
    entry: "ui/extension/index.tsx",
    name: "LockInUI",
    fileName: "index.js",
  }),
  resolve: {
    alias: createAliases({ includeApi: true, includeSharedUi: true }),
  },
});
