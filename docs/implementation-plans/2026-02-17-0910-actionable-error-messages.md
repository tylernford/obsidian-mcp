# Implementation Plan: Actionable Error Messages

**Design Spec:** docs/design-plans/2026-02-17-0849-actionable-error-messages.md
**Created:** 2026-02-17

---

## Summary

Add actionable error messages to `src/api-client.ts` for common system errors (`EACCES`, `ETIMEDOUT`, `ENOTFOUND`) and HTTP errors (401, 403, 404). Refactor error handling to use `switch` statements for cleaner dispatch.

---

## Codebase Verification

- [x] `ECONNREFUSED` handling exists at lines 81-88 using `err.code || cause?.code` pattern — Verified
- [x] Generic connection error fallback at lines 89-93 — Verified
- [x] HTTP error handling at lines 120-131 with generic message — Verified
- [x] `ApiResponse` type uses plain string `error` field — Verified
- [x] `path` parameter available in `request()` for 404 messages — Verified
- [x] `url` (URL object) available in catch block for `ENOTFOUND` hostname — Verified

**Patterns to leverage:**

- Existing `err.code || cause?.code` pattern for resolving the effective error code
- `url.hostname` for dynamic context in `ENOTFOUND` message

**Discrepancies found:**

- None. Design spec line references match the current codebase.

---

## Tasks

### Task 1: Add actionable messages for system-level connection errors

**Description:** Refactor the `catch` block in `request()` to use a `switch` on the resolved error code. Add cases for `EACCES`, `ETIMEDOUT`, and `ENOTFOUND` with actionable messages. Keep `ECONNREFUSED` message unchanged. Update the generic fallback from `"Connection error: {message}"` to `"Could not connect to Obsidian: {message}"`.

**Files:**

- `src/api-client.ts` — modify catch block (lines 78-94)

**Code example:**

```typescript
} catch (error) {
  const err = error as NodeJS.ErrnoException;
  const cause = err.cause as NodeJS.ErrnoException | undefined;
  const code = err.code || cause?.code;

  switch (code) {
    case "ECONNREFUSED":
      return {
        ok: false,
        status: 0,
        error:
          "Could not connect to Obsidian. Make sure Obsidian is running and the Local REST API plugin is enabled.",
      };
    case "EACCES":
      return {
        ok: false,
        status: 0,
        error:
          "Permission denied when connecting to Obsidian. Check that the configured port (default 27123) is accessible.",
      };
    case "ETIMEDOUT":
      return {
        ok: false,
        status: 0,
        error:
          "Connection to Obsidian timed out. Check that the host and port settings are correct and that Obsidian is responsive.",
      };
    case "ENOTFOUND":
      return {
        ok: false,
        status: 0,
        error: `Could not resolve host '${url.hostname}'. Check the OBSIDIAN_API_HOST setting.`,
      };
    default:
      return {
        ok: false,
        status: 0,
        error: `Could not connect to Obsidian: ${err.message}`,
      };
  }
}
```

**Done when:**

- `ECONNREFUSED` returns its existing message (unchanged)
- `EACCES`, `ETIMEDOUT`, `ENOTFOUND` return their specific actionable messages
- `ENOTFOUND` includes the hostname dynamically
- Unknown system errors return `"Could not connect to Obsidian: {message}"`

**Commit:** "Add actionable messages for system-level connection errors"

---

### Task 2: Add actionable messages for HTTP error responses

**Description:** In the `!response.ok` block, add a `switch` on `response.status` for 401, 403, and 404 before the existing generic fallback. Include the request `path` in the 404 message. Leave the generic fallback for other status codes unchanged.

**Files:**

- `src/api-client.ts` — modify HTTP error block (lines 120-131)

**Code example:**

```typescript
if (!response.ok) {
  switch (response.status) {
    case 401:
      return {
        ok: false,
        status: 401,
        error:
          "Authentication failed. Check that OBSIDIAN_API_KEY matches the key in Obsidian's Local REST API plugin settings.",
      };
    case 403:
      return {
        ok: false,
        status: 403,
        error:
          "Request forbidden by Obsidian. Check the Local REST API plugin's access settings.",
      };
    case 404:
      return {
        ok: false,
        status: 404,
        error: `Not found: ${path}. Check that the file or path exists in your vault.`,
      };
  }

  const dataObj = data as Record<string, unknown> | null;
  const message =
    (dataObj && typeof dataObj === "object" && "message" in dataObj
      ? dataObj.message
      : null) || (typeof data === "string" ? data : JSON.stringify(data));
  return {
    ok: false,
    status: response.status,
    error: `Obsidian API error (${response.status}): ${message}`,
  };
}
```

**Done when:**

- HTTP 401 returns the authentication failed message
- HTTP 403 returns the forbidden message
- HTTP 404 returns the not found message with the request path
- Other HTTP errors return the existing generic message (unchanged)

**Commit:** "Add actionable messages for HTTP error responses"

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

## Notes

- The `switch` refactor for system errors changes the `ECONNREFUSED` detection from `err.code === "ECONNREFUSED" || cause?.code === "ECONNREFUSED"` to `const code = err.code || cause?.code` + `switch`. This is functionally equivalent because the original only ever checked one code at a time, and `err.code || cause?.code` resolves the same way.
