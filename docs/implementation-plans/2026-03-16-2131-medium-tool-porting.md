# Implementation Plan: Medium Tool Porting

**Created:** 2026-03-16
**Type:** Refactor
**Overview:** Port 5 "medium" tools from the legacy HTTP-based MCP server to direct Obsidian API calls inside the plugin: `search` (simple + dataview), `periodic_read`, `tags_manage`, and `frontmatter_manage`.
**Design Spec:** docs/design-specs/2026-03-16-2125-medium-tool-porting.md

---

## Summary

Replace HTTP-based tool implementations that route through the Local REST API plugin with direct Obsidian API calls. This covers search (simple full-text via `prepareSimpleSearch` and Dataview DQL queries), periodic note reading via `obsidian-daily-notes-interface`, tag management and frontmatter management via `processFrontMatter()`. Each tool follows the established `registerXTools(server, app)` pattern with full test coverage.

---

## Codebase Verification

- [x] Registration pattern `registerXTools(server: McpServer, app: App): void` — Verified: used by vault, commands, active-file, navigation
- [x] Test pattern with mock McpServer, `createApp()`, `callTool()` — Verified: consistent across all 4 existing test files
- [x] `createMcpServer()` in `main.ts` wires tool registration — Verified: lines 79-88
- [x] Obsidian mock at `plugin/src/__mocks__/obsidian.ts` — Verified: exists, needs extensions
- [x] No `obsidian-daily-notes-interface` dependency yet — Verified: not in package.json

**Patterns to leverage:**

- `createTFile()` / `createTFolder()` / `createApp()` test helpers from `vault.test.ts`
- `normalizePath()` already in obsidian mock
- Error response format: `{ content: [{ type: "text", text }], isError: true }`

**Discrepancies found:**

- None. Design spec matches current codebase state.

---

## Tasks

### Task 1: Extend obsidian mock + add periodic notes dependency

**Description:** Add missing mock methods/interfaces needed by all medium tools, and install the periodic notes dependency.

**Files:**

- `plugin/src/__mocks__/obsidian.ts` — modify: add `getMarkdownFiles()`, `cachedRead()` to `Vault`; `processFrontMatter()` to `FileManager`; `prepareSimpleSearch` export; `plugins` property to `App` interface
- `plugin/package.json` — modify: add `obsidian-daily-notes-interface` dependency

**Done when:** `pnpm test` passes with all existing tests green; new mock methods available for import.

**Commit:** `feat: Extend obsidian mock and add periodic notes dependency`

---

### Task 2: Implement `search` tool (simple + dataview)

**Description:** Create `search.ts` with both `type: "simple"` (using `prepareSimpleSearch` + `getMarkdownFiles` + `cachedRead`) and `type: "dataview"` (using `app.plugins.getPlugin("dataview")`). Include Dataview interface types, TABLE validation, filename matching for simple search, and legacy-compatible response formats.

**Files:**

- `plugin/src/tools/search.ts` — create

**Done when:** Tool compiles, follows registration pattern, handles both search types with proper error cases.

**Commit:** `feat: Add search tool with simple and dataview modes`

---

### Task 3: Implement `search` tests

**Description:** Write tests for both simple and dataview search covering happy paths and error cases (no matches, dataview missing, non-TABLE query, TABLE WITHOUT ID).

**Files:**

- `plugin/src/tools/search.test.ts` — create

**Done when:** All tests pass via `pnpm test`.

**Commit:** `test: Add search tool tests`

---

### Task 4: Implement `periodic_read` tool

**Description:** Create `periodic.ts` using `obsidian-daily-notes-interface` with accessor map for daily/weekly/monthly/quarterly/yearly. Support markdown and json formats. Handle missing plugin and missing note errors.

**Files:**

- `plugin/src/tools/periodic.ts` — create

**Done when:** Tool compiles, follows registration pattern, handles all period types and error cases.

**Commit:** `feat: Add periodic_read tool`

---

### Task 5: Implement `periodic_read` tests

**Description:** Write tests covering happy paths (markdown/json format, different periods) and error cases (plugin not enabled, note doesn't exist).

**Files:**

- `plugin/src/tools/periodic.test.ts` — create

**Done when:** All tests pass via `pnpm test`.

**Commit:** `test: Add periodic_read tool tests`

---

### Task 6: Implement `tags_manage` and `frontmatter_manage` tools

**Description:** Create `metadata.ts` with both tools. `tags_manage` uses `processFrontMatter()` for list/add/remove with `#`-prefix stripping. `frontmatter_manage` uses `getFileCache()` for read (excluding `position` key) and `processFrontMatter()` for set (with `JSON.parse` fallback).

**Files:**

- `plugin/src/tools/metadata.ts` — create

**Done when:** Both tools compile, follow registration pattern, handle all actions and edge cases.

**Commit:** `feat: Add tags_manage and frontmatter_manage tools`

---

### Task 7: Implement metadata tool tests

**Description:** Write tests for `tags_manage` (list/add/remove, `#` stripping) and `frontmatter_manage` (read without position, set with JSON parse, set with raw string).

**Files:**

- `plugin/src/tools/metadata.test.ts` — create

**Done when:** All tests pass via `pnpm test`.

**Commit:** `test: Add metadata tool tests`

---

### Task 8: Wire tools into `main.ts` and verify

**Description:** Import and call `registerSearchTools`, `registerPeriodicTools`, `registerMetadataTools` in `createMcpServer()`. Run full test suite and build.

**Files:**

- `plugin/src/main.ts` — modify: add imports and registration calls

**Done when:** `pnpm test` passes, `pnpm build` succeeds, all 5 new tools register.

**Commit:** `feat: Wire medium tools into MCP server`

---

## Acceptance Criteria

- [ ] `search` with `type: "simple"` returns matches across vault markdown files with context snippets
- [ ] `search` with `type: "simple"` matches against both filename and content
- [ ] `search` with `type: "dataview"` executes TABLE DQL queries and returns `[{ filename, result }]`
- [ ] `search` with `type: "dataview"` returns clear error when Dataview plugin is not installed
- [ ] `search` with `type: "dataview"` rejects non-TABLE queries and TABLE WITHOUT ID queries
- [ ] `periodic_read` returns current period note content in markdown or json format
- [ ] `periodic_read` returns clear error when Periodic Notes plugin is not enabled for the requested period
- [ ] `periodic_read` returns clear error when the current period's note doesn't exist
- [ ] `tags_manage` with `action: "list"` returns tags array without `#` prefix
- [ ] `tags_manage` with `action: "add"` adds tags to frontmatter without `#` prefix
- [ ] `tags_manage` with `action: "remove"` removes tags from frontmatter
- [ ] `tags_manage` defensively strips `#` from input tags
- [ ] `frontmatter_manage` with `action: "read"` returns frontmatter object without internal `position` key
- [ ] `frontmatter_manage` with `action: "set"` sets a field using `processFrontMatter()`
- [ ] `frontmatter_manage` with `action: "set"` parses JSON string values into native types
- [ ] All 5 tools register correctly and appear in MCP tool list
- [ ] All paths normalized via `normalizePath()` before vault API calls
- [ ] Unit tests cover happy paths and error cases for all tools

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                                                     | Notes                                                                                                                                          |
| ---------- | ------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-16 | Task 1 | `plugin/src/__mocks__/obsidian.ts`, `plugin/package.json` | Added `cachedRead`, `getMarkdownFiles`, `processFrontMatter`, `prepareSimpleSearch`, `Plugins` interface, `obsidian-daily-notes-interface` dep |
| 2026-03-16 | Task 2 | `plugin/src/tools/search.ts`                              | Both simple and dataview search modes implemented; simple search uses cachedRead (async)                                                       |
| 2026-03-16 | Task 3 | `plugin/src/tools/search.test.ts`                         | 10 tests: content matches, filename matches, boundary skipping, no matches, sort, dataview happy/error/non-TABLE/WITHOUT ID/query failure      |
| 2026-03-16 | Task 4 | `plugin/src/tools/periodic.ts`                            | Used `ReturnType<typeof window.moment>` for Moment type to avoid direct moment dependency                                                      |
| 2026-03-16 | Task 5 | `plugin/src/tools/periodic.test.ts`                       | 5 tests: markdown/json format, plugin not enabled, note missing, weekly period                                                                 |
| 2026-03-16 | Task 6 | `plugin/src/tools/metadata.ts`                            | Needed explicit `Record<string, unknown>` annotation on processFrontMatter callbacks due to obsidian types                                     |
| 2026-03-16 | Task 7 | `plugin/src/tools/metadata.test.ts`                       | 14 tests: tags list/#-strip/empty/add/dedup/remove/missing-file, frontmatter read/set-string/set-JSON/raw-fallback/missing-file/missing-key    |

---

## Completion

**Completed:** [Date]
**Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- `obsidian-daily-notes-interface` package provides helpers for all period types (daily, weekly, monthly, quarterly, yearly)
- Dataview accessed via `app.plugins.getPlugin("dataview")` to avoid hard dependency on community plugin
- Simple search mirrors Local REST API behavior: prepends basename to content before searching to enable filename matching
