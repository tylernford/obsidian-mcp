# HTTP Server & Auth

**Created:** 2026-03-15
**Updated:** 2026-03-15
**Implementation Plan:** TBD
**Parent Spec:** [Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)
**Validation:** [HTTP Server & Auth — Design Spec Validation](./2026-03-15-1516-http-server-auth-validation.md)

---

## Overview

**What:** Add an HTTP server with Streamable HTTP transport and API key authentication to the Obsidian plugin, plus a settings tab for configuration. This is the infrastructure layer that all MCP tool requests will flow through.

**Why:** The plugin needs to accept MCP connections from Claude Code over HTTP. This phase establishes the server, transport, and auth so that subsequent phases can focus solely on porting tools.

**Type:** Refactor

---

## Requirements

### Must Have

- [ ] HTTP server listening on `127.0.0.1` with configurable port (default `28080`)
- [ ] Streamable HTTP transport serving MCP on `POST /mcp`, `GET /mcp`, `DELETE /mcp`
- [ ] Stateful session management — one `NodeStreamableHTTPServerTransport` per session, stored in a map keyed by `mcp-session-id` header
- [ ] `McpServer` connected to each new transport via `await mcpServer.connect(transport)` before handling requests
- [ ] API key authentication — auto-generated on first load via `crypto.randomBytes(32).toString('hex')`
- [ ] API key persisted in Obsidian's `SecretStorage` via `app.secretStorage.setSecret()` / `getSecret()`
- [ ] Auth middleware validates `Authorization: Bearer <key>` on all requests; rejects with `401 {"error": "Unauthorized"}`
- [ ] Settings tab with:
  - "How to Connect" section showing populated `mcp.json` snippet and `claude mcp add` command (both copyable)
  - API key display (read-only) + copy button + regenerate button (with confirmation dialog)
  - Port input with description + confirmation dialog and automatic server restart on change
- [ ] `McpServer` instance created in `main.ts` (zero tools), passed to server module
- [ ] Server starts in `onload()`, stops in `onunload()`
- [ ] Clean shutdown — close all transports, clear session map, `server.close()`, no orphaned listeners
- [ ] Tests for server (auth, routing, session management, lifecycle), settings (rendering), crypto (format, uniqueness), and main (onload flow)

### Nice to Have

- [ ] (None identified — this phase is deliberately minimal)

### Out of Scope

- Tool registration (subsequent phases)
- HTTPS support
- Additional routes (health check, status page)
- Stdio or WebSocket transports
- Binding to `0.0.0.0` or non-localhost interfaces
- Session timeouts or max session limits

---

## Design Decisions

### 1. McpServer ownership — created externally, passed to server module

**Options considered:**

1. **`server.ts` owns the McpServer** — self-contained, one module manages the entire MCP stack. But takes on two responsibilities (HTTP infrastructure + MCP session management), and tighter coupling makes it harder to configure the McpServer differently later.
2. **McpServer created in `main.ts`, passed to `server.ts`** — single responsibility for each module, `main.ts` orchestrates, tests can pass in any McpServer configuration.

**Decision:** Option 2. `server.ts` is pure HTTP infrastructure. `main.ts` orchestrates — this is the natural role of a plugin entry point. More testable since tests can pass in a bare McpServer without touching server internals.

### 2. Raw `http.createServer()` (no framework)

**Options considered:**

1. **Raw `http.createServer()`** — minimal, no dependencies, one route to handle. The MCP SDK's `NodeStreamableHTTPServerTransport` handles request body parsing and response formatting.
2. **Express** — familiar middleware pattern, but ~570KB bundled for one route.
3. **Lightweight framework (Hono, Polka)** — cleaner than raw http, but still overkill for one route.

**Decision:** Option 1. We have a single authenticated endpoint. The transport does the heavy lifting — our server is just auth check + route to transport. A framework adds bundle size and complexity for no benefit.

### 3. API key format — plain hex

**Options considered:**

1. **Hex** (`crypto.randomBytes(32).toString('hex')`) — 64-char string, simple, no encoding issues, consistent with Local REST API plugin's approach.
2. **Base64url** — shorter (43 chars) but mixed case + symbols.
3. **UUID v4** — familiar format but only 122 bits of entropy.
4. **Prefixed hex** (`mcp_...`) — self-documenting but longest option.

**Decision:** Plain hex. Sufficient entropy for localhost auth, consistent with the Local REST API plugin users are migrating from, no external dependencies (Node's `crypto` module).

### 4. Auth failure response — opaque 401

**Decision:** All auth failures return `401` with `{"error": "Unauthorized"}` and `Content-Type: application/json`. No distinction between missing token and wrong token — keeps it opaque to avoid leaking information. This is simpler than Local REST API's numeric error code system, which is unnecessary for a single-endpoint server.

### 5. Routes — `/mcp` only

**Options considered:**

1. **`/mcp` only** — minimal attack surface, transport handles all three HTTP methods (POST, GET, DELETE) per the Streamable HTTP spec.
2. **`/mcp` + `GET /`** — unauthenticated status endpoint for quick "is it running?" checks.

**Decision:** `/mcp` only. If the server is listening, the plugin is running. A status endpoint adds surface area for no clear use case — MCP clients discover capabilities through the protocol's initialization handshake.

### 6. Server always on while plugin is enabled

**Decision:** No on/off toggle. The plugin _is_ the server — enabling the plugin starts the server, disabling stops it. A toggle would add UI state and "is it running?" confusion for no benefit.

### 7. Stateful session management

**Options considered:**

1. **Stateful** — one transport per session, stored in a map keyed by `mcp-session-id` header. New transport created only for `initialize` requests; subsequent requests reuse the existing transport. This is the pattern demonstrated by the MCP SDK's Streamable HTTP example.
2. **Stateless** — new transport per request. Simpler, but no session continuity between requests.

**Decision:** Stateful. MCP clients expect session continuity — the protocol has an explicit initialization handshake, and tools/resources are discovered per-session. The SDK example defaults to this pattern, and the additional complexity is well-contained in `server.ts` (a transport map + cleanup on close).

### 8. API key storage — SecretStorage

**Options considered:**

1. **`data.json`** via `loadData()`/`saveData()` — simple, co-located with other settings. Key stored in plaintext.
2. **`SecretStorage`** via `app.secretStorage.setSecret()` / `getSecret()` — Obsidian 1.11.4+ API designed for secrets. Stored separately from settings.

**Decision:** SecretStorage. It's the API Obsidian provides for exactly this use case. The key is a secret, not a setting — storing it alongside port config in plaintext `data.json` is semantically wrong. The API is simple (`setSecret`/`getSecret`) and adds no complexity to the call sites.

### 9. Node.js transport class — `NodeStreamableHTTPServerTransport`

**Decision:** Use `NodeStreamableHTTPServerTransport`, not `StreamableHTTPServerTransport`. The base `StreamableHTTPServerTransport` (now `WebStandardStreamableHTTPServerTransport`) expects Web Standard `Request`/`Response` objects. `http.createServer()` provides Node's `IncomingMessage`/`ServerResponse`. `NodeStreamableHTTPServerTransport` is a wrapper that accepts Node types and converts internally. This is what the SDK's own Node.js example uses.

---

## Architecture

### Module Structure

```
plugin/src/
  main.ts          # Plugin lifecycle — orchestrates everything
  server.ts        # HttpServer class — HTTP server, auth middleware, session management, transport wiring
  settings.ts      # MCPToolsSettingTab — settings tab UI
  crypto.ts        # generateApiKey() — API key generation
```

### `main.ts` — onload flow

```
onload()
  1. saved = await this.loadData()                              // null on first load
  2. this.settings = merge(DEFAULT_SETTINGS, saved)              // apply defaults for missing fields
  3. apiKey = await this.app.secretStorage.getSecret('api-key')  // separate from settings
     if (!apiKey)
       apiKey = generateApiKey()
       await this.app.secretStorage.setSecret('api-key', apiKey)
  4. create McpServer (plugin name + version, zero tools)
  5. create HttpServer({ port, host, apiKey, mcpServer })
  6. await httpServer.start()
  7. this.addSettingTab(new MCPToolsSettingTab(this.app, this))

onunload()
  1. await httpServer.stop()
```

### `server.ts` — request handling flow

```
HttpServer class
  constructor(config: { port, host, apiKey, mcpServer })
  start(): Promise<void>
  stop(): Promise<void>

  Internal state:
    transports: Map<string, NodeStreamableHTTPServerTransport>

Request flow:
  Incoming request
    → Check Authorization: Bearer <key>
      → Missing/invalid → 401 {"error": "Unauthorized"}
    → Route by method + path
      → POST /mcp:
          sessionId = req.headers['mcp-session-id']
          if sessionId && transports.has(sessionId)
            → existing transport.handleRequest(req, res)
          else if !sessionId && isInitializeRequest(req.body)
            → create new NodeStreamableHTTPServerTransport
            → await mcpServer.connect(transport)
            → store transport in map (keyed by transport.sessionId)
            → transport.onclose → remove from map
            → transport.handleRequest(req, res)
          else
            → 400 Bad Request
      → GET /mcp:
          sessionId = req.headers['mcp-session-id']
          → existing transport.handleRequest(req, res) or 400
      → DELETE /mcp:
          sessionId = req.headers['mcp-session-id']
          → existing transport.handleRequest(req, res) or 400
      → Anything else → 404

  stop():
    → close all transports in map
    → clear map
    → server.close()
```

### `settings.ts` — UI layout (top to bottom)

1. **"How to Connect"** — `mcp.json` snippet + `claude mcp add` command (both populated with actual port/key, both copyable)
2. **API Key** — read-only display, copy button, regenerate button (confirmation dialog)
3. **Port** — text input (default 28080), description, confirmation dialog + server restart on change

### Settings Interface

```typescript
interface MCPToolsSettings {
  port: number; // default 28080
}
```

API key is not part of the settings interface — it is managed separately via `SecretStorage`.

---

## Testing Strategy

### `server.test.ts`

- [ ] Server starts and listens on configured port
- [ ] Server stops cleanly (port released, all sessions closed)
- [ ] Request without Authorization header → 401
- [ ] Request with wrong token → 401
- [ ] Initialize request with valid token to POST /mcp → creates session, passed to transport (200)
- [ ] Subsequent request with valid session ID → reuses existing transport
- [ ] Request with unknown session ID → 400
- [ ] Non-initialize POST without session ID → 400
- [ ] GET /mcp and DELETE /mcp with valid session → routed to transport
- [ ] GET /mcp and DELETE /mcp without valid session → 400
- [ ] Request to unknown route → 404
- [ ] Session cleanup on transport close (removed from map)
- [ ] `stop()` clears all sessions

### `settings.test.ts`

- [ ] Settings tab renders without errors
- [ ] Displays current API key and port values
- [ ] "How to Connect" blocks contain correct URL and key

### `crypto.test.ts`

- [ ] Returns a 64-character hex string
- [ ] Two calls produce different values

### `main.test.ts` (expand existing smoke test)

- [ ] onload() generates API key on first load (`secretStorage.getSecret` returns null)
- [ ] onload() preserves existing API key from `secretStorage`
- [ ] Default settings applied correctly

### Mocking approach

- `McpServer` and `NodeStreamableHTTPServerTransport` — mocked to avoid real MCP handshake in server tests
- Obsidian APIs — existing manual mock, extended with `Setting`, `PluginSettingTab`, `Notice`, `SecretStorage` as needed
- HTTP layer — real `http.createServer()` on random port in server tests (no mocking the HTTP layer itself)

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

## Dependencies

### New (add to `plugin/package.json`)

- `@modelcontextprotocol/sdk` — `McpServer`, `NodeStreamableHTTPServerTransport`
  - **⚠️ Verify:** SDK source suggests server exports may be split across packages (e.g., `@modelcontextprotocol/server`). Confirm the correct published npm package name and import paths during implementation.

### Existing (no changes)

- Node.js built-ins: `http`, `crypto` (already externalized by esbuild via `builtinModules`)
- Zod: transitive dependency of MCP SDK

### Build

- No changes to `esbuild.config.mjs` — Node built-ins already externalized

---

## Files to Create/Modify

### Create

```
plugin/src/server.ts           # HttpServer class — HTTP server, auth middleware, session management, transport wiring
plugin/src/server.test.ts      # Server tests (auth, routing, session management, lifecycle)
plugin/src/settings.ts         # MCPToolsSettingTab — settings tab UI
plugin/src/settings.test.ts    # Settings tab rendering tests
plugin/src/crypto.ts           # generateApiKey() function
plugin/src/crypto.test.ts      # API key format/uniqueness tests
```

### Modify

```
plugin/src/main.ts             # onload flow (SecretStorage for API key), onunload, settings interface, server restart method
plugin/src/main.test.ts        # Expand with onload/settings tests (mock SecretStorage)
plugin/package.json            # Add MCP SDK dependency
plugin/src/__mocks__/obsidian.ts  # Add Setting, PluginSettingTab, Notice, SecretStorage stubs as needed
```

### No Changes

```
plugin/esbuild.config.mjs     # Node built-ins already externalized
plugin/manifest.json           # No metadata changes
plugin/tsconfig.json           # No config changes
plugin/eslint.config.mts       # No config changes
```

---

## References

- [MCP Spec: Transports (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP transport definition
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `McpServer`, `NodeStreamableHTTPServerTransport`
- [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) (local: `reference/obsidian-local-rest-api/`) — reference for auth pattern and settings UI
- [Parent Spec: Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)
- [Root Spec: Convert to Obsidian Plugin](./2026-03-12-1317-convert-to-obsidian-plugin.md)
- [Design Spec Validation](./2026-03-15-1516-http-server-auth-validation.md) — issues found by cross-referencing against MCP SDK source and Obsidian API
- [Reference Repo Map](../research/reference-repo-map.md) — directory structure of reference repos
