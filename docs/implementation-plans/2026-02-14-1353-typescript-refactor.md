# Implementation Plan: TypeScript Refactor

**Design Doc:** docs/design-plans/2026-02-14-1042-typescript-refactor.md
**Created:** 2026-02-14

---

## Summary

Convert the entire codebase from JavaScript to TypeScript with `strict: true`, add a `tsc` build step, and establish code quality tooling (ESLint, Prettier, Lefthook).

---

## Codebase Verification

_Confirmed 2026-02-14 against actual codebase_

- [x] 8 JS source files in `src/` (1 api-client + 7 tool files) - Verified
- [x] Root `index.js` entry point exists - Verified
- [x] 15 tools across 7 files - Verified
- [x] ES modules enabled (`"type": "module"` in package.json) - Verified
- [x] No existing TypeScript, ESLint, Prettier, or Lefthook config - Verified
- [x] No `dist/` directory exists - Verified
- [x] MCP SDK `^1.26.0`, Zod `^3.24.0` - Verified
- [x] No devDependencies currently - Verified

**Patterns to leverage:**

- Consistent `register*Tools(server, client)` pattern across all tool files
- SDK generics infer handler parameter types from Zod schemas automatically

**Discrepancies found:**

- Design types `apiKey` as optional (`apiKey?: string`), but constructor throws if missing. Will type the constructor param as required (`string`) and handle the env-var read as `string | undefined` at the call site.

---

## Tasks

### Task 1: Add TypeScript and build infrastructure

**Description:** Install TypeScript via CLI, create `tsconfig.json`, update `package.json` scripts and entry point, add `dist/` to `.gitignore`.

**Files:**

- `tsconfig.json` — create
- `package.json` — modify (`main`, `scripts`)
- `.gitignore` — modify (add `dist/`)

**Steps:**

1. `pnpm add -D typescript`
2. Create `tsconfig.json` with strict config from design doc
3. Update `package.json`: set `"main": "dist/index.js"`, add `build`, `start`, `typecheck` scripts
4. Add `dist/` to `.gitignore`

**Done when:** `pnpm install` succeeds with `typescript` in devDependencies. `tsconfig.json` exists with `strict: true`. `pnpm build` runs (will fail until source files exist — that's expected).

**Commit:** `"Add TypeScript build infrastructure"`

---

### Task 2: Convert api-client and index to TypeScript

**Description:** Rename `src/api-client.js` → `src/api-client.ts` with typed interfaces (`ObsidianClientConfig`, `RequestOptions`, `PatchOptions`, `ApiResponse`). Move root `index.js` → `src/index.ts` with typed imports. Delete original `.js` files in-place.

**Files:**

- `src/api-client.ts` — create (replace `src/api-client.js`)
- `src/index.ts` — create (replace root `index.js`)
- `src/api-client.js` — delete
- `index.js` — delete

**Key types to define in `src/api-client.ts`:**

```ts
interface ObsidianClientConfig {
  apiKey: string;
  host?: string;
  port?: string;
}

interface RequestOptions {
  body?: string | Record<string, unknown>;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean | undefined | null>;
}

interface PatchOptions {
  operation: string;
  targetType: string;
  target: string;
  content: string;
  createIfMissing?: boolean;
}

type ApiResponse =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string };
```

**Done when:** `pnpm build` compiles `src/api-client.ts` and `src/index.ts` without errors. No `.js` files remain at root or in `src/` (except tool files).

**Commit:** `"Convert api-client and index to TypeScript"`

---

### Task 3: Convert all tool files to TypeScript

**Description:** Rename all 7 tool files from `.js` → `.ts` in-place. Add typed function signatures (`server: McpServer, client: ObsidianClient`) to each `register*Tools` function. SDK generics handle handler parameter inference from Zod schemas — no manual handler typing needed.

**Files:**

- `src/tools/vault.js` → `src/tools/vault.ts`
- `src/tools/search.js` → `src/tools/search.ts`
- `src/tools/metadata.js` → `src/tools/metadata.ts`
- `src/tools/commands.js` → `src/tools/commands.ts`
- `src/tools/active-file.js` → `src/tools/active-file.ts`
- `src/tools/navigation.js` → `src/tools/navigation.ts`
- `src/tools/periodic.js` → `src/tools/periodic.ts`

**Done when:** `pnpm build` compiles all files with zero errors under `strict: true`. `pnpm start` launches the MCP server successfully. No `.js` source files remain in `src/`.

**Commit:** `"Convert tool files to TypeScript"`

---

### Task 4: Add ESLint and Prettier

**Description:** Install ESLint and Prettier via CLI, create config files with project conventions.

**Files:**

- `eslint.config.js` — create
- `.prettierrc` — create
- `package.json` — modify (scripts)

**Steps:**

1. `pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier`
2. Create `eslint.config.js` — flat config with `@typescript-eslint/recommended`
3. Create `.prettierrc` — semi, double quotes, trailing commas, 2-space, 80 width
4. Add `lint`, `format` scripts to `package.json`
5. Run `pnpm format` to normalize all files
6. Run `pnpm lint` to verify no errors

**Done when:** `pnpm lint` passes with no errors. `pnpm format` produces no changes. `pnpm typecheck` passes.

**Commit:** `"Add ESLint and Prettier configuration"`

---

### Task 5: Add Lefthook pre-commit hooks

**Description:** Install Lefthook via CLI, create `lefthook.yml` with piped pre-commit hook: prettier → typecheck → lint.

**Files:**

- `lefthook.yml` — create
- `package.json` — modify (devDependency added via CLI)

**Steps:**

1. `pnpm add -D lefthook`
2. Create `lefthook.yml` with piped pre-commit config from design doc
3. Run `lefthook install`

**Done when:** `lefthook install` succeeds. Pre-commit hook runs prettier → typecheck → lint pipeline.

**Commit:** `"Add Lefthook pre-commit hooks"`

---

## Acceptance Criteria

- [ ] All source files are `.ts` in `src/`, no `.js` source files remain
- [ ] `pnpm build` compiles cleanly with zero errors under `strict: true`
- [ ] `pnpm typecheck` passes (`tsc --noEmit`)
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm format` produces no changes (code is already formatted)
- [ ] `lefthook install` succeeds and pre-commit hook runs prettier → typecheck → lint
- [ ] `pnpm start` launches the MCP server and responds to tool calls identically to before
- [ ] No behavioral changes — all 15 tools work exactly as pre-refactor
- [ ] `dist/` is gitignored
- [ ] `server.tool()` → `registerTool()` migration noted as future work (not done)

---

## Notes

- Dependencies are installed via `pnpm add -D` CLI commands, not by editing `package.json` directly
- Task order is strictly linear: 1 → 2 → 3 → 4 → 5
- `.js` files are deleted in-place as `.ts` replacements are created (Tasks 2-3)
- The `"type": "module"` in `package.json` is preserved — `tsconfig.json` uses `"module": "Node16"` which supports ESM
