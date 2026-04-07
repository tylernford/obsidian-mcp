# MCP SDK 404 Auto-Reconnect Gap

**Date:** 2026-03-17
**Updated:** 2026-03-18
**Status:** Open upstream issue — server-side mitigation proposed

---

## Summary

The MCP spec requires clients to auto-reinitialize when they receive HTTP 404 for an
invalid/expired session ID. The official TypeScript SDK (`@modelcontextprotocol/sdk`) does
not implement this. Both the spec and the SDK are maintained by Anthropic under the
`modelcontextprotocol` GitHub org — the SDK is noncompliant with its own spec.

## What the Spec Says

From the Streamable HTTP transport spec (consistent across versions 2025-03-26 through
2025-11-25 and draft):

> The server MAY terminate the session at any time, after which it MUST respond to
> requests containing that session ID with HTTP 404 Not Found.

> When a client receives HTTP 404 in response to a request containing an
> `Mcp-Session-Id`, it **MUST** start a new session by sending a new
> `InitializeRequest` without a session ID attached.

## What the SDK Actually Does

`StreamableHTTPClientTransport.send()` handles specific status codes:

- **401** → triggers auth flow
- **403** → triggers upscoping flow
- **Everything else** (including 404) → throws `StreamableHTTPError`

There is no logic to detect a 404 with a stale session ID and auto-reinitialize. The
error propagates to the caller (e.g., Claude Code), which surfaces it as a user-facing
error requiring manual reconnection.

Additionally, the SDK's own server examples return 400 (not 404) for invalid session IDs,
compounding the issue on both sides.

## Impact on This Project

Our MCP server now correctly returns 404 for invalid/expired session IDs (per BUG-003
fix). However, Claude Code — which uses the SDK's transport — does not auto-reconnect. It
shows a "disconnected" message and requires the user to run `/mcp reconnect` manually.

When the SDK eventually implements the spec-required behavior, our server will work
correctly with auto-reconnecting clients without any further changes.

## Upstream Issues and PRs

| Link                                                                              | Status             | Summary                                                                                                |
| --------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| [PR #1371](https://github.com/modelcontextprotocol/typescript-sdk/pull/1371)      | Closed (unmerged)  | "feat: add automatic session recovery" — would have fixed this. Closed 2026-02-05 without review.      |
| [PR #1402](https://github.com/modelcontextprotocol/typescript-sdk/pull/1402)      | Open (changes req) | Handles HTTP 410 Gone for expired sessions. Has maintainer engagement — closest active PR to a fix.    |
| [Issue #389](https://github.com/modelcontextprotocol/typescript-sdk/issues/389)   | Open (P2)          | SDK examples return 400 instead of 404 for invalid sessions. Comments call out Claude Code's behavior. |
| [Issue #812](https://github.com/modelcontextprotocol/typescript-sdk/issues/812)   | Open               | Documents idle-timeout → 404 → stuck client scenario.                                                  |
| [Issue #1476](https://github.com/modelcontextprotocol/typescript-sdk/issues/1476) | Open               | Client can't recover after server restart.                                                             |
| [Issue #1635](https://github.com/modelcontextprotocol/typescript-sdk/issues/1635) | Open               | GET SSE stream throws on 404 instead of handling gracefully.                                           |

### Affected clients

This is not unique to Claude Code. Cursor, LibreChat, OpenAI Codex, and Gemini CLI all
use the SDK's transport and are affected. Cursor fixed it client-side in v2.2.14. Claude
Code [#29510](https://github.com/anthropics/claude-code/issues/29510) added auto-reconnect
for connection drops but not for 404 stale sessions. One user documented 53 stale-session
incidents across 14 sessions in a single week
([#27142](https://github.com/anthropics/claude-code/issues/27142)).

## Potential Paths Forward

### 1. Wait for upstream fix

Our server is spec-correct. When the SDK implements 404 auto-reconnect, it will just work.

**Pros:** No extra work, no divergence from spec.
**Cons:** Users hitting stale sessions need manual `/mcp reconnect` until then.

### 2. Upstream contribution

Comment on existing issues or submit a new PR implementing 404 → reinitialize in
`StreamableHTTPClientTransport`. The code change is relatively small (catch 404, clear
session ID, re-send InitializeRequest). PR #1371 was closed without review, so appetite
is unclear. PR #1402 (410 handling) has active maintainer review and follows the same
pattern used for 401/403.

**Pros:** Fixes it for everyone.
**Cons:** May not be accepted; prior PR was closed without explanation.

### 3. Server-side session recovery

When the server receives a request with an invalid session ID, automatically create a new
session and process the request instead of returning 404. The client wouldn't need to know
anything changed.

**Pros:** Transparent to clients.
**Cons:** Goes beyond the spec. The client still holds a stale session ID — subsequent
requests would need the same treatment, effectively making session IDs meaningless.

### 4. Fork/patch the SDK transport

Ship a patched `StreamableHTTPClientTransport` that handles 404 correctly.

**Pros:** Full control over client behavior.
**Cons:** Only useful if we control the client. We don't control Claude Code's MCP client,
which is the primary consumer.

### 5. Switch to stateless mode (proposed)

Run the server in stateless HTTP mode by setting `sessionIdGenerator: undefined` on
`StreamableHTTPServerTransport`. This eliminates sessions entirely — no session IDs, no
stale sessions, no 404s, no reconnect problem.

The SDK supports this as a first-class configuration. The official
`simpleStatelessStreamableHttp` example in the SDK dist demonstrates the pattern: create a
fresh transport per request with no session ID generator. FastMCP (Python) and datagouv-mcp
have adopted this approach for the same reason.

**Feasibility for this project:** Our tool calls are fully discrete. Each handler makes an
independent call to Obsidian's API with no state accumulated between calls. The server
currently creates a new `McpServer` per session and registers identical tools each time —
sessions provide no value. Stateless mode would create a new transport + server per
_request_ instead of per _session_, which is functionally equivalent for our use case.

**What changes:**

- The `transports` Map, session routing logic, and `createSession` method in `server.ts`
  are replaced by per-request transport creation
- The 404-for-stale-sessions fix from #23 becomes unnecessary (no sessions to go stale)
- `stop()` simplifies — no transports Map to iterate
- HTTP socket tracking (`connections` Set) is unaffected

**What doesn't change:**

- Tool handlers — completely untouched
- Authentication — still per-request Bearer token
- The `/mcp` endpoint and HTTP method handling

**Pros:** Eliminates the problem entirely at the server level. Uses a supported SDK mode
with an official example. No spec divergence — the spec explicitly allows stateless
operation. Simplifies the server code.
**Cons:** Per-request `McpServer` creation + tool registration overhead (negligible — a
handful of `server.tool()` calls). Cannot support future session-dependent features without
reverting, though none are planned or foreseeable.

## Recommendation

**Path 5** as the immediate fix, with Path 2 as a longer-term contribution. Stateless mode
eliminates the problem for our users now, and an upstream SDK fix would benefit the broader
ecosystem regardless.
