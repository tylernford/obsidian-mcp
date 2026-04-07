# Convert to Obsidian Plugin

**Created:** 2026-03-12
**Implementation Plan:** Decomposed into 9 downstream plans (see Suggested Decomposition below)

---

## Overview

**What:** Convert the standalone Node.js MCP server into a native Obsidian plugin that serves MCP over HTTP, eliminating the Local REST API plugin dependency.

**Why:** The current architecture requires two plugins (our MCP server + Local REST API) and routes all Obsidian API calls through an HTTP middleman. Converting to a plugin gives us direct `app` API access, removes the third-party dependency, and simplifies the stack for end users (one plugin instead of two).

**Type:** Refactor

---

## Architecture

### Current

```
Claude Code <--stdio--> MCP Server (Node.js) <--HTTP--> Local REST API plugin <--> Obsidian
```

### Proposed

```
Claude Code <--HTTP--> Obsidian Plugin (HTTP server + MCP) <--> Obsidian API
```

The plugin runs an HTTP server inside Obsidian's Electron process, serving MCP via the Streamable HTTP transport. Claude Code connects directly over HTTP — no intermediate processes or plugins.

---

## Requirements

### Must Have

- [x] Obsidian plugin that loads/unloads cleanly
- [x] HTTP server with Streamable HTTP transport serving MCP on a configurable port
- [x] API key authentication — auto-generated on first load, displayed in settings, with copy and regenerate
- [x] All 15 existing MCP tools ported with identical names, parameter schemas, and response formats
- [x] Direct `app` API access replacing all HTTP-to-REST-API calls
- [x] Structured update logic (heading/block/frontmatter targeting) reimplemented locally
- [x] esbuild bundling into single `main.js`
- [x] `manifest.json` with all required fields (`id`, `name`, `version`, `minAppVersion`, `author`, `description`, `isDesktopOnly`) targeting current stable Obsidian
- [x] `isDesktopOnly: true` in manifest (required — plugin uses Node.js `http` module)
- [x] All user-provided vault paths normalized via `normalizePath()` before API calls

### Nice to Have

- [x] Configurable port in plugin settings (with sensible default)

### Out of Scope

- New tools or features (rename, backlinks, link resolution, safe delete, rich metadata)
- HTTPS support
- Community plugin registry publishing
- Tests (none currently exist)
- Stdio or WebSocket transports

---

## Design Decisions

### 1. HTTP server inside the plugin (vs. stdio bridge)

**Options considered:**

1. **HTTP server in plugin** — plugin runs an HTTP server on localhost, Claude Code connects via `--transport http`. Single component, clean architecture, supports multiple clients, easy to debug with curl. Requires auth and port configuration.
2. **Stdio bridge** — plugin runs internal HTTP server, separate Node.js bridge script translates stdio ↔ HTTP. Preserves current `--transport stdio` setup. But introduces two components again (plugin + bridge script), partially defeating the "simpler stack" goal.
3. **WebSocket server** — not viable standalone. MCP SDK has no pure WebSocket transport, and Claude Code doesn't support it directly. Collapses into Option 1 or 2.

**Decision:** HTTP server (Option 1). Architecturally cleaner, single component, future-proof (any MCP client can connect over HTTP). The auth/port config cost is minimal and mirrors a pattern users already understand.

### 2. Streamable HTTP transport (vs. SSE)

**Options considered:**

1. **Streamable HTTP** — newer MCP transport, single `POST /mcp` endpoint, supports optional SSE streaming. Claude Code connects via `--transport http`.
2. **SSE** — older MCP transport, two endpoints (`GET /sse` + `POST /messages`). Being phased out in favor of Streamable HTTP.

**Decision:** Streamable HTTP. It's the current direction of the MCP spec, simpler (one endpoint), and fully supported by Claude Code.

### 3. Auth via auto-generated API key

Since the plugin runs an HTTP server on localhost, any local process could connect. The plugin generates a random API key on first load, persists it in `data.json` (Obsidian's plugin storage), and validates it on every request via `Authorization: Bearer <key>` header. The key is displayed in the settings tab with copy and regenerate options.

This mirrors the Local REST API plugin's auth pattern, so users are already familiar with the flow.

### 4. Same repo, sample plugin scaffold

The conversion happens in this repository on the `refactor/convert-to-plugin` branch. Rather than surgically converting the Node.js server in-place, we start from the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) scaffold (which provides a known-working manifest, esbuild config, and plugin lifecycle) and port our Zod schemas, tool logic, and response formatting onto it. This allows incremental validation — each step produces a loadable plugin.

### 5. Plugin ID must not contain "obsidian"

Per Obsidian's submission requirements, the plugin ID cannot include the string "obsidian". The ID should be something like `mcp-tools` or `vault-mcp`.

---

## Tool Rewrite Map

### Trivial (direct API equivalents)

| Tool               | Current (HTTP)             | New (direct API)                                                                      |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------- |
| `vault_list`       | `GET /vault/{path}/`       | `app.vault.getAbstractFileByPath()` + list children                                   |
| `vault_read`       | `GET /vault/{filename}`    | `app.vault.read(file)` / `cachedRead(file)`                                           |
| `vault_create`     | `PUT /vault/{filename}`    | `app.vault.create(path, content)`                                                     |
| `vault_delete`     | `DELETE /vault/{filename}` | `app.vault.trash(file, true)` (moves to system trash — safer for AI-driven deletions) |
| `commands_list`    | `GET /commands/`           | `(app as any).commands.commands` ⚠️ undocumented internal                             |
| `commands_execute` | `POST /commands/{id}/`     | `(app as any).commands.executeCommandById(id)` ⚠️ undocumented internal               |
| `active_file_read` | `GET /active/`             | `app.workspace.getActiveFile()` + `vault.read()`                                      |
| `file_open`        | `POST /open/{filename}`    | `app.workspace.openLinkText(path, "")`                                                |

### Medium (integration work needed)

| Tool                 | Notes                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| `search` (simple)    | `prepareSimpleSearch()` from Obsidian API                                        |
| `search` (dataview)  | `(app as any).plugins.plugins["dataview"].api` ⚠️ undocumented internal          |
| `periodic_read`      | Periodic Notes / Daily Notes plugin API for path resolution, then `vault.read()` |
| `periodic_update`    | Same path resolution + structured update logic                                   |
| `tags_manage`        | Read file, parse frontmatter, modify tags, write back                            |
| `frontmatter_manage` | `app.fileManager.processFrontMatter(file, fn)`                                   |

### Hard (must reimplement)

| Tool                 | Notes                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `vault_update`       | Reimplement heading/block/frontmatter content targeting using `Vault.process()` for atomic read-modify-write |
| `active_file_update` | Same as `vault_update`, file resolved from `getActiveFile()`                                                 |

### What carries over unchanged

- All Zod parameter schemas
- Tool names and descriptions
- Response formatting patterns

---

## Acceptance Criteria

- [x] Plugin loads in Obsidian — enabling starts the HTTP server without errors
- [x] API key generated on first load, persisted, and visible in settings tab
- [x] Claude Code connects via `claude mcp add --transport http` — `/mcp` shows connected status
- [x] All 15 tools register with identical names and schemas
- [x] File operations work — vault_list, vault_read, vault_create, vault_update, vault_delete
- [x] Search works — both simple text search and Dataview DQL queries
- [x] Commands work — list and execute Obsidian commands
- [x] Active file works — read and update the currently open note
- [x] Navigation works — file_open opens a note in the UI
- [x] Periodic notes work — read/write daily notes by date reference
- [x] Structured updates work — heading, block reference, and frontmatter targeting produce correct results
- [x] Auth works — requests without valid Bearer token rejected with 401
- [x] Plugin unload is clean — disabling stops the HTTP server, no orphaned listeners

---

## Files to Create/Modify

### Create

```
manifest.json              # Obsidian plugin metadata (id, name, version, minAppVersion, author, description, isDesktopOnly: true)
src/main.ts                # Plugin class — onload/onunload, starts/stops HTTP server
src/server.ts              # HTTP server, Streamable HTTP transport, auth middleware
src/settings.ts            # Settings tab (API key display/regenerate, port config)
esbuild.config.mjs         # Bundle TypeScript + dependencies into main.js
styles.css                 # Required by Obsidian (can be empty)
```

### Modify

```
src/tools/vault.ts         # Rewrite: HTTP calls → app.vault API
src/tools/search.ts        # Rewrite: HTTP calls → prepareSimpleSearch() + Dataview API
src/tools/metadata.ts      # Rewrite: HTTP calls → processFrontMatter() + direct parsing
src/tools/commands.ts      # Rewrite: HTTP calls → app.commands API
src/tools/active-file.ts   # Rewrite: HTTP calls → app.workspace API
src/tools/navigation.ts    # Rewrite: HTTP calls → app.workspace.openLinkText()
src/tools/periodic.ts      # Rewrite: HTTP calls → Periodic Notes plugin API
package.json               # New scripts (build/dev), new deps (obsidian, esbuild), remove old deps
```

### Delete

```
src/api-client.ts          # HTTP client — no longer needed
src/errors.ts              # HTTP/connection error mapping — no longer needed
src/index.ts               # Replaced by src/main.ts
```

---

## References

- [Obsidian Plugin API (TypeScript definitions)](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) — plugin scaffolding, esbuild config, manifest structure
- [Local REST API plugin source](https://github.com/coddingtonbear/obsidian-local-rest-api) — reference for PATCH/structured update logic to reimplement
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `StreamableHTTPServerTransport` usage
- [obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp) — reference for an Obsidian plugin that serves MCP
