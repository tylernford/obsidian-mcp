# Implementation Plan: Trivial Tool Porting

**Created:** 2026-03-15
**Type:** Refactor
**Overview:** Port the 8 MCP tools that have direct Obsidian API equivalents into the plugin, replacing HTTP-to-REST-API calls with direct `app` API access.
**Design Spec:** docs/design-specs/2026-03-15-2250-trivial-tool-porting.md

---

## Summary

Port 8 MCP tools across 4 modules (vault, commands, active-file, navigation) from the legacy HTTP-based implementation to direct Obsidian `app` API calls. Each tool retains its existing name, description, Zod parameter schema, and response format. The obsidian mock is expanded to support tool-level unit testing.

---

## Codebase Verification

- [x] `createMcpServer()` exists in `main.ts` and is minimal (just instantiates McpServer) — Verified: yes
- [x] Legacy tools use `(server, client: ObsidianClient)` signature — Verified: yes, plugin will use `(server, app: App)` per design decision #1
- [x] `plugin/src/tools/` directory does not exist yet — Verified: yes, will be created
- [x] Mock needs expansion (only has `getAbstractFileByPath` on Vault) — Verified: yes
- [x] MCP SDK already installed — Verified: yes (`@modelcontextprotocol/sdk@^1.27.1`)
- [x] Test infrastructure ready (vitest + jsdom) — Verified: yes
- [x] `vault_update` and `active_file_update` are out of scope — Verified: yes

**Patterns to leverage:**

- Existing `register*Tools(server, client)` pattern from legacy — adapt to `(server, app)`
- Existing test patterns in `main.test.ts`, `server.test.ts` (vitest + mocked obsidian)
- `createObsidianEl()` helper in mock for DOM element creation

**Discrepancies found:**

- None

---

## Tasks

### Task 1: Expand Obsidian mock for tool testing

**Description:** Add mock types and methods that tool modules need: `TFile`, `TFolder`, `normalizePath()`, expanded `Vault` interface (`read`, `create`, `trash`, `getRoot`), `Workspace` (`getActiveFile`, `openLinkText`), `MetadataCache` (`getFileCache`), and update the `App` interface to include `workspace`, `metadataCache`, and `commands`.

**Files:**

- `plugin/src/__mocks__/obsidian.ts` — modify

**Done when:** Mock exports all types/methods that tool modules will import from `"obsidian"`. Existing tests still pass (`pnpm test`).

**Commit:** `feat: expand obsidian mock for tool testing`

---

### Task 2: Implement vault tools

**Description:** Create `vault.ts` with `registerVaultTools(server, app)` containing `vault_list`, `vault_read`, `vault_create`, `vault_delete`. Same tool names, descriptions, and Zod schemas as legacy. Replace HTTP calls with direct `app.vault.*` and `app.metadataCache.*` calls. Normalize paths with `normalizePath()`.

Key implementation details:

- `vault_list`: `app.vault.getAbstractFileByPath()` + `.children`, empty/omitted path uses `app.vault.getRoot()`, trailing `/` for directories, sorted
- `vault_read`: `app.vault.read(file)` for content, `app.metadataCache.getFileCache(file)` for frontmatter/tags, `file.stat` for stats
- `vault_create`: `app.vault.create(path, content)`, catch if file exists
- `vault_delete`: `app.vault.trash(file, true)` (safe delete), error if non-existent

**Files:**

- `plugin/src/tools/vault.ts` — create

**Done when:** Module exports `registerVaultTools`. All 4 tools registered with correct schemas. TypeScript compiles (`pnpm build`).

**Commit:** `feat: add vault tools (list, read, create, delete)`

---

### Task 3: Implement commands, active-file, and navigation tools

**Description:** Create the 3 remaining tool modules:

- `commands.ts` — `commands_list` via `(app as any).commands.commands`, `commands_execute` via `(app as any).commands.executeCommandById(id)` (returns boolean, false = not found)
- `active-file.ts` — `active_file_read` via `app.workspace.getActiveFile()` + same format logic as `vault_read` (null = no active file → error)
- `navigation.ts` — `file_open` via `app.workspace.openLinkText(path, "", newLeaf)`

**Files:**

- `plugin/src/tools/commands.ts` — create
- `plugin/src/tools/active-file.ts` — create
- `plugin/src/tools/navigation.ts` — create

**Done when:** All 3 modules export their register functions. 4 tools total registered with correct schemas. TypeScript compiles (`pnpm build`).

**Commit:** `feat: add commands, active-file, and navigation tools`

---

### Task 4: Wire tools into main.ts

**Description:** Update `createMcpServer()` in `main.ts` to import and call all 4 `register*Tools()` functions, passing `this.app`.

**Files:**

- `plugin/src/main.ts` — modify

**Code example:**

```typescript
private createMcpServer(): McpServer {
  const server = new McpServer({
    name: this.manifest.name,
    version: this.manifest.version,
  });
  registerVaultTools(server, this.app);
  registerCommandTools(server, this.app);
  registerActiveFileTools(server, this.app);
  registerNavigationTools(server, this.app);
  return server;
}
```

**Done when:** `createMcpServer()` returns a server with all 8 tools registered. TypeScript compiles (`pnpm build`). Existing tests still pass (`pnpm test`).

**Commit:** `feat: wire tool registration into createMcpServer()`

---

### Task 5: Unit tests for vault tools

**Description:** Test all 4 vault tools: `vault_list` (root listing, subfolder, non-existent path, trailing `/` for dirs), `vault_read` (markdown format, json format, non-existent file), `vault_create` (success, file exists error), `vault_delete` (success via trash, non-existent file error). Verify path normalization.

**Files:**

- `plugin/src/tools/vault.test.ts` — create

**Done when:** All tests pass (`pnpm test`). Covers happy path and error cases for each vault tool.

**Commit:** `test: add vault tool unit tests`

---

### Task 6: Unit tests for commands, active-file, and navigation tools

**Description:** Test remaining 4 tools: `commands_list` (returns `{ id, name }` array), `commands_execute` (success, unknown command error), `active_file_read` (both formats, no active file error), `file_open` (success, newLeaf option).

**Files:**

- `plugin/src/tools/commands.test.ts` — create
- `plugin/src/tools/active-file.test.ts` — create
- `plugin/src/tools/navigation.test.ts` — create

**Done when:** All tests pass (`pnpm test`). Covers happy path and error cases for each tool.

**Commit:** `test: add commands, active-file, and navigation tool tests`

---

## Acceptance Criteria

- [ ] `vault_list` returns files and folders at a given path, matching REST API shape
- [ ] `vault_list` with no path returns vault root contents
- [ ] `vault_list` with non-existent path returns error
- [ ] `vault_read` with `format: "markdown"` returns raw file content
- [ ] `vault_read` with `format: "json"` returns content, frontmatter, tags, and stat
- [ ] `vault_read` with non-existent file returns error
- [ ] `vault_create` creates a new file with given content
- [ ] `vault_create` with existing filename returns error
- [ ] `vault_delete` moves file to trash via `vault.trash()`
- [ ] `vault_delete` with non-existent file returns error
- [ ] `commands_list` returns all registered commands as `{ id, name }` array
- [ ] `commands_execute` executes a valid command and returns success
- [ ] `commands_execute` with unknown command returns error
- [ ] `active_file_read` returns active file content (both formats)
- [ ] `active_file_read` with no active file returns error
- [ ] `file_open` opens a file in Obsidian
- [ ] `file_open` with `newLeaf: true` opens in a new tab
- [ ] All paths normalized via `normalizePath()` before API calls
- [ ] All tools registered on `McpServer` via `createMcpServer()` in `main.ts`
- [ ] Unit tests pass for all 4 tool modules

---

## Build Log

_Filled in during `/build` phase_

| Date | Task | Files | Notes |
| ---- | ---- | ----- | ----- |

---

## Completion

**Completed:** [Date]
**Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- `vault_update` and `active_file_update` are explicitly out of scope (session 5)
- `vault_delete` intentionally uses safe delete (`vault.trash(file, true)`) — deliberate improvement over legacy hard delete
- `app.commands` is undocumented Obsidian API — accessed via `(app as any).commands`
