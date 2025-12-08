/**
 * Copy manifest.json and process assets to extension directory after build
 * Ensures all necessary files are in place for the extension
 */

import { copyFileSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const manifestSource = resolve(process.cwd(), "extension/manifest.json");
const manifestDest = resolve(process.cwd(), "extension/ui/manifest.json");
const cssSource = resolve(process.cwd(), "extension/ui/lock-in-extension.css");
const cssDest = resolve(process.cwd(), "extension/ui/contentScript.css");

try {
  copyFileSync(manifestSource, manifestDest);
  console.log("✓ Copied manifest.json to extension/ui/");

  // Copy generated CSS with the expected name for content scripts
  copyFileSync(cssSource, cssDest);
  console.log("✓ Copied lock-in-extension.css as contentScript.css");
} catch (error) {
  console.error("Failed to copy files:", error);
  process.exit(1);
}
