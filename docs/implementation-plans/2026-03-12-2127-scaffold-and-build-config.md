# Implementation Plan: Scaffold & Build Config

**Created:** 2026-03-12
**Type:** Refactor
**Overview:** Set up the Obsidian plugin project structure — build system, config files, and a minimal plugin entry point — so the plugin loads in Obsidian and does nothing.
**Design Spec:** docs/design-specs/2026-03-12-2030-scaffold-and-build-config.md

---

## Summary

Move existing source to `legacy/`, create a `plugin/` directory with full Obsidian plugin build toolchain (esbuild, TypeScript, ESLint), and a minimal plugin entry point. Root config slimmed to lefthook + prettier only, with lefthook hooks updated so prettier covers the full repo while typecheck/lint target `plugin/`.

---

## Codebase Verification

_Confirmed 2026-03-12 against actual codebase_

- [x] `src/` exists with `index.ts`, `api-client.ts`, `errors.ts`, `tools/` (7 tool files) — Verified
- [x] `dist/` exists at root — Verified
- [x] `.nvmrc` exists at root — Verified
- [x] `eslint.config.js` exists at root — Verified
- [x] Root `package.json` has lefthook + current MCP deps — Verified
- [x] `lefthook.yml` exists without `root:` option — Verified
- [x] `pnpm-workspace.yaml` exists — Verified
- [x] No `legacy/` or `plugin/` directories yet — Verified

**Patterns to leverage:**

- Obsidian sample plugin scaffold at `obsidianmd/obsidian-sample-plugin/` — verified file contents for `esbuild.config.mjs`, `tsconfig.json`, `eslint.config.mts`, `version-bump.mjs`

**Discrepancies found (design spec corrections):**

- Prettier removed from `plugin/devDependencies` — lives at root per Option 1 decision (prettier at root for full-repo coverage including `docs/`)
- `format` script removed from `plugin/package.json` — redundant with root prettier
- `@modelcontextprotocol/sdk` and `zod` deferred to Phase 3 — not needed for scaffold
- `versions.json` uses `"1.0.0": "1.12.0"` (not `"0.15.0"`) to match our `manifest.json` `minAppVersion`
- `eslint.config.mts` references updated from `.js` to `.mts` in `allowDefaultProject` and `globalIgnores`
- `@eslint/js` uses caret `^9.30.1` (design spec value kept, scaffold uses exact pin)

---

## Tasks

### Task 1: Move existing source to `legacy/`

**Description:** Move `src/`, `dist/`, `.nvmrc`, and `eslint.config.js` to a new `legacy/` directory. Remove root `tsconfig.json` (superseded by plugin's tsconfig).

**Files:**

- `legacy/` — create directory
- `legacy/src/` — move from `src/`
- `legacy/dist/` — move from `dist/`
- `legacy/.nvmrc` — move from `.nvmrc`
- `legacy/eslint.config.js` — move from `eslint.config.js`
- `tsconfig.json` — delete

**Done when:** Files exist under `legacy/`, originals removed from root, no dangling references.
**Commit:** `refactor: Move existing source files to legacy/`

---

### Task 2: Update root config files

**Description:** Replace root `package.json` with lefthook + prettier only (`private: true`). Update `.gitignore` to add `plugin/main.js` and `plugin/node_modules/`. Update `lefthook.yml`: prettier job without `root:` (covers docs + plugin), typecheck and lint jobs with `root: "plugin/"`.

**Files:**

- `package.json` — replace contents
- `.gitignore` — modify
- `lefthook.yml` — replace contents

**Root `package.json`:**

```json
{
  "private": true,
  "devDependencies": {
    "lefthook": "^2.1.1",
    "prettier": "^3.8.1"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["lefthook"]
  }
}
```

**`.gitignore` additions:**

```
plugin/main.js
plugin/node_modules/
```

**`lefthook.yml`:**

```yaml
rc: ./lefthook.rc

pre-commit:
  piped: true
  jobs:
    - name: prettier
      glob: "*.{ts,tsx,mts,js,jsx,mjs,json,css,md,yml,yaml}"
      run: pnpm prettier --write {staged_files} && git add {staged_files}

    - name: typecheck
      root: "plugin/"
      run: pnpm tsc --noEmit

    - name: lint
      root: "plugin/"
      glob: "plugin/*.{ts,tsx,mts,js,jsx,mjs}"
      run: pnpm eslint --fix {staged_files} && git add {staged_files}
```

**Done when:** `pnpm install` at root succeeds, installs only lefthook + prettier.
**Commit:** `refactor: Slim root config to lefthook + prettier, update gitignore and hooks`

---

### Task 3: Create plugin build config

**Description:** Create `plugin/` directory with all build config files. Contents derived from the obsidian-sample-plugin scaffold with project-specific adjustments noted in the discrepancies section.

**Files:**

- `plugin/package.json` — create
- `plugin/tsconfig.json` — create (copy from scaffold)
- `plugin/esbuild.config.mjs` — create (copy from scaffold)
- `plugin/eslint.config.mts` — create (adapted from scaffold, `.mts` references)
- `plugin/manifest.json` — create
- `plugin/versions.json` — create
- `plugin/version-bump.mjs` — create (copy from scaffold)
- `plugin/styles.css` — create (empty)

**`plugin/package.json`:**

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
    "lint": "eslint ."
  },
  "packageManager": "pnpm@10.29.3",
  "dependencies": {
    "obsidian": "latest"
  },
  "devDependencies": {
    "@eslint/js": "^9.30.1",
    "@types/node": "^16.11.6",
    "esbuild": "0.25.5",
    "eslint-plugin-obsidianmd": "0.1.9",
    "globals": "14.0.0",
    "jiti": "2.6.1",
    "tslib": "2.4.0",
    "typescript": "^5.8.3",
    "typescript-eslint": "8.35.1"
  }
}
```

**`plugin/manifest.json`:**

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

**`plugin/versions.json`:**

```json
{
  "1.0.0": "1.12.0"
}
```

**`plugin/tsconfig.json`:** Copy from scaffold (`obsidianmd/obsidian-sample-plugin/tsconfig.json`)

**`plugin/esbuild.config.mjs`:** Copy from scaffold (`obsidianmd/obsidian-sample-plugin/esbuild.config.mjs`)

**`plugin/eslint.config.mts`:** Adapted from scaffold — update `allowDefaultProject` and `globalIgnores` references from `eslint.config.js` to `eslint.config.mts`

**`plugin/version-bump.mjs`:** Copy from scaffold (`obsidianmd/obsidian-sample-plugin/version-bump.mjs`)

**`plugin/styles.css`:** Empty file

**Done when:** `pnpm install` in `plugin/` succeeds, all dependencies resolve.
**Commit:** `feat: Add plugin build config and toolchain`

---

### Task 4: Create minimal plugin entry point and verify

**Description:** Create `plugin/src/main.ts` with the minimal `MCPToolsPlugin` class. Run full verification suite.

**Files:**

- `plugin/src/main.ts` — create

**`plugin/src/main.ts`:**

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

**Done when:**

- `pnpm build` in `plugin/` produces `plugin/main.js`
- `pnpm typecheck` in `plugin/` passes
- `pnpm lint` in `plugin/` passes
- Lefthook pre-commit hooks pass on a test commit
- Plugin loads/unloads in Obsidian without console errors (manual verification)

**Commit:** `feat: Add minimal plugin entry point`

---

## Acceptance Criteria

_From design spec_

- [x] `legacy/` contains `src/`, `dist/`, `.nvmrc`, `eslint.config.js` — no dangling references elsewhere
- [x] `pnpm install` at repo root succeeds and installs lefthook + prettier
- [x] `pnpm install` in `plugin/` succeeds and installs all dependencies
- [x] `pnpm build` in `plugin/` produces `plugin/main.js` (CJS format)
- [x] `pnpm dev` in `plugin/` starts esbuild in watch mode
- [x] `pnpm typecheck` in `plugin/` passes with no errors
- [x] `pnpm lint` in `plugin/` passes with no errors
- [x] Plugin loads in Obsidian (symlink `plugin/` → `.obsidian/plugins/mcp-tools/`, enable plugin, no console errors)
- [x] Plugin unloads cleanly (disable plugin, no console errors or orphaned state)
- [x] Lefthook pre-commit hooks run successfully when committing changes under `plugin/`
- [x] Lefthook prettier hook runs on `docs/` files
- [x] `plugin/main.js` and `plugin/node_modules/` are gitignored

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                                                                                                                 | Notes                                                                                                                                                                        |
| ---------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-12 | Task 1 | legacy/src/, legacy/dist/, legacy/.nvmrc, legacy/eslint.config.js, tsconfig.json                                      | Moved as planned, no dangling functional references                                                                                                                          |
| 2026-03-13 | Task 2 | package.json, .gitignore, lefthook.yml                                                                                | As planned; pnpm install succeeds with only lefthook + prettier                                                                                                              |
| 2026-03-13 | Task 3 | plugin/{package,manifest,versions,tsconfig}.json, esbuild.config.mjs, eslint.config.mts, version-bump.mjs, styles.css | Deviated: added `packages: ["plugin"]` to pnpm-workspace.yaml and `esbuild` to root onlyBuiltDependencies — without these, plugin deps weren't installed as workspace member |
| 2026-03-13 | Task 4 | plugin/src/main.ts                                                                                                    | Deviated: changed console.log to console.debug — obsidianmd ESLint plugin disallows console.log                                                                              |

---

## Completion

**Completed:** 2026-03-13
**Final Status:** Complete

**Summary:** Moved existing source to legacy/, set up pnpm workspace with plugin/ as a member, created full Obsidian plugin build toolchain (esbuild, TypeScript, ESLint with obsidianmd plugin), and a minimal MCPToolsPlugin entry point that loads/unloads cleanly.

**Deviations from Plan:**

- Added `packages: ["plugin"]` to `pnpm-workspace.yaml` — required for plugin deps to install as workspace member
- Added `esbuild` to root `onlyBuiltDependencies` — pnpm 10 blocks build scripts by default
- Changed `console.log` to `console.debug` in main.ts — obsidianmd ESLint plugin disallows `console.log`

---

## Notes

- Prettier at root (Option 1) deviates from design spec's "lefthook-only root" but provides full-repo prettier coverage including `docs/` without brittle path workarounds
- MCP SDK and Zod deps deferred to Phase 3 to keep scaffold minimal
- Manual Obsidian verification (load/unload) required — cannot be automated in CI
