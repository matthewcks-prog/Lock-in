import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@core": resolve(process.cwd(), "core"),
      "@api": resolve(process.cwd(), "api"),
      "@shared/ui": resolve(process.cwd(), "shared/ui"),
      "@ui": resolve(process.cwd(), "ui"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "backend/**",
      "extension/ui/**",
      "extension/libs/**",
      "dist/**",
    ],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
