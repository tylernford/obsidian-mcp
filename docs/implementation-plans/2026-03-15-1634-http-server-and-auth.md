# Implementation Plan: HTTP Server & Auth

**Created:** 2026-03-15
**Type:** Refactor
**Overview:** Add an HTTP server with Streamable HTTP transport and API key authentication to the Obsidian plugin, plus a settings tab for configuration. This is the infrastructure layer that all MCP tool requests will flow through.
**Design Spec:** docs/design-specs/2026-03-15-1453-http-server-and-auth.md

---

## Summary

Add the MCP SDK dependency, implement an HTTP server with Bearer token auth and stateful session management, a settings tab for connection info and configuration, and wire everything into the plugin lifecycle. Six tasks, executed sequentially.

---

## Codebase Verification

_Confirmed 2026-03-15_

- [x] `main.ts` is a minimal scaffold (onload/onunload with console.debug) — ready to extend
- [x] No `server.ts`, `settings.ts`, or `crypto.ts` exist — all need creating
- [x] `esbuild.config.mjs` already externalizes `builtinModules` — no changes needed for `http`/`crypto`
- [x] No MCP SDK dependency in `package.json` — needs adding
- [x] Obsidian mock is minimal — needs `Setting`, `PluginSettingTab`, `Modal`, `SecretStorage` stubs

**Patterns to leverage:**

- Existing Obsidian mock pattern in `plugin/src/__mocks__/obsidian.ts`
- esbuild config already handles Node built-in externalization

**Discrepancies found:**

- None. Design spec already incorporated all validation findings.

---

## Tasks

### Task 1: Add MCP SDK dependency

**Description:** Install the MCP SDK package and verify correct import paths for `McpServer` and `NodeStreamableHTTPServerTransport`. The design spec flags that the package name needs confirmation (`@modelcontextprotocol/sdk` vs split packages).

**Files:**

- `plugin/package.json` - modify

**Done when:** `pnpm install` succeeds, `McpServer` and `NodeStreamableHTTPServerTransport` are importable with correct paths confirmed.

**Commit:** `feat: Add MCP SDK dependency`

---

### Task 2: Create API key generation utility

**Description:** Implement `generateApiKey()` using `crypto.randomBytes(32).toString('hex')`. Add tests for format (64-character hex string) and uniqueness (two calls produce different values).

**Files:**

- `plugin/src/crypto.ts` - create
- `plugin/src/crypto.test.ts` - create

**Done when:** `pnpm test` passes with crypto tests.

**Commit:** `feat: Add API key generation utility`

---

### Task 3: Extend Obsidian mock

**Description:** Add stubs for `Setting` (with fluent API: `setName`, `setDesc`, `addText`, `addButton`), `PluginSettingTab`, `Modal`, and `SecretStorage`. Update `App` interface to include `secretStorage`. Needed by settings and main tests.

**Files:**

- `plugin/src/__mocks__/obsidian.ts` - modify

**Done when:** Existing tests still pass, new mocked classes are importable.

**Commit:** `test: Extend Obsidian mock with Setting, PluginSettingTab, Modal, SecretStorage`

---

### Task 4: Create HTTP server with auth and session management

**Description:** Implement `HttpServer` class with:

- `constructor(config: { port: number; host: string; apiKey: string; mcpServer: McpServer })`
- Auth middleware: validates `Authorization: Bearer <key>`, rejects with `401 {"error": "Unauthorized"}`
- Route handling: POST/GET/DELETE `/mcp` → transport, everything else → 404
- Stateful session management: transport map keyed by `mcp-session-id`, new transport only for initialize requests, `mcpServer.connect(transport)` per session
- Clean shutdown: `stop()` closes all transports, clears map, `server.close()`

Tests cover: auth (missing/wrong token → 401), routing (POST/GET/DELETE /mcp, unknown route → 404), session management (create, reuse, unknown ID → 400, non-initialize without session → 400), lifecycle (start, stop, cleanup).

**Files:**

- `plugin/src/server.ts` - create
- `plugin/src/server.test.ts` - create

**Done when:** All server tests pass.

**Commit:** `feat: Add HTTP server with auth and session management`

---

### Task 5: Create settings tab

**Description:** Implement `MCPToolsSettingTab` extending `PluginSettingTab` with:

- "How to Connect" section: `mcp.json` snippet and `claude mcp add` command, both populated with actual port/key, both copyable via `navigator.clipboard.writeText()`
- API key display (read-only) + copy button + regenerate button (confirmation `Modal`, new key saved to `SecretStorage`, UI refreshed)
- Port input with description + confirmation dialog + server restart on change

Tests cover: renders without errors, displays current values, "How to Connect" blocks contain correct URL and key.

**Files:**

- `plugin/src/settings.ts` - create
- `plugin/src/settings.test.ts` - create

**Done when:** Settings tests pass.

**Commit:** `feat: Add settings tab with connection info and configuration`

---

### Task 6: Wire HTTP server and auth into plugin lifecycle

**Description:** Update `main.ts` onload flow:

1. `saved = await this.loadData()` (null on first load)
2. `this.settings = merge(DEFAULT_SETTINGS, saved)` (apply defaults)
3. Get API key from `SecretStorage`; if null, generate via `generateApiKey()` and save
4. Create `McpServer` (plugin name + version, zero tools)
5. Create `HttpServer({ port, host, apiKey, mcpServer })`
6. `await httpServer.start()`
7. `this.addSettingTab(new MCPToolsSettingTab(this.app, this))`

Update `onunload()` to call `await httpServer.stop()`.

Add `MCPToolsSettings` interface (`{ port: number }`), `DEFAULT_SETTINGS`, and a `restartServer()` method for settings tab to call on port change.

Expand `main.test.ts`: first load generates key, subsequent load preserves key, default settings applied correctly.

**Files:**

- `plugin/src/main.ts` - modify
- `plugin/src/main.test.ts` - modify

**Done when:** All tests pass, `pnpm build` succeeds.

**Commit:** `feat: Wire HTTP server and auth into plugin lifecycle`

---

## Acceptance Criteria

- [ ] Plugin loads in Obsidian — HTTP server starts without errors on configured port
- [ ] Plugin unloads cleanly — HTTP server stops, all sessions closed, port released, no orphaned listeners
- [ ] API key auto-generated on first load, persisted in `SecretStorage`
- [ ] API key visible in settings tab, copyable
- [ ] API key regeneration works (confirmation dialog, new key saved, "How to Connect" updated)
- [ ] Port configurable in settings (confirmation dialog, server restarts, "How to Connect" updated)
- [ ] "How to Connect" section shows correct `mcp.json` snippet and `claude mcp add` command
- [ ] Requests without valid Bearer token rejected with 401
- [ ] POST /mcp with initialize request creates new session and connects transport to McpServer
- [ ] POST/GET/DELETE on `/mcp` with valid session ID routed to existing transport
- [ ] Requests with invalid or missing session ID (non-initialize) return 400
- [ ] Unknown routes return 404
- [ ] McpServer created with zero tools — MCP initialization handshake succeeds
- [ ] All tests pass

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

- The MCP SDK package name needs verification during Task 1 — the design spec flags `@modelcontextprotocol/sdk` vs potentially split packages.
- Confirmation dialogs (Task 5) require a custom `Modal` subclass since Obsidian has no built-in confirmation dialog.
- Clipboard copy uses `navigator.clipboard.writeText()` (standard browser API, works in Electron).
