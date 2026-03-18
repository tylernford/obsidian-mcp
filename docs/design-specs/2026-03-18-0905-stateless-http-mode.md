# Stateless HTTP Mode

**Created:** 2026-03-18 **Implementation Plan:** docs/implementation-plans/2026-03-18-0948-stateless-http-mode.md

---

## Overview

**What:** Convert the MCP server from session-based to stateless HTTP mode, creating a fresh transport and McpServer per request instead of per session.

**Why:** The MCP SDK does not implement spec-required auto-reconnect on HTTP 404 for stale sessions. This causes Claude Code (and other SDK-based clients) to show a "disconnected" error requiring manual `/mcp reconnect`. Stateless mode eliminates sessions entirely, removing the problem at the server level. See `docs/research/mcp-sdk-404-reconnect-gap.md` for full analysis.

**Type:** Enhancement

---

## Requirements

### Must Have

- [ ] POST to `/mcp` creates a per-request `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` and a per-request `McpServer`
- [ ] Transport is explicitly closed via `transport.close()` in a `finally` block after each request
- [ ] GET to `/mcp` returns 405 with a self-constructed JSON-RPC error body (not delegated to the SDK transport)
- [ ] DELETE to `/mcp` returns 405 with the same JSON-RPC error body
- [ ] Auth (Bearer token) still enforced on all methods
- [ ] No session state between requests — each POST is fully independent
- [ ] Server stops cleanly — sockets destroyed, HTTP server closed
- [ ] All tool handlers work unchanged
- [ ] Test suite rewritten for stateless behavior

### Nice to Have

- (none)

### Out of Scope

- Refactoring to `StreamableHTTPSessionManager` (backlogged in `docs/backlog.md`)
- Upstream SDK contribution (separate effort)
- Configuration toggle for stateful vs stateless — stateless only
- Updating `docs/research/mcp-sdk-404-reconnect-gap.md` status

---

## Design Decisions

### Stateless mode vs other mitigations

**Options considered:**

1. Wait for upstream SDK fix — no work, but users stuck with manual reconnect indefinitely
2. Upstream contribution — fixes it for everyone, but prior PR was closed without review
3. Server-side session recovery — transparent to clients, but makes session IDs meaningless
4. Fork/patch SDK transport — only useful if we control the client, which we don't
5. Stateless mode — eliminates sessions entirely using a supported SDK configuration

**Decision:** Option 5. Our tool calls are fully discrete with no accumulated state between calls. The server already creates a new McpServer per session — per-request is functionally equivalent. The MCP spec explicitly allows stateless operation, and the SDK provides a first-class example (`simpleStatelessStreamableHttp`).

### GET and DELETE handling

**Options considered:**

1. Return 405 with self-constructed JSON-RPC error body
2. Return 200 no-op for DELETE

**Decision:** Option 1. The MCP spec defines GET for SSE streams (session-dependent) and DELETE for session termination — neither applies without sessions. The SDK's official stateless example returns 405 for both. We construct the response body ourselves rather than delegating to the SDK, so we control the shape and are not affected by future SDK changes.

### Per-request transport cleanup

**Options considered:**

1. Trust GC to clean up per-request transport and McpServer instances
2. Explicit `transport.close()` in a `finally` block after each request

**Decision:** Option 2. Explicit cleanup is predictable, consistent with how `stop()` already handles transports, and defensive against the SDK adding internal timers or event listeners that wouldn't be torn down by GC alone.

### Abstraction level

**Options considered:**

1. Continue using `StreamableHTTPServerTransport` directly (current approach)
2. Refactor to `StreamableHTTPSessionManager` (higher-level SDK abstraction)

**Decision:** Option 1. We already use the lower-level transport, and the SDK's stateless example uses the same level. Switching to `StreamableHTTPSessionManager` would be a larger diff for no behavioral change. Backlogged for future consideration.

### Per-request McpServer creation cost

**Considered and dismissed.** `createMcpServer()` creates an `McpServer` instance and synchronously registers 7 tool groups — pure in-memory map insertions with no I/O. The current code already calls this once per session; stateless mode calls it once per request, which is the same frequency in practice since Claude Code sends one tool call per request. No benchmark needed.

---

## Tradeoffs

### No server-initiated notifications (permanent)

Stateless mode eliminates sessions, which eliminates SSE streaming (GET endpoint). This means the server can never push unsolicited updates to clients — no progress notifications, no long-running tool status, no file-watch events.

This is acceptable for our use case: all tool calls are short-lived request-response operations against Obsidian's API. If server-initiated notifications are ever needed, they would require reintroducing sessions or adopting a different mechanism (e.g., polling, webhooks).

---

## Acceptance Criteria

- [ ] POST to `/mcp` with valid auth and a valid MCP request returns a successful MCP response with no `mcp-session-id` in response headers
- [ ] GET to `/mcp` returns 405 with JSON-RPC error body: `{"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}`
- [ ] DELETE to `/mcp` returns 405 with the same JSON-RPC error body
- [ ] POST with missing or invalid Bearer token returns 401
- [ ] Two sequential POST requests are completely independent — no shared state
- [ ] Server stops cleanly — sockets destroyed, HTTP server closed, no hanging connections
- [ ] All tool handlers work unchanged (no regression)
- [ ] All tests pass

---

## Server state removal

The following are removed from `HttpServer`:

| Removed                           | Reason                                           |
| --------------------------------- | ------------------------------------------------ |
| `transports` Map                  | No sessions to track                             |
| `createSession()` method          | No session lifecycle                             |
| `handleGetOrDelete()` method      | Replaced by inline 405 responses                 |
| Session routing in `handlePost()` | Every POST is independent — no session ID lookup |

The `stop()` method simplifies to: destroy sockets, close HTTP server. No transports to iterate and close.

---

## References

```
plugin/src/server.ts                    # Current session-based implementation being modified
plugin/src/server.test.ts               # Current tests being rewritten
plugin/src/main.ts                      # createMcpServer factory — unchanged, called per-request
docs/research/mcp-sdk-404-reconnect-gap.md  # Problem analysis and rationale for this change
docs/backlog.md                         # StreamableHTTPSessionManager refactor item — not in scope
```

**SDK stateless example** (reference pattern for per-request transport creation):
`node_modules/.pnpm/@modelcontextprotocol+sdk@1.27.1_zod@4.3.6/node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/simpleStatelessStreamableHttp.js`

**FastMCP stateless HTTP** (mature stateless implementation — method restrictions, lifespan, session manager config):
`reference/fastmcp/src/fastmcp/server/http.py`

---

## Suggested Files to Create/Modify

```
plugin/src/server.ts       # Remove transports Map, createSession(), session routing,
                           # handleGetOrDelete(). Replace handlePost() with per-request
                           # transport + McpServer creation with explicit close() in finally.
                           # Simplify stop(). GET/DELETE return 405 inline.
plugin/src/server.test.ts  # Remove session-oriented tests. Add stateless equivalents:
                           # per-request handling, 405 for GET/DELETE, auth, independence,
                           # stop/cleanup, no mcp-session-id header in responses.
```
