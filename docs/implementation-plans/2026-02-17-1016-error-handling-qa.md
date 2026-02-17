# Implementation Plan: Error Handling QA Updates

**Design Doc:** docs/design-plans/2026-02-17-0953-error-handling-qa.md
**Created:** 2026-02-17

---

## Summary

QA improvements to actionable error messages: add missing error cases (ECONNRESET, 5xx), include `baseUrl` in network error messages, preserve server-provided messages in HTTP errors, and extract error handling into a dedicated `src/errors.ts` module.

---

## Codebase Verification

- [x] `src/errors.ts` does not exist — Verified: correct, needs to be created
- [x] `api-client.ts` has inline switch blocks for connection and HTTP errors — Verified: lines 83-117 (connection), lines 145-177 (HTTP)
- [x] ECONNRESET case is missing — Verified: not in current switch
- [x] 5xx handling is missing — Verified: no `>= 500` check exists
- [x] Connection error messages omit `baseUrl` — Verified: messages use generic text
- [x] HTTP error messages (401, 403, 404) omit server message — Verified: hardcoded strings only
- [x] Message extraction logic is inline in `api-client.ts` — Verified: lines 168-172
- [x] No project-level tests exist — Verified: only dependency tests in `node_modules`

**Patterns to leverage:**

- `ApiResponse` type already defines `{ ok: false; status: number; error: string }` — extracted functions return this shape directly
- `this.baseUrl` is a string (`http://${host}:${port}`) — passed as parameter to extracted functions

**Discrepancies found:**

- Design acceptance criterion "All existing tests pass" is a no-op — no project tests exist. Verification is `pnpm build`.
- Current default HTTP error format is `Obsidian API error (${status}): ${message}` — design changes this to `Obsidian API error (HTTP ${status}: ${message})` (adds "HTTP" prefix, moves colon inside parens).

---

## Tasks

### Task 1: Create `src/errors.ts` with `handleConnectionError` and `handleHttpError`

**Description:** Create the new error handling module with both exported functions, implementing all error cases from the design doc's error message reference tables. Include the message extraction logic (parsing `data` for server message) in `handleHttpError`.

**Files:**

- `src/errors.ts` — create

**Code example:**

```typescript
export function handleConnectionError(
  err: NodeJS.ErrnoException,
  baseUrl: string,
  url: URL,
): { ok: false; status: number; error: string } {
  const cause = err.cause as NodeJS.ErrnoException | undefined;
  const code = err.code || cause?.code;

  switch (code) {
    case "ECONNREFUSED":
      return {
        ok: false,
        status: 0,
        error: `Could not connect to Obsidian at ${baseUrl}. Make sure Obsidian is running and the Local REST API plugin is enabled.`,
      };
    // ... EACCES, ETIMEDOUT, ECONNRESET, ENOTFOUND, default
  }
}

export function handleHttpError(
  status: number,
  data: unknown,
  path: string,
): { ok: false; status: number; error: string } {
  // Extract server message from data
  const dataObj = data as Record<string, unknown> | null;
  const message =
    (dataObj && typeof dataObj === "object" && "message" in dataObj
      ? dataObj.message
      : null) || (typeof data === "string" ? data : JSON.stringify(data));

  switch (status) {
    case 401:
      return {
        ok: false,
        status: 401,
        error: `Authentication failed. Check that OBSIDIAN_API_KEY matches the key in Obsidian's Local REST API plugin settings. (HTTP 401: ${message})`,
      };
    // ... 403, 404, >= 500, default
  }
}
```

**Done when:**

- `handleConnectionError` handles ECONNREFUSED, EACCES, ETIMEDOUT, ECONNRESET, ENOTFOUND, and default
- ECONNREFUSED, EACCES, ETIMEDOUT, ECONNRESET, and default include `baseUrl`
- ENOTFOUND uses `url.hostname` only (no `baseUrl`)
- `handleHttpError` handles 401, 403, 404, >= 500, and default
- All HTTP error messages include server message via `(HTTP ${status}: ${message})`
- Message extraction logic lives in `handleHttpError`
- `pnpm build` compiles without errors

**Commit:** `Add error handling module with connection and HTTP error functions`

---

### Task 2: Integrate `errors.ts` into `api-client.ts`

**Description:** Replace the inline switch blocks in `request()` with calls to the extracted functions. Remove the inline message extraction logic.

**Files:**

- `src/api-client.ts` — modify

**Done when:**

- `request()` catch block calls `handleConnectionError(err, this.baseUrl, url)` and returns its result
- `request()` `!response.ok` block calls `handleHttpError(response.status, data, path)` and returns its result
- No inline error message strings remain in `api-client.ts` (except the malformed JSON error, which is out of scope)
- Inline message extraction logic (lines 168-172) is removed
- `pnpm build` compiles without errors

**Commit:** `Simplify request() to delegate error handling to errors module`

---

## Acceptance Criteria

- [x] ECONNRESET produces: `Connection to Obsidian at ${baseUrl} was reset. This usually means Obsidian restarted mid-request — try again.`
- [x] 5xx produces: `Obsidian REST API plugin returned an internal error. This is usually a plugin-side issue — try restarting Obsidian. (HTTP ${status}: ${message})`
- [x] ECONNREFUSED, EACCES, ETIMEDOUT, ECONNRESET messages include `baseUrl`
- [x] Default connection error fallback includes `baseUrl`
- [x] 401 produces: `Authentication failed. Check that OBSIDIAN_API_KEY matches the key in Obsidian's Local REST API plugin settings. (HTTP 401: ${message})`
- [x] 403 produces: `Request forbidden by Obsidian. Check the Local REST API plugin's access settings. (HTTP 403: ${message})`
- [x] 404 produces: `Not found: ${path}. Check that the file or path exists in your vault. (HTTP 404: ${message})`
- [x] Default HTTP error produces: `Obsidian API error (HTTP ${status}: ${message})`
- [x] ENOTFOUND message is unchanged (hostname only, no `baseUrl`)
- [x] `src/errors.ts` exports `handleConnectionError` and `handleHttpError` as standalone functions
- [x] `request()` in `api-client.ts` calls the extracted functions instead of inline switch blocks
- [x] `pnpm build` compiles without errors
- [x] Error message extraction logic (parsing `data` for server message) lives in `errors.ts`

---

## Notes

- The malformed JSON error (line 137 of `api-client.ts`) stays inline — it's part of response parsing, not error categorization, and is explicitly out of scope.
- No project-level tests exist. The original design criterion "All existing tests pass" is satisfied by `pnpm build`.
