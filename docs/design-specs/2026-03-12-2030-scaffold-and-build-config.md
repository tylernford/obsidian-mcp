# Scaffold & Build Config

**Created:** 2026-03-12
**Implementation Plan:** docs/implementation-plans/2026-03-12-2127-scaffold-and-build-config.md
**Parent Spec:** [Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)

---

## Overview

**What:** Set up the Obsidian plugin project structure — build system, config files, and a minimal plugin entry point — so the plugin loads in Obsidian and does nothing.

**Why:** This is the foundation that all subsequent phases (HTTP server, tool porting) build on. Getting the scaffold right means later phases can focus on functionality without fighting the build system.

**Type:** Refactor

---

## Requirements

### Must Have

- [ ] Existing source files (`src/`, `dist/`, `.nvmrc`, `eslint.config.js`) moved to `legacy/` for reference
- [ ] `plugin/` directory as the plugin project root containing all build config and source
- [ ] `plugin/package.json` with pnpm, correct dependencies, and build/dev/lint scripts
- [ ] `plugin/tsconfig.json` following scaffold conventions (type-checking only, esbuild builds)
- [ ] `plugin/esbuild.config.mjs` bundling `src/main.ts` → `main.js` (CJS, ES2018, tree shaking)
- [ ] `plugin/eslint.config.mts` with `typescript-eslint` + `eslint-plugin-obsidianmd`
- [ ] `plugin/manifest.json` with `id: "mcp-tools"`, `isDesktopOnly: true`, `minAppVersion: "1.12.0"`
- [ ] `plugin/versions.json` mapping plugin version to min Obsidian version
- [ ] `plugin/version-bump.mjs` syncing versions across `manifest.json` and `versions.json`
- [ ] `plugin/styles.css` (empty placeholder)
- [ ] `plugin/src/main.ts` — minimal `Plugin` subclass with `onload()`/`onunload()` logging
- [ ] Root `.gitignore` updated for `plugin/main.js` and `plugin/node_modules/`
- [ ] Root `lefthook.yml` updated with `root: "plugin/"` for all jobs
- [ ] Root `package.json` slimmed to lefthook-only
- [ ] `pnpm install` succeeds at both root (lefthook) and `plugin/` (dependencies)
- [ ] `pnpm build` in `plugin/` produces `main.js` at `plugin/` root
- [ ] Plugin loads in Obsidian without errors

### Nice to Have

- [ ] `pnpm dev` in `plugin/` runs esbuild in watch mode with inline sourcemaps

### Out of Scope

- Settings tab (Phase 2: HTTP Server & Auth)
- HTTP server (Phase 2)
- MCP tools (Phases 3–5)
- Tests
- Community plugin registry publishing

---

## Design Decisions

### 1. Plugin files in `plugin/` subdirectory, not repo root

**Options considered:**

1. Plugin files at repo root — simpler config, matches typical plugin repos
2. Plugin files in `plugin/` subdirectory — cleaner separation from repo-level concerns

**Decision:** `plugin/` subdirectory. This repo has non-plugin content (docs, legacy code, reference repos in `obsidianmd/`) that would clutter the plugin root. The directory can be symlinked into `.obsidian/plugins/mcp-tools/` for development. Everything can be moved up a level later if desired.

### 2. Existing source moved to `legacy/`, not deleted

**Options considered:**

1. Delete existing source files
2. Move to `legacy/` for reference during porting

**Decision:** Move to `legacy/`. Later phases port tool schemas, response formats, and patterns from the current implementation. Having them in-repo avoids hunting through git history.

### 3. Minimal root `package.json` for lefthook

**Options considered:**

1. Add lefthook as a dev dep in `plugin/package.json`
2. Keep a minimal `package.json` at repo root just for lefthook
3. Install lefthook globally

**Decision:** Minimal root `package.json`. Git hooks always run from repo root. Lefthook needs to be installable via `pnpm install` at root for contributors. The root `package.json` contains only `lefthook` as a dev dependency and is marked `private: true`. The `pnpm-workspace.yaml` stays to support this.

### 4. Lefthook `root` option for `plugin/` subdirectory

Lefthook's `root` option sets CWD to `plugin/` so commands find the right `package.json`, and filters `{staged_files}` to only files under `plugin/`. Glob patterns must still use the `plugin/` prefix since globs match from repo root.

[Lefthook `root` docs](https://github.com/evilmartians/lefthook/blob/master/docs/configuration/root.md)

### 5. `@types/node` pinned to `^16.11.6`

Matches the scaffold convention. Obsidian's Electron ships Node 20.18.x, but using `@types/node@^25` would expose APIs not available at runtime. The lower pin provides a safe type surface.

### 6. Sample plugin as reference, not copy-paste

Per the parent spec: replicate the scaffold's patterns tailored to this project rather than copying and gutting sample code. Files are purpose-built, diffs are clean.

---

## File Layout

### After scaffold is complete

```
.gitignore                        # Updated: add plugin/main.js, plugin/node_modules/
.prettierrc                       # Unchanged
lefthook.rc                       # Unchanged
lefthook.yml                      # Updated: root: "plugin/" on all jobs
package.json                      # Replaced: lefthook-only, private: true
pnpm-lock.yaml                    # Regenerated
pnpm-workspace.yaml               # Kept for root pnpm install
README.md                         # Unchanged
docs/                             # Unchanged
obsidianmd/                       # Unchanged (gitignored reference repos)
legacy/
  .nvmrc                          # Moved from root
  eslint.config.js                # Moved from root
  src/                            # Moved from root
    index.ts
    api-client.ts
    errors.ts
    tools/
  dist/                           # Moved from root
plugin/
  package.json                    # New: pnpm, deps, scripts
  tsconfig.json                   # New: type-checking config (scaffold pattern)
  esbuild.config.mjs              # New: bundle src/main.ts → main.js
  eslint.config.mts               # New: typescript-eslint + eslint-plugin-obsidianmd
  manifest.json                   # New: plugin metadata
  versions.json                   # New: version compatibility map
  version-bump.mjs                # New: version sync script
  styles.css                      # New: empty placeholder
  main.js                         # Build output (gitignored)
  src/
    main.ts                       # New: minimal Plugin subclass
```

### Key file contents

#### `plugin/package.json`

```json
{
  "name": "mcp-tools",
  "version": "1.0.0",
  "description": "MCP server for AI-assisted vault interaction",
  "main": "main.js",
  "type": "module",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "version": "node version-bump.mjs && git add manifest.json versions.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "packageManager": "pnpm@10.29.3",
  "dependencies": {
    "obsidian": "latest",
    "@modelcontextprotocol/sdk": "^1.26.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.30.1",
    "@types/node": "^16.11.6",
    "esbuild": "0.25.5",
    "eslint-plugin-obsidianmd": "0.1.9",
    "globals": "14.0.0",
    "jiti": "2.6.1",
    "prettier": "^3.8.1",
    "tslib": "2.4.0",
    "typescript": "^5.8.3",
    "typescript-eslint": "8.35.1"
  }
}
```

#### `plugin/manifest.json`

```json
{
  "id": "mcp-tools",
  "name": "MCP Tools",
  "version": "1.0.0",
  "minAppVersion": "1.12.0",
  "description": "MCP server for AI-assisted vault interaction",
  "author": "Tyler Ford",
  "isDesktopOnly": true
}
```

#### `plugin/src/main.ts`

```typescript
import { Plugin } from "obsidian";

export default class MCPToolsPlugin extends Plugin {
  async onload() {
    console.log("MCP Tools plugin loaded");
  }

  onunload() {
    console.log("MCP Tools plugin unloaded");
  }
}
```

#### Root `package.json`

```json
{
  "private": true,
  "devDependencies": {
    "lefthook": "^2.1.1"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["lefthook"]
  }
}
```

#### `lefthook.yml`

```yaml
rc: ./lefthook.rc

pre-commit:
  piped: true
  jobs:
    - name: prettier
      root: "plugin/"
      glob: "plugin/*.{ts,tsx,mts,js,jsx,mjs,json,css,md,yml,yaml}"
      run: pnpm prettier --write {staged_files} && git add {staged_files}

    - name: typecheck
      root: "plugin/"
      run: pnpm tsc --noEmit

    - name: lint
      root: "plugin/"
      glob: "plugin/*.{ts,tsx,mts,js,jsx,mjs}"
      run: pnpm eslint --fix {staged_files} && git add {staged_files}
```

---

## Acceptance Criteria

- [ ] `legacy/` contains `src/`, `dist/`, `.nvmrc`, `eslint.config.js` — no dangling references elsewhere
- [ ] `pnpm install` at repo root succeeds and installs lefthook
- [ ] `pnpm install` in `plugin/` succeeds and installs all dependencies
- [ ] `pnpm build` in `plugin/` produces `plugin/main.js` (CJS format)
- [ ] `pnpm dev` in `plugin/` starts esbuild in watch mode
- [ ] `pnpm typecheck` in `plugin/` passes with no errors
- [ ] `pnpm lint` in `plugin/` passes with no errors
- [ ] Plugin loads in Obsidian (symlink `plugin/` → `.obsidian/plugins/mcp-tools/`, enable plugin, no console errors)
- [ ] Plugin unloads cleanly (disable plugin, no console errors or orphaned state)
- [ ] Lefthook pre-commit hooks run successfully when committing changes under `plugin/`
- [ ] `plugin/main.js` and `plugin/node_modules/` are gitignored

---

## References

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) (local: `obsidianmd/obsidian-sample-plugin/`)
- [Parent Spec: Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)
- [Lefthook `root` option](https://github.com/evilmartians/lefthook/blob/master/docs/configuration/root.md)
