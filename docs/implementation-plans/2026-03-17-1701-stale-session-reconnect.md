# Implementation Plan: Stale Session Reconnect

**Created:** 2026-03-17 **Type:** Bugfix **Overview:** Return HTTP 404 (instead of 400) for requests with invalid or expired session IDs, enabling spec-compliant MCP clients to auto-reinitialize. **Design Spec:** docs/design-specs/2026-03-17-1642-stale-session-reconnect.md

---

## Summary

Change the MCP server's HTTP response from 400 to 404 when a request includes an invalid or expired session ID. This aligns with the MCP spec and allows compliant clients (e.g., the TypeScript SDK's `StreamableHTTPClientTransport`) to automatically reinitialize. The GET/DELETE handler also needs to be split to distinguish "missing session ID" (400) from "invalid session ID" (404).

---

## Codebase Verification

_Confirm assumptions from design spec match actual codebase_

- [x] `plugin/src/server.ts` returns 400 for invalid sessions — Verified: POST handler (line 118), GET/DELETE handler (line 136)
- [x] `plugin/src/server.test.ts` has assertions checking 400 for invalid sessions — Verified: lines 174, 191, 199, 207, 244
- [x] Sessions stored in `Map<string, StreamableHTTPServerTransport>` — Verified: line 16
- [x] Session ID passed via `mcp-session-id` header — Verified: lines 104, 133

**Patterns to leverage:**

- Existing session validation pattern: `this.transports.has(sessionId)`
- Existing error response pattern: `res.writeHead(code, { "Content-Type": "application/json" })` + `res.end(JSON.stringify({ error: "..." }))`

**Discrepancies found:**

- GET/DELETE handler combines "missing" and "invalid" session into one check (`!sessionId || !this.transports.has(sessionId)` → 400). This must be split to return 400 for missing and 404 for invalid.

---

## Tasks

### Task 1: Update session validation responses in server.ts

**Description:** Change HTTP 400 → 404 for invalid/expired session IDs. Split the GET/DELETE handler to distinguish "missing session ID" (400) from "invalid session ID" (404). Update error messages to be descriptive.

**Files:**

- `plugin/src/server.ts` — modify

**Changes:**

1. POST handler (line 118): Change `400` → `404`, update message to `"Session not found — client should reinitialize"`

2. GET/DELETE handler (lines 135-138): Split into two conditions:

```typescript
if (!sessionId) {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Missing session ID" }));
  return;
}
if (!this.transports.has(sessionId)) {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({ error: "Session not found — client should reinitialize" }),
  );
  return;
}
```

**Done when:** Server returns 404 for invalid session IDs and 400 for missing session IDs. Manual review confirms only invalid-session cases changed.

**Commit:** `"Fix: Return HTTP 404 for invalid session IDs"`

---

### Task 2: Update tests for new session validation status codes

**Description:** Update existing test assertions from 400 → 404 where the test provides an invalid/stale session ID. Add new tests for GET/DELETE without any session ID header (should remain 400). Ensure all tests pass.

**Files:**

- `plugin/src/server.test.ts` — modify

**Changes:**

1. "returns 400 for invalid session ID on POST" (line 177) — rename to "returns 404...", change assertion to `toBe(404)`
2. "returns 400 for GET without valid session ID" (line 194) — rename to "returns 404 for GET with invalid session ID", change assertion to `toBe(404)`, ensure test sends an actual invalid session ID header
3. "returns 400 for DELETE without valid session ID" (line 202) — rename to "returns 404 for DELETE with invalid session ID", change assertion to `toBe(404)`, ensure test sends an actual invalid session ID header
4. Session invalidated after DELETE (line 244) — change assertion to `toBe(404)`
5. Add new tests for GET and DELETE without any session ID header → expect 400
6. "returns 400 for non-initialize POST without session ID" (line 163) — keep as-is

**Done when:** `pnpm test` passes. All 6 acceptance criteria from the design spec are covered by tests.

**Commit:** `"Update tests for stale session 404 responses"`

---

## Acceptance Criteria

- [ ] POST with a stale/invalid `mcp-session-id` header returns 404
- [ ] GET with a stale/invalid `mcp-session-id` header returns 404
- [ ] DELETE with a stale/invalid `mcp-session-id` header returns 404
- [ ] POST without `mcp-session-id` on a non-initialize request returns 400 (unchanged)
- [ ] Fresh `InitializeRequest` after restart successfully creates a new session
- [ ] All existing tests pass with updated assertions

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                | Notes                                                                                             |
| ---------- | ------ | -------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-03-17 | Task 1 | plugin/src/server.ts | Status 400→404 for invalid sessions; GET/DELETE handler split into missing (400) vs invalid (404) |

---

## Completion

**Completed:** [Date] **Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- The MCP spec prescribes 404 for invalidated sessions; compliant clients auto-reinitialize on 404.
- The GET/DELETE handler split is not in the design spec but is necessary to correctly distinguish missing vs. invalid sessions.
