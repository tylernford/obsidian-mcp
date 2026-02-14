# TypeScript Refactor

**Created:** 2026-02-14
**Status:** Design
**Implementation Plan Doc:** docs/implementation-plans/2026-02-14-1353-typescript-refactor.md

---

## Overview

**What:** Convert the entire codebase from JavaScript to TypeScript with strict type checking, and add linting/formatting tooling.

**Why:** Add compile-time type safety to catch errors early, improve developer experience with IDE autocompletion and inline documentation, and establish code quality tooling (ESLint, Prettier, Lefthook) for ongoing development.

**Type:** Refactor

---

## Requirements

### Must Have
- [ ] All source files converted from `.js` to `.ts` in `src/`
- [ ] `tsconfig.json` with `strict: true`
- [ ] Typed `ObsidianClient` class (constructor config, request/response types, patch options)
- [ ] Typed tool registration functions (`McpServer` and `ObsidianClient` parameter types)
- [ ] `tsc` build step compiling `src/` to `dist/`
- [ ] ESLint with `@typescript-eslint/recommended` defaults (flat config)
- [ ] Prettier with project conventions (semi, double quotes, trailing commas, 2-space, 80 width)
- [ ] Lefthook pre-commit hook: prettier → typecheck → lint (piped)
- [ ] `dist/` added to `.gitignore`
- [ ] Zero behavioral changes — all 15 tools work identically

### Nice to Have
- [ ] Migrate from deprecated `server.tool()` to `registerTool()` API (see Future Work)

### Out of Scope
- Structural refactoring (folder reorganization, module splitting)
- New features or tool changes
- Test infrastructure (no tests exist today; adding them is a separate effort)

---

## Design Decisions

### Build Tooling: `tsc` vs `tsup`

**Options considered:**
1. `tsc` — Standard TypeScript compiler, mirrors source structure in `dist/`, no extra dependencies beyond `typescript`
2. `tsup` — esbuild-based bundler, faster builds, but adds config complexity and extra dependency

**Decision:** `tsc`. The codebase is ~650 lines across 8 files. Build speed is a non-issue at this scale, and `tsc` keeps the output structure 1:1 with source for easy debugging. Minimal dependency footprint.

### Type Strategy for Tool Handlers

**Options considered:**
1. Hand-write types for every tool handler's parameters
2. Use `z.infer<>` to derive types from existing Zod schemas
3. Rely on MCP SDK's built-in generic inference from Zod schemas

**Decision:** Option 3. The SDK's `server.tool<Args extends ZodRawShapeCompat>()` method is generic — it infers handler parameter types from the Zod schema automatically. No `z.infer` or hand-written input types needed for tool handlers. We only need to type the function signatures (`server: McpServer, client: ObsidianClient`).

### `server.tool()` vs `registerTool()`

**Options considered:**
1. Stay on `server.tool()` (deprecated but functional)
2. Migrate to `registerTool()` during this refactor

**Decision:** Stay on `server.tool()`. Migrating to `registerTool()` changes the API surface and call signatures, which goes beyond "type safety only." Noted as future work.

### ESLint Configuration

**Decision:** Flat config (`eslint.config.js`) with `@typescript-eslint/recommended` defaults. No custom rules beyond the recommended set.

---

## Types to Define

### `src/api-client.ts`

```ts
interface ObsidianClientConfig {
  apiKey?: string;
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

### Tool files

Minimal typing needed — function signatures get `McpServer` and `ObsidianClient` types from imports. Handler parameters are inferred by the SDK generics.

---

## Configuration

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

### `package.json` updates

```json
{
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "lefthook": "^1.11.0"
  }
}
```

### `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 80
}
```

### `lefthook.yml`

```yaml
pre-commit:
  piped: true
  jobs:
    - name: prettier
      glob: "*.{ts,tsx,mts,js,jsx,mjs,json,css,md,yml,yaml}"
      run: pnpm prettier --write {staged_files} && git add {staged_files}

    - name: typecheck
      run: pnpm tsc --noEmit

    - name: lint
      glob: "*.{ts,tsx,mts,js,jsx,mjs}"
      run: pnpm eslint --fix {staged_files} && git add {staged_files}
```

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
- [ ] `server.tool()` → `registerTool()` migration noted as future work

---

## Files to Create/Modify

```
# New files
tsconfig.json                  # TypeScript compiler config
eslint.config.js               # ESLint flat config with @typescript-eslint
.prettierrc                    # Prettier config
lefthook.yml                   # Pre-commit hooks

# Renamed .js → .ts (with type annotations added)
src/index.ts                   # Entry point (moved from root index.js)
src/api-client.ts              # HTTP client with typed interfaces
src/tools/vault.ts             # 5 vault tools
src/tools/search.ts            # 1 search tool
src/tools/metadata.ts          # 2 metadata tools
src/tools/commands.ts          # 2 command tools
src/tools/active-file.ts       # 2 active file tools
src/tools/navigation.ts        # 1 navigation tool
src/tools/periodic.ts          # 2 periodic note tools

# Modified
package.json                   # Updated main, scripts, devDependencies
.gitignore                     # Add dist/

# Deleted
index.js                       # Replaced by src/index.ts → dist/index.js
src/api-client.js              # Replaced by .ts
src/tools/*.js                 # Replaced by .ts
```

---

## Future Work

- **Migrate `server.tool()` → `registerTool()`:** The MCP SDK has deprecated `server.tool()` in favor of `registerTool()` with a config object pattern. This changes call signatures and should be a separate task.

---

## Build Log

*Filled in during `/build` phase*

| Date | Task | Files | Notes |
|------|------|-------|-------|
| 2026-02-14 | Task 1 | tsconfig.json, package.json, .gitignore | Used `tsc --init` then edited to match design doc config |

---

## Completion

**Completed:** TBD
**Final Status:** TBD

**Summary:** TBD

**Deviations from Plan:** TBD
