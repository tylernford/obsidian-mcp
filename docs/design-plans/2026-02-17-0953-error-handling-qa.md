# Error Handling QA Updates

**Created:** 2026-02-17
**Status:** Design
**Implementation Plan Doc:** docs/implementation-plans/2026-02-17-1016-error-handling-qa.md

---

## Overview

**What:** QA improvements to the recently shipped actionable error messages — adding missing error cases, preserving server-provided messages, including connection URLs, and extracting error handling into a dedicated module.

**Why:** The initial implementation (Feb 17) made good structural choices (inline switch, `||` pattern) but cut too aggressively. Users will encounter ECONNRESET and 5xx errors in normal usage, and discarding the server message from 401/403/404 responses makes debugging harder. Network error messages that omit the target URL are unhelpful when non-default hosts/ports are configured.

**Type:** Enhancement

---

## Requirements

### Must Have

- [ ] Add ECONNRESET handling with actionable guidance
- [ ] Add 5xx handling (single `status >= 500` check) with actionable guidance
- [ ] Include `baseUrl` in network error messages for ECONNREFUSED, EACCES, ETIMEDOUT, ECONNRESET, and the default fallback
- [ ] Preserve server-provided message alongside guidance for 401, 403, 404 errors
- [ ] Extract error handling into `src/errors.ts` as standalone exported functions
- [ ] Simplify `request()` in `api-client.ts` to delegate to the new functions

### Nice to Have

- (none identified)

### Out of Scope

- Changes to tool files (`src/tools/*.ts`) — they pass through error strings as-is
- Changes to `ApiResponse` type or `index.ts`
- New helper abstractions or error classes
- Changes to ENOTFOUND message format (hostname-only is correct for DNS errors)
- Changes to malformed JSON handling (already implemented)

---

## Design Decisions

### Extract error handling to `src/errors.ts`

**Options considered:**

1. Keep inline in `request()` — simplest, no new files, but the method would be ~120+ lines with error handling dominating the happy path
2. Private methods on `ObsidianClient` — keeps everything in `api-client.ts`, but the functions don't actually need the class (only `baseUrl` as a string)
3. Separate `src/errors.ts` module with exported functions — clean separation of concerns, pure functions with explicit inputs

**Decision:** Option 3. Error formatting is a different concern from making HTTP requests. The functions don't need class access — they take `baseUrl` as a parameter. This separates change reasons: request plumbing changes in `api-client.ts`, error message changes in `errors.ts`.

### 5xx granularity

**Options considered:**

1. Individual cases for 500, 502, 503, etc.
2. Single `status >= 500` check

**Decision:** Option 2. The guidance is the same regardless of specific 5xx code ("plugin-side issue, try restarting"), and the server message is preserved for specifics.

### ENOTFOUND message format

**Options considered:**

1. Keep current format with hostname only
2. Add full `baseUrl` for consistency with other network errors

**Decision:** Option 1. ENOTFOUND is specifically a DNS resolution failure — the hostname is the relevant detail. The port is irrelevant to DNS.

---

## Acceptance Criteria

- [ ] ECONNRESET produces: `Connection to Obsidian at ${baseUrl} was reset. This usually means Obsidian restarted mid-request — try again.`
- [ ] 5xx produces: `Obsidian REST API plugin returned an internal error. This is usually a plugin-side issue — try restarting Obsidian. (HTTP ${status}: ${message})`
- [ ] ECONNREFUSED, EACCES, ETIMEDOUT, ECONNRESET messages include `baseUrl`
- [ ] Default connection error fallback includes `baseUrl`
- [ ] 401 produces: `Authentication failed. Check that OBSIDIAN_API_KEY matches the key in Obsidian's Local REST API plugin settings. (HTTP 401: ${message})`
- [ ] 403 produces: `Request forbidden by Obsidian. Check the Local REST API plugin's access settings. (HTTP 403: ${message})`
- [ ] 404 produces: `Not found: ${path}. Check that the file or path exists in your vault. (HTTP 404: ${message})`
- [ ] Default HTTP error produces: `Obsidian API error (HTTP ${status}: ${message})`
- [ ] ENOTFOUND message is unchanged (hostname only, no `baseUrl`)
- [ ] `src/errors.ts` exports `handleConnectionError` and `handleHttpError` as standalone functions
- [ ] `request()` in `api-client.ts` calls the extracted functions instead of inline switch blocks
- [ ] All existing tests pass
- [ ] Error message extraction logic (parsing `data` for server message) lives in `errors.ts`

---

## Files to Create/Modify

```
src/errors.ts       # new — handleConnectionError() and handleHttpError()
src/api-client.ts   # modify — remove inline error switches, import from errors.ts
```

---

## Error Message Reference

### Connection Errors (`handleConnectionError`)

| Code         | Message                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| ECONNREFUSED | `Could not connect to Obsidian at ${baseUrl}. Make sure Obsidian is running and the Local REST API plugin is enabled.`               |
| EACCES       | `Permission denied when connecting to Obsidian at ${baseUrl}. Check that the configured port is accessible.`                         |
| ETIMEDOUT    | `Connection to Obsidian at ${baseUrl} timed out. Check that the host and port settings are correct and that Obsidian is responsive.` |
| ECONNRESET   | `Connection to Obsidian at ${baseUrl} was reset. This usually means Obsidian restarted mid-request — try again.`                     |
| ENOTFOUND    | `Could not resolve host '${hostname}'. Check the OBSIDIAN_API_HOST setting.`                                                         |
| default      | `Could not connect to Obsidian at ${baseUrl}: ${err.message}`                                                                        |

### HTTP Errors (`handleHttpError`)

| Status  | Message                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401     | `Authentication failed. Check that OBSIDIAN_API_KEY matches the key in Obsidian's Local REST API plugin settings. (HTTP 401: ${message})`          |
| 403     | `Request forbidden by Obsidian. Check the Local REST API plugin's access settings. (HTTP 403: ${message})`                                         |
| 404     | `Not found: ${path}. Check that the file or path exists in your vault. (HTTP 404: ${message})`                                                     |
| >= 500  | `Obsidian REST API plugin returned an internal error. This is usually a plugin-side issue — try restarting Obsidian. (HTTP ${status}: ${message})` |
| default | `Obsidian API error (HTTP ${status}: ${message})`                                                                                                  |

### Function Signatures

```typescript
handleConnectionError(err: NodeJS.ErrnoException, baseUrl: string, url: URL):
  { ok: false; status: number; error: string }

handleHttpError(status: number, data: unknown, path: string):
  { ok: false; status: number; error: string }
```

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                  | Notes                                                                                                    |
| ---------- | ------ | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-02-17 | Task 1 | src/errors.ts (create) | No deviations. Used if/else for 5xx (>= 500 check) instead of switch since switch can't do range checks. |

---

## Completion

**Completed:** TBD
**Final Status:** TBD

**Summary:** TBD

**Deviations from Plan:** TBD
