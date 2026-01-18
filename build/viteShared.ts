import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { PluginOption, UserConfig } from "vite";

type AliasOptions = {
  includeCore?: boolean;
  includeApi?: boolean;
  includeSharedUi?: boolean;
  includeIntegrations?: boolean;
  extra?: Record<string, string>;
};

/**
 * Create define replacements that respect build mode.
 * This ensures JSX runtime (jsxDEV vs jsx) matches NODE_ENV.
 */
export function createDefines(mode: string) {
  const nodeEnv = mode === 'development' ? 'development' : 'production';
  return {
    "process.env.NODE_ENV": JSON.stringify(nodeEnv),
    process: JSON.stringify({}),
  };
}

/** @deprecated Use createDefines(mode) instead for proper JSX runtime alignment */
export const sharedDefines = {
  "process.env.NODE_ENV": JSON.stringify("production"),
  process: JSON.stringify({}),
};

export function createAliases(options: AliasOptions = {}): Record<string, string> {
  const {
    includeCore = true,
    includeApi = false,
    includeSharedUi = false,
    includeIntegrations = false,
    extra = {},
  } = options;

  const aliases: Record<string, string> = { ...extra };
  if (includeCore) {
    aliases["@core"] = resolve(process.cwd(), "core");
  }
  if (includeApi) {
    aliases["@api"] = resolve(process.cwd(), "api");
  }
  if (includeSharedUi) {
    aliases["@shared/ui"] = resolve(process.cwd(), "shared/ui");
  }
  if (includeIntegrations) {
    aliases["@integrations"] = resolve(process.cwd(), "integrations");
  }

  return aliases;
}

export function createOptionalDependencyAliases(): Array<{
  find: string | RegExp;
  replacement: string;
}> {
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const optionalAliases: Array<{ pkg: string; stub: string }> = [
    {
      pkg: "react-syntax-highlighter/dist/esm/styles/prism",
      stub: "tools/stubs/react-syntax-highlighter-prism.ts",
    },
    { pkg: "react-syntax-highlighter", stub: "tools/stubs/react-syntax-highlighter.tsx" },
    { pkg: "react-markdown", stub: "tools/stubs/react-markdown.tsx" },
    { pkg: "remark-gfm", stub: "tools/stubs/remark-gfm.ts" },
  ];

  return optionalAliases.reduce<Array<{ find: string | RegExp; replacement: string }>>(
    (aliases, { pkg, stub }) => {
      const packageRoot = pkg.split("/")[0];
      const packageJsonPath = resolve(process.cwd(), "node_modules", packageRoot, "package.json");
      if (!existsSync(packageJsonPath)) {
        aliases.push({
          find: new RegExp(`^${escapeRegex(pkg)}$`),
          replacement: resolve(process.cwd(), stub),
        });
      }
      return aliases;
    },
    [],
  );
}

export function ensureAsciiSafeOutput(
  outputFilePath: string,
  logLabel?: string
): PluginOption {
  return {
    name: "ensure-ascii-safe-output",
    closeBundle() {
      try {
        let content = readFileSync(outputFilePath, "utf8");
        content = content.replace(/^\uFEFF/, "");
        content = content.replace(/[^\x00-\x7F]/g, (char: string) => {
          const code = char.charCodeAt(0);
          if (code > 0xffff) {
            const offset = code - 0x10000;
            const high = 0xd800 + (offset >> 10);
            const low = 0xdc00 + (offset & 0x3ff);
            return `\\u${high.toString(16).padStart(4, "0")}\\u${low
              .toString(16)
              .padStart(4, "0")}`;
          }
          return `\\u${code.toString(16).padStart(4, "0")}`;
        });
        writeFileSync(outputFilePath, content, { encoding: "utf8" });
        console.log(
          logLabel ??
            `Processed ${outputFilePath} for ASCII compatibility`
        );
      } catch (err) {
        console.error(
          `Error processing output file (${outputFilePath}):`,
          err
        );
      }
    },
  };
}

export function createIifeBuildConfig(
  options: {
    outDir: string;
    entry: string;
    name: string;
    fileName: string;
    emptyOutDir?: boolean;
    sourcemap?: boolean;
    target?: string;
  }
): UserConfig["build"] {
  const {
    outDir,
    entry,
    name,
    fileName,
    emptyOutDir,
    sourcemap = true,
    target = "es2015",
  } = options;
  const banner = [
    "/* Generated file. Do not edit directly.",
    ` * Source: ${entry}`,
    " */",
    "",
  ].join("\n");

  return {
    outDir,
    emptyOutDir,
    lib: {
      entry: resolve(process.cwd(), entry),
      name,
      formats: ["iife"],
      fileName: () => fileName,
    },
    rollupOptions: {
      external: [],
      output: {
        format: "iife",
        name,
        extend: true,
        inlineDynamicImports: true,
        generatedCode: {
          constBindings: false,
        },
        banner,
      },
    },
    minify: false,
    sourcemap,
    target,
  };
}
