# Implementation Plan: Traditional Tests

**Created:** 2026-04-04
**Type:** Refactor
**Overview:** A traditional test suite covering the four modules with meaningful testable logic: `update-utils.ts`, `search.ts`, `server.ts`, and `metadata.ts`.
**Design Spec:** `docs/design-specs/2026-04-04-1723-traditional-tests.md`

---

## Summary

Delete all existing tests and the obsidian mock, then rebuild a focused test suite for the four modules with meaningful testable logic. The obsidian mock is rebuilt incrementally — each test task adds only the exports it needs. Integration tests for `server.ts` use a real HTTP server. Documentation is updated to reflect the new strategy.

---

## Codebase Verification

_Confirmed 2026-04-04 — all design spec assumptions match actual codebase._

- [x] 11 existing test files present at expected paths - Verified: yes
- [x] `__mocks__/obsidian.ts` is 333 lines with extensive exports - Verified: yes
- [x] `update-utils.ts` exports `buildPatchInstruction` and `applyUpdate` - Verified: yes
- [x] `search.ts` is 217 lines with `simpleSearch` and `dataviewSearch` - Verified: yes
- [x] `server.ts` is 119 lines with `HttpServer` class - Verified: yes
- [x] `metadata.ts` is 185 lines with `tags_manage` and `frontmatter_manage` - Verified: yes
- [x] Vitest configured, `pnpm test` runs `vitest run` - Verified: yes
- [x] `docs/testing-guidelines.md` exists (205 lines, to be rewritten) - Verified: yes

**Patterns to leverage:**

- Vitest config already has obsidian mock alias set up
- Co-located test file pattern already in use

**Discrepancies found:**

- None

---

## Tasks

### Task 1: Delete existing tests and mock

**Description:** Remove all 11 existing test files and the existing `__mocks__/obsidian.ts`. Clean slate.

**Files:**

- `plugin/src/crypto.test.ts` - delete
- `plugin/src/main.test.ts` - delete
- `plugin/src/server.test.ts` - delete
- `plugin/src/settings.test.ts` - delete
- `plugin/src/tools/active-file.test.ts` - delete
- `plugin/src/tools/commands.test.ts` - delete
- `plugin/src/tools/metadata.test.ts` - delete
- `plugin/src/tools/navigation.test.ts` - delete
- `plugin/src/tools/periodic.test.ts` - delete
- `plugin/src/tools/search.test.ts` - delete
- `plugin/src/tools/vault.test.ts` - delete
- `plugin/src/__mocks__/obsidian.ts` - delete

**Done when:** No `.test.ts` files remain under `plugin/src/`, no `__mocks__` directory exists, `pnpm build` still compiles.

**Commit:** "Remove existing tests and obsidian mock"

---

### Task 2: Create `update-utils.test.ts` (13 test cases)

**Description:** Write tests for `buildPatchInstruction` (10 cases covering frontmatter JSON parse/fallback, `createIfMissing` default/passthrough, heading `::` splitting + edge cases, block passthrough) and `applyUpdate` (3 cases covering success, `PatchFailed`, unknown error). Mock `markdown-patch` inline. Creates `__mocks__/obsidian.ts` with `TFile` (real class) — the first mock export.

**Files:**

- `plugin/src/__mocks__/obsidian.ts` - create (initially just `TFile`)
- `plugin/src/tools/update-utils.test.ts` - create

**Done when:** `pnpm test -- update-utils` passes with all 13 cases.

**Commit:** "Add update-utils tests"

---

### Task 3: Create `search.test.ts` (15 test cases)

**Description:** Write tests for `simpleSearch` (9 cases covering filename match, exact boundary, content match, boundary-spanning skip, all-filtered-out, no match, context clamping, sorting, custom context length) and `dataviewSearch` (6 cases covering plugin missing, query error, non-TABLE, TABLE WITHOUT ID, successful transform, multi-column). Capture handler via mocked `McpServer`. Adds `prepareSimpleSearch` stub to `__mocks__/obsidian.ts`.

**Files:**

- `plugin/src/__mocks__/obsidian.ts` - modify (add `prepareSimpleSearch`)
- `plugin/src/tools/search.test.ts` - create

**Done when:** `pnpm test -- search` passes with all 15 cases.

**Commit:** "Add search tests"

---

### Task 4: Create `server.test.ts` (12 test cases)

**Description:** Integration tests with real HTTP server on random port. Cover auth (3 cases: missing header, wrong token, valid token), routing (5 cases: POST /mcp, GET /mcp, DELETE /mcp, other method, unknown path — with correct response format distinctions), request handling (2 cases: malformed JSON, valid MCP request), lifecycle (2 cases: start/stop, stop with no server). Mock `createMcpServer` factory only. No new mock exports needed.

**Files:**

- `plugin/src/server.test.ts` - create

**Done when:** `pnpm test -- server` passes with all 12 cases.

**Commit:** "Add server integration tests"

---

### Task 5: Create `metadata.test.ts` (17 test cases)

**Description:** Write tests for `tags_manage` (10 cases covering list with/without `#`, empty, non-array, add dedup, add strip `#`, add append, remove, remove missing, missing tags param, file not found) and `frontmatter_manage` (7 cases covering read/strips position/empty, set JSON parse/string fallback/undefined value, missing key, file not found). Use callback mock pattern for `processFrontMatter`. Adds `normalizePath` (real implementation) to `__mocks__/obsidian.ts`.

**Files:**

- `plugin/src/__mocks__/obsidian.ts` - modify (add `normalizePath`)
- `plugin/src/tools/metadata.test.ts` - create

**Done when:** `pnpm test -- metadata` passes with all 17 cases.

**Commit:** "Add metadata tests"

---

### Task 6: Update `docs/testing-guidelines.md`

**Description:** Rewrite to reflect new strategy: testing philosophy, modules under test with rationale, mock strategy (minimal stubs, callback pattern, `TFile` must be real class), mock boundary table, three-layer validation model, integration test pattern for `server.ts`, exclusion rationale.

**Files:**

- `docs/testing-guidelines.md` - modify

**Done when:** Document covers all items from acceptance criteria, no references to old patterns.

**Commit:** "Update testing guidelines for new test strategy"

---

### Task 7: Final validation

**Description:** Run full `pnpm test`, verify all 57 cases pass, optionally capture coverage baseline.

**Files:** None (verification only)

**Done when:** `pnpm test` passes with 0 failures.

**Commit:** (no commit — verification only)

---

## Acceptance Criteria

- [ ] All existing `.test.ts` files are deleted from `plugin/src/`
- [ ] Existing `__mocks__/obsidian.ts` is replaced with a minimal version exporting only `TFile` (real class), `normalizePath` (real implementation), and `prepareSimpleSearch` (stub)
- [ ] `update-utils.test.ts` passes — covers `buildPatchInstruction` (3 target type branches, JSON parse fallback, `::` splitting edge cases, `createIfMissing` default) and `applyUpdate` (success, `PatchFailed`, unknown error)
- [ ] `search.test.ts` passes — covers `simpleSearch` (filename match, exact boundary match, content match, boundary-spanning skip, all-filtered-out, no match, context clamping, sorting, custom context length) and `dataviewSearch` (plugin missing, query error, non-TABLE, TABLE WITHOUT ID, successful transform, multi-column)
- [ ] `server.test.ts` passes as integration tests — covers auth (missing, wrong, valid), routing (POST, GET, DELETE, other method, unknown path with correct response format distinctions), request handling (error, valid), lifecycle (start/stop, null server stop)
- [ ] `metadata.test.ts` passes — covers `tags_manage` (list with/without `#`, empty, non-array, add dedup, add strip `#`, add append, remove, remove missing, missing tags param, file not found) and `frontmatter_manage` (read, read strips position, read empty, set JSON parse, set string fallback, set undefined value, missing key, file not found)
- [ ] `docs/testing-guidelines.md` reflects: testing philosophy, modules under test with rationale, mock strategy (minimal stubs, callback pattern, `TFile` must be real class), mock boundary table, three-layer validation model, integration test pattern for `server.ts`, exclusion rationale
- [ ] All tests run via `pnpm test` with no failures

---

## Build Log

_Filled in during `/build` phase_

| Date | Task | Files | Notes |
| ---- | ---- | ----- | ----- |

---

## Completion

**Completed:** [Date] **Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- The obsidian mock is built incrementally across Tasks 2, 3, and 5. By Task 5's completion, it should contain exactly 3 exports: `TFile`, `prepareSimpleSearch`, `normalizePath`.
- Task 4 (server) needs no mock exports — `server.ts` doesn't import from obsidian.
- The design spec notes lifecycle test count as 3, but "stop destroys active connections" may be difficult to test without exposing the connections Set. The implementation should determine the right approach during build.
