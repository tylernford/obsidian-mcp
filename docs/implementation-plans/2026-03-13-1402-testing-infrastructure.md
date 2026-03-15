# Implementation Plan: Testing Infrastructure

**Created:** 2026-03-13 **Type:** Process **Overview:** Add vitest-based testing infrastructure to the plugin workspace with manual Obsidian API mocks, coverage reporting, and lefthook integration. **Design Spec:** docs/design-specs/2026-03-13-1354-testing-infrastructure.md

---

## Summary

Set up vitest as the test runner in the `plugin/` workspace with a manual mock for the `obsidian` module, v8 coverage reporting, lefthook pre-commit integration, and a smoke test to verify the full pipeline.

---

## Codebase Verification

- [x] `plugin/package.json` exists with scripts section — Verified: yes, no test scripts yet
- [x] `plugin/vitest.config.ts` does not exist — Verified: yes, needs creation
- [x] `lefthook.yml` exists with pre-commit hooks — Verified: yes, has prettier/typecheck/lint jobs
- [x] esbuild bundles from entry point only — Verified: yes, `*.test.ts` files naturally excluded
- [x] `plugin/tsconfig.json` includes `src/**/*.ts` — Verified: yes, test files will be typechecked
- [x] Only one source file exists (`plugin/src/main.ts`) — Verified: yes, early stage

**Patterns to leverage:**

- Existing lefthook piped pre-commit pattern with `root` and `glob` fields
- esbuild entry-point bundling naturally excludes test files

**Discrepancies found:**

- None

---

## Tasks

### Task 1: Install test dependencies and add scripts

**Description:** Install vitest and @vitest/coverage-v8 as devDependencies. Add `test`, `test:watch`, and `test:coverage` scripts to `plugin/package.json`.

**Files:**

- `plugin/package.json` - modify

**Code example:**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

**Done when:** `pnpm test`, `pnpm test:watch`, and `pnpm test:coverage` are defined in scripts. Dependencies installed and lockfile updated.

**Commit:** "feat: Add vitest dependencies and test scripts"

---

### Task 2: Add vitest config and obsidian mock

**Description:** Create `plugin/vitest.config.ts` with the obsidian module alias pointing to the manual mock. Create `plugin/src/__mocks__/obsidian.ts` with starter stubs (e.g., `Plugin`, `Notice`, `App`, `Vault` classes). Configure coverage with v8 provider.

**Files:**

- `plugin/vitest.config.ts` - create
- `plugin/src/__mocks__/obsidian.ts` - create

**Code example:**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    alias: {
      obsidian: path.resolve(__dirname, "src/__mocks__/obsidian.ts"),
    },
    coverage: {
      provider: "v8",
    },
  },
});
```

**Done when:** `pnpm test` runs and exits cleanly (zero tests, no errors). Importing `obsidian` in a test would resolve to the mock.

**Commit:** "feat: Add vitest config and manual obsidian mock"

---

### Task 3: Add lefthook test hook

**Description:** Add a test job to the pre-commit pipeline in `lefthook.yml` that runs `pnpm test` when plugin source files change.

**Files:**

- `lefthook.yml` - modify

**Code example:**

```yaml
- name: test
  root: "plugin/"
  glob: "plugin/src/**/*.ts"
  run: pnpm test
```

**Done when:** Committing a change to `plugin/src/**/*.ts` triggers `pnpm test` in the pre-commit pipeline.

**Commit:** "feat: Add pre-commit test hook via lefthook"

---

### Task 4: Add smoke test to verify infrastructure

**Description:** Add a minimal `plugin/src/main.test.ts` that imports from `obsidian` and asserts the mock resolves correctly. This validates the full pipeline (vitest + alias + mock + coverage).

**Files:**

- `plugin/src/main.test.ts` - create

**Done when:** `pnpm test` runs the smoke test and passes. `pnpm test:coverage` generates a report.

**Commit:** "test: Add smoke test to verify testing infrastructure"

---

## Acceptance Criteria

- [x] `pnpm test` runs vitest and exits cleanly (even with zero test files)
- [x] `pnpm test:watch` starts vitest in watch mode
- [x] `pnpm test:coverage` generates a v8 coverage report
- [x] Importing from `obsidian` in test files resolves to the manual mock
- [x] Lefthook pre-commit runs tests when plugin source files change
- [x] Test files (`*.test.ts`) are excluded from the production esbuild bundle
- [x] No new runtime dependencies — all test deps are devDependencies

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                                                                               | Notes                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-13 | Task 1 | plugin/package.json, pnpm-lock.yaml                                                 | Scripts and deps added as planned. Pre-existing peer warnings unrelated to our changes.                                                                                                                                                                                                                                                                                    |
| 2026-03-13 | Task 2 | plugin/vitest.config.ts, plugin/src/**mocks**/obsidian.ts, plugin/eslint.config.mts | Added vitest.config.ts to eslint globalIgnores (same pattern as esbuild.config.mjs).                                                                                                                                                                                                                                                                                       |
| 2026-03-13 | Task 3 | lefthook.yml                                                                        | Added test job to pre-commit pipeline as planned.                                                                                                                                                                                                                                                                                                                          |
| 2026-03-15 | Task 4 | plugin/src/main.test.ts, .gitignore, plugin/tsconfig.json                           | Smoke test added. Gitignored plugin/coverage/. Deviated: vitest .d.ts files incompatible with tsconfig — switched moduleResolution to "bundler" (esbuild handles resolution anyway) and added skipLibCheck:true (vitest uses Disposable/ES2024 types not in our lib). Fixed obsidianmd/ui/sentence-case lint error on Notice constructor string ("test" → "Test message"). |

---

## Completion

**Completed:** 2026-03-15 **Final Status:** Complete

**Summary:** Vitest testing infrastructure is fully operational with manual Obsidian API mocks, v8 coverage reporting, lefthook pre-commit integration, and a passing smoke test.

**Deviations from Plan:** Changed `moduleResolution` from `"node"` to `"bundler"` and added `skipLibCheck: true` in `plugin/tsconfig.json` to resolve vitest `.d.ts` type incompatibilities. Both changes are net positives — `"bundler"` more accurately reflects how esbuild resolves modules, and `skipLibCheck` only skips typechecking third-party declaration files.

---

## Notes

- The obsidian mock starts flat (`__mocks__/obsidian.ts`). Per design spec, refactor to modular structure if/when the file exceeds ~150 lines during phases 2–5.
- Mocked Obsidian API tests verify our assumptions about the API, not real behavior. Keep Obsidian API interactions in thin wrappers for testability.
