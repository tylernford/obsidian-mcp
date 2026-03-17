# Stale Session Reconnect

**Created:** 2026-03-17 **Implementation Plan:** docs/implementation-plans/2026-03-17-1701-stale-session-reconnect.md

---

## Overview

**What:** Return HTTP 404 (instead of 400) for requests with invalid or expired session IDs, enabling spec-compliant MCP clients to auto-reinitialize.

**Why:** When Obsidian restarts, the HTTP server generates a new session and all in-memory sessions are lost. MCP clients holding old session IDs receive a 400 error and cannot recover without manual reinitialization. The MCP spec prescribes 404 for this case, and compliant clients (including the TypeScript SDK's `StreamableHTTPClientTransport`) are built to automatically send a fresh `InitializeRequest` upon receiving 404.

**Type:** Bugfix

---

## Requirements

### Must Have

- [ ] POST/GET/DELETE requests with an invalid or expired session ID return HTTP 404
- [ ] POST requests without a session ID on non-initialize requests still return HTTP 400
- [ ] Existing tests updated to reflect the new status code
- [ ] New session initialization still works after an Obsidian restart

### Nice to Have

- [ ] Descriptive response body that helps debugging (e.g., `"Session not found — client should reinitialize"`)

### Out of Scope

- Session persistence across restarts
- Custom reconnection logic or handshake protocol
- EventStore / stream resumability (SSE event IDs)
- Client-side changes
- Backwards-compatibility shim for old 400 behavior

---

## Design Decisions

### Status code for invalid sessions: 404 vs 400 vs custom

**Options considered:**

1. **400 Bad Request** (current) — Semantically wrong; 400 means malformed request, but the request is well-formed — the session just doesn't exist. MCP clients don't auto-recover on 400.
2. **404 Not Found** — MCP spec says servers SHOULD respond with 404 for invalidated sessions. Compliant clients auto-reinitialize on 404. Minimal change.
3. **Custom reconnection protocol** — Server detects stale session and issues a new one inline. Over-engineered for the problem; fights the spec.

**Decision:** 404 — aligns with the MCP spec, leverages existing client reconnection behavior, and is the smallest possible fix.

### What stays 400

Requests that are genuinely malformed still return 400:

- Non-initialize POST without any session ID header
- This distinguishes "your session expired" (404) from "you forgot to include a session ID" (400)

---

## Acceptance Criteria

- [ ] POST with a stale/invalid `mcp-session-id` header returns 404
- [ ] GET with a stale/invalid `mcp-session-id` header returns 404
- [ ] DELETE with a stale/invalid `mcp-session-id` header returns 404
- [ ] POST without `mcp-session-id` on a non-initialize request returns 400 (unchanged)
- [ ] Fresh `InitializeRequest` after restart successfully creates a new session
- [ ] All existing tests pass with updated assertions

---

## Suggested Files to Create/Modify

```
plugin/src/server.ts       # Change 400 → 404 for invalid session responses (POST, GET, DELETE handlers)
plugin/src/server.test.ts  # Update test assertion from 400 → 404
```
