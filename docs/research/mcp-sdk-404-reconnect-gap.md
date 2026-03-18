# MCP SDK 404 Auto-Reconnect Gap

**Date:** 2026-03-17
**Status:** Open upstream issue
**Discovered during:** Stale Session Reconnect bugfix (BUG-003)

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

| Link                                                                              | Status            | Summary                                                                                                |
| --------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| [PR #1371](https://github.com/modelcontextprotocol/typescript-sdk/pull/1371)      | Closed (unmerged) | "feat: add automatic session recovery" — would have fixed this. Closed 2026-02-05 without review.      |
| [Issue #389](https://github.com/modelcontextprotocol/typescript-sdk/issues/389)   | Open (P2)         | SDK examples return 400 instead of 404 for invalid sessions. Comments call out Claude Code's behavior. |
| [Issue #812](https://github.com/modelcontextprotocol/typescript-sdk/issues/812)   | Open              | Documents idle-timeout → 404 → stuck client scenario.                                                  |
| [Issue #1476](https://github.com/modelcontextprotocol/typescript-sdk/issues/1476) | Open              | Client can't recover after server restart.                                                             |
| [Issue #1635](https://github.com/modelcontextprotocol/typescript-sdk/issues/1635) | Open              | GET SSE stream throws on 404 instead of handling gracefully.                                           |

## Potential Paths Forward

### 1. Wait for upstream fix (recommended)

Our server is spec-correct. When the SDK implements 404 auto-reconnect, it will just work.

**Pros:** No extra work, no divergence from spec.
**Cons:** Users hitting stale sessions need manual `/mcp reconnect` until then.

### 2. Upstream contribution

Comment on existing issues or submit a new PR implementing 404 → reinitialize in
`StreamableHTTPClientTransport`. The code change is relatively small (catch 404, clear
session ID, re-send InitializeRequest). PR #1371 was closed without review, so appetite
is unclear.

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

## Recommendation

**Path 1 + 2.** Our server-side fix is correct and complete. The fix belongs in the SDK.
Monitor the upstream issues and consider contributing a PR if they remain unresolved.
