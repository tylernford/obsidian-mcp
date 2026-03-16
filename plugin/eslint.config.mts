import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.mts", "manifest.json"],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    plugins: {
      obsidianmd,
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "error",
        {
          acronyms: ["API", "CLI", "HTTP", "MCP"],
          brands: ["Claude Code"],
        },
      ],
    },
  },
  // Server code uses Node.js APIs (http, Buffer, etc.)
  {
    files: ["src/server.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  // Test files run in Node.js via Vitest, not in Obsidian
  {
    files: ["src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-restricted-globals": "off",
    },
  },
  globalIgnores([
    "node_modules",
    "dist",
    "esbuild.config.mjs",
    "vitest.config.ts",
    "eslint.config.mts",
    "version-bump.mjs",
    "versions.json",
    "main.js",
  ]),
);
