# Actionable Error Messages

**Created:** 2026-02-17
**Status:** Design
**Implementation Plan Doc:** docs/implementation-plans/2026-02-17-0910-actionable-error-messages.md

---

## Overview

**What:** Improve error messages in the API client to include actionable guidance for common failure scenarios.

**Why:** Current error messages for most failures are generic (e.g., `Connection error: {message}`, `Obsidian API error (status): message`). Only `ECONNREFUSED` has a helpful message. Users hitting auth failures, DNS issues, or timeouts get no guidance on what to fix.

**Type:** Enhancement

---

## Requirements

### Must Have

- [ ] Detect `EACCES`, `ETIMEDOUT`, and `ENOTFOUND` system errors with specific messages
- [ ] Detect HTTP 401, 403, and 404 responses with specific messages
- [ ] Improve the generic connection error fallback message
- [ ] Maintain the existing `ECONNREFUSED` message unchanged

### Nice to Have

- [ ] Include dynamic context in messages (e.g., hostname in `ENOTFOUND`, path in 404)

### Out of Scope

- Custom error classes or changes to the `ApiResponse` type
- Changes to tool handlers in `src/tools/*.ts`
- Retry logic or automatic recovery
- `EADDRINUSE` detection (not relevant for an HTTP client)
- Logging infrastructure changes

---

## Design Decisions

### Error message audience

**Options considered:**

1. Write for the LLM agent — explicit "ask the user to..." framing, numbered steps
2. Write for a human — concise, direct imperatives ("Make sure...", "Check that...")

**Decision:** Option 2 (human-readable). The LLM is capable of interpreting concise messages and relaying them appropriately. Matches the style of the existing `ECONNREFUSED` message.

### Error detection strategy

**Options considered:**

1. Check `err.code` / `cause?.code` — precise, idiomatic Node.js
2. String match on `err.message` / `err.name` — looser, more fragile (reference project's approach)

**Decision:** Option 1. Already proven in the codebase for `ECONNREFUSED`. Node's `fetch` wraps system errors, so checking `.cause?.code` catches the real error. No reason to adopt string matching.

### Error format

**Options considered:**

1. Plain strings in `ApiResponse` (current approach)
2. Structured object (e.g., `{ message, hint }`)

**Decision:** Option 1. All 15 tool handlers dump `result.error` into a text response. Adding structure would require changing the `ApiResponse` type and every handler for no practical benefit.

### HTTP 405 handling

**Options considered:**

1. No special handling — falls through to generic message
2. Specific message suggesting a bug or version mismatch

**Decision:** Option 1. A 405 would indicate a bug in our code, not a user-fixable problem. No value in a special message.

---

## Acceptance Criteria

- [ ] `ECONNREFUSED` returns: "Could not connect to Obsidian. Make sure Obsidian is running and the Local REST API plugin is enabled."
- [ ] `EACCES` returns: "Permission denied when connecting to Obsidian. Check that the configured port (default 27123) is accessible."
- [ ] `ETIMEDOUT` returns: "Connection to Obsidian timed out. Check that the host and port settings are correct and that Obsidian is responsive."
- [ ] `ENOTFOUND` returns: "Could not resolve host '{host}'. Check the OBSIDIAN_API_HOST setting."
- [ ] Unknown system errors return: "Could not connect to Obsidian: {err.message}"
- [ ] HTTP 401 returns: "Authentication failed. Check that OBSIDIAN_API_KEY matches the key in Obsidian's Local REST API plugin settings."
- [ ] HTTP 403 returns: "Request forbidden by Obsidian. Check the Local REST API plugin's access settings."
- [ ] HTTP 404 returns: "Not found: {path}. Check that the file or path exists in your vault."
- [ ] Other HTTP errors return: "Obsidian API error ({status}): {message}" (unchanged)
- [ ] No changes to tool handler files
- [ ] No changes to `ApiResponse` type structure

---

## Files to Create/Modify

```
src/api-client.ts  # Add system error branches in fetch catch block (~line 78-94);
                   # Add HTTP status branches in response handling (~line 120-131)
```

---

## Build Log

_Filled in during `/build` phase_

| Date | Task | Files | Notes |
| ---- | ---- | ----- | ----- |
|      |      |       |       |

---

## Completion

**Completed:** _TBD_
**Final Status:** _TBD_

**Summary:** _TBD_

**Deviations from Plan:** _TBD_
