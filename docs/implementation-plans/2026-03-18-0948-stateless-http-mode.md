# Implementation Plan: Stateless HTTP Mode

**Created:** 2026-03-18 **Type:** Enhancement **Overview:** Convert the MCP server from session-based to stateless HTTP mode, creating a fresh transport and McpServer per request instead of per session. **Design Spec:** docs/design-specs/2026-03-18-0905-stateless-http-mode.md

---

## Summary

Remove all session state from `HttpServer` and convert to stateless per-request handling. Each POST to `/mcp` creates a fresh `StreamableHTTPServerTransport` and `McpServer`, handles the request, and closes the transport. GET and DELETE return 405 with a JSON-RPC error body. The test suite is rewritten to verify stateless behavior.

---

## Codebase Verification

_Confirmed 2026-03-18 — all design spec assumptions match the actual codebase._

- [x] `server.ts` has `transports` Map, `createSession()`, `handleGetOrDelete()`, session routing in `handlePost()` - Verified: yes
- [x] `server.test.ts` has session-oriented tests and `initializeSession()` helper - Verified: yes
- [x] `main.ts` `createMcpServer()` factory is unchanged and suitable for per-request use - Verified: yes
- [x] `randomUUID` and `isInitializeRequest` imports exist and will be removed - Verified: yes

**Patterns to leverage:**

- Existing `config.createMcpServer()` factory pattern — already designed for repeated instantiation
- Existing `authenticate()` method — unchanged
- Existing socket tracking in `start()` — unchanged

**Discrepancies found:**

- None

---

## Tasks

### Task 1: Convert `HttpServer` to stateless mode

**Description:** Remove session state from `HttpServer` and replace with per-request transport/server creation.

**Files:**

- `plugin/src/server.ts` - modify

**Changes:**

- Remove `randomUUID` and `isInitializeRequest` imports
- Remove `transports` Map field
- Remove `createSession()` method
- Remove `handleGetOrDelete()` method
- Replace `handlePost()` with per-request logic:
  - Create `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`
  - Create `McpServer` via `config.createMcpServer()`
  - Connect server to transport
  - Handle request
  - Close transport in `finally` block
- Replace GET/DELETE branch in `handleRequest()` with inline 405 JSON-RPC error:
  `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}`
- Simplify `stop()` to only destroy sockets and close HTTP server (no transport iteration)

**Done when:** `server.ts` compiles with no session-related code; GET and DELETE to `/mcp` return 405 with the specified JSON-RPC error body.

**Commit:** `refactor: convert HttpServer to stateless HTTP mode`

---

### Task 2: Rewrite test suite for stateless behavior

**Description:** Replace all session-oriented tests with stateless equivalents covering the new behavior.

**Files:**

- `plugin/src/server.test.ts` - modify

**Changes:**

- Remove `initializeSession()` helper
- Remove all session management tests (create session, reuse session, invalid session ID, GET/DELETE with session)
- Add stateless tests:
  - POST with valid MCP request returns successful response with no `mcp-session-id` header
  - GET to `/mcp` returns 405 with JSON-RPC error body
  - DELETE to `/mcp` returns 405 with JSON-RPC error body
  - Two sequential POSTs are independent (no shared state)
  - Server stops cleanly (start, stop, restart)
- Keep existing auth tests (no auth, wrong token, non-Bearer scheme)
- Keep routing tests (404 for unknown routes, 405 for PUT)
- Keep invalid JSON body test

**Done when:** All tests pass; no session-related test code remains; stateless behavior is fully covered.

**Commit:** `test: rewrite test suite for stateless HTTP mode`

---

## Acceptance Criteria

- [x] POST to `/mcp` with valid auth and a valid MCP request returns a successful MCP response with no `mcp-session-id` in response headers
- [x] GET to `/mcp` returns 405 with JSON-RPC error body: `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}`
- [x] DELETE to `/mcp` returns 405 with the same JSON-RPC error body
- [x] POST with missing or invalid Bearer token returns 401
- [x] Two sequential POST requests are completely independent — no shared state
- [x] Server stops cleanly — sockets destroyed, HTTP server closed, no hanging connections
- [x] All tool handlers work unchanged (no regression)
- [x] All tests pass

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                     | Notes                                                                                                                                       |
| ---------- | ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-18 | Task 1 | plugin/src/server.ts      | Deviated: wrapped async logic in `handlePost` with `void (async () => ...)()` to satisfy `@typescript-eslint/no-misused-promises` lint rule |
| 2026-03-18 | Task 2 | plugin/src/server.test.ts | Completed as planned, no deviations                                                                                                         |

---

## Completion

**Completed:** 2026-03-18 **Final Status:** Complete

**Summary:** Converted HttpServer from session-based to stateless HTTP mode. Each POST creates a fresh transport and McpServer, handles the request, and closes. GET/DELETE return 405 with JSON-RPC error. Test suite rewritten for stateless behavior (11 tests).

**Deviations from Plan:** Wrapped async logic in `handlePost` with `void (async () => ...)()` to satisfy `@typescript-eslint/no-misused-promises` lint rule.

---

## Notes

- The `createMcpServer()` factory creates an `McpServer` and synchronously registers 7 tool groups — pure in-memory operations with no I/O. Per-request creation has negligible cost.
- `StreamableHTTPSessionManager` refactor is backlogged separately (see `docs/backlog.md`).
