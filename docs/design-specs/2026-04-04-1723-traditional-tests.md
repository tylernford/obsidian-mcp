# Traditional Tests

**Created:** 2026-04-04
**Parent spec:** [Testing Refactor](2026-04-03-1550-testing-refactor.md)
**Implementation Plan:** `docs/implementation-plans/2026-04-04-2144-traditional-tests.md`

---

## Overview

**What:** A from-scratch traditional test suite covering the four modules with meaningful testable logic: `update-utils.ts`, `search.ts`, `server.ts`, and `metadata.ts`.

**Why:** The existing tests were written without maintainer oversight and are suspected to be largely mirror tests. This child spec defines exactly what to test, how to mock, and what patterns to follow — so every test justifies its existence by catching something that would otherwise go undetected.

**Type:** Refactor

---

## Testing Philosophy

Inherited from the root spec:

- Every test must catch something that would otherwise go undetected
- No mirror tests — tests that re-implement production logic to verify it produces the same output
- Focus on edge cases, failure modes, and boundary conditions
- Test logic we wrote, not library or Obsidian API behavior

---

## Modules Under Test

### Why These Four

Each module was evaluated against two criteria: (1) does it contain meaningful logic (branching, parsing, transformation)? and (2) what is the risk if it breaks?

| Module            | Lines | Logic density                                                              | Risk                     | Verdict   |
| ----------------- | ----- | -------------------------------------------------------------------------- | ------------------------ | --------- |
| `update-utils.ts` | 84    | High — JSON parse with fallback, `::` splitting, error type matching       | Content corruption       | Must test |
| `search.ts`       | 217   | High — position offset math, match categorization, Dataview transformation | Wrong search results     | Must test |
| `server.ts`       | 119   | Medium — auth, routing with format distinction, lifecycle                  | Auth bypass, broken API  | Good ROI  |
| `metadata.ts`     | 185   | Medium — tag normalization, dedup, JSON parse, position stripping          | Data loss in frontmatter | Good ROI  |

### Why Not the Others

| Module           | Lines | Reason for exclusion                                             |
| ---------------- | ----- | ---------------------------------------------------------------- |
| `crypto.ts`      | 5     | Single line — `randomBytes(32).toString("hex")`                  |
| `settings.ts`    | 203   | UI rendering with trivial port validation                        |
| `commands.ts`    | 61    | Thin wrapper — maps command registry, calls `executeCommandById` |
| `navigation.ts`  | 29    | Single `openLinkText` call                                       |
| `main.ts`        | 105   | Lifecycle glue — delegation and wiring                           |
| `active-file.ts` | 96    | Guards + delegation to `update-utils`                            |
| `periodic.ts`    | 210   | Guards + delegation to `update-utils`                            |
| `vault.ts`       | 227   | Guards + delegation to `update-utils`                            |

The excluded modules are thin wrappers around Obsidian APIs or delegation to modules we do test. Traditional tests for them would either mirror production logic or test Obsidian behavior — both explicitly banned. These modules are better served by live tool validation against a real Obsidian instance.

---

## Mock Strategy

### Guiding Principle

Mock minimally. Obsidian's internals are unpublished — any mock is "what we think Obsidian does based on type signatures and observed behavior." The more behavior we bake in, the more we're guessing and the more likely the mock drifts from reality. Live tool validation exists to catch where our assumptions are wrong.

### Mock Boundary

| Dependency             | Approach                                                                                      | Reasoning                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Obsidian               | Minimal stubs in `__mocks__/obsidian.ts` + per-test `vi.fn()`                                 | Can't run in tests, side effects, behavioral mock would be fragile guesswork |
| `markdown-patch`       | Mock `applyPatch`/`PatchFailed` in `applyUpdate` tests; test `buildPatchInstruction` directly | Pure function testable in isolation; mocking keeps boundary clean            |
| `McpServer`            | Mock to capture registered handlers, call handlers directly                                   | Testing our handler logic, not the MCP SDK's registration machinery          |
| HTTP (for `server.ts`) | Real integration — start server, use `fetch`                                                  | The module is the integration point; localhost is fast and deterministic     |

### `__mocks__/obsidian.ts` — Rebuilt Minimal

The mock file provides only what the four test files need:

| Export                | Type                    | Needed by                            | Notes                                                                                                                                                                                                    |
| --------------------- | ----------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TFile`               | Real class              | `update-utils`, `search`, `metadata` | Must be a real class, not a type or plain object. `instanceof TFile` checks are in every file-resolving handler — if the mock exports anything other than a class, those checks silently return `false`. |
| `normalizePath`       | Real-ish implementation | `metadata`                           | Pure string normalizer with known behavior. Keep the existing implementation (~14 lines).                                                                                                                |
| `prepareSimpleSearch` | Stub                    | `search`                             | Tests provide their own mock via `vi.fn()`                                                                                                                                                               |

Everything else from the current 333-line mock (`Plugin`, `Notice`, `Modal`, `Workspace`, `Setting`, UI components, `SecretStorage`, etc.) is dropped.

### Callback Mock Pattern

Obsidian APIs like `processFrontMatter` accept a callback that mutates an object in-place. Mocks for these must invoke the callback with a controlled object, not just record that the method was called:

```typescript
const frontmatter = { tags: ["existing"] };
mockProcessFrontMatter.mockImplementation((file, cb) => cb(frontmatter));
// ... call the handler ...
expect(frontmatter.tags).toEqual(["existing", "newtag"]);
```

This applies to all `tags_manage` add/remove tests and `frontmatter_manage` set tests.

---

## Test Plans

### `update-utils.test.ts`

Two exports: `buildPatchInstruction` (pure function, tested directly) and `applyUpdate` (async, mocks `markdown-patch`).

#### `buildPatchInstruction`

| Test                                                    | What it verifies                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Frontmatter: valid JSON content                         | `JSON.parse` succeeds, `content` is parsed value, `contentType` is `json` |
| Frontmatter: invalid JSON content                       | Falls back to raw string, no throw                                        |
| Frontmatter: `createIfMissing` defaults to false        | Omitting param produces `createTargetIfMissing: false`                    |
| Frontmatter: `createIfMissing` passes through when true | Explicit `true` propagates                                                |
| Heading: single level                                   | `target` becomes single-element array `["Heading"]`                       |
| Heading: multi-level `::` split                         | `"Parent::Child::Grand"` becomes `["Parent", "Child", "Grand"]`           |
| Heading: empty string target                            | `"".split("::")` produces `[""]`                                          |
| Heading: target with trailing `::`                      | `"Parent::"` produces `["Parent", ""]`                                    |
| Block: target passes through as string                  | Not split, not parsed                                                     |
| Block: all fields set correctly                         | `contentType` is `text`, `trimTargetWhitespace` is `false`, etc.          |

#### `applyUpdate`

| Test                | What it verifies                                                                   |
| ------------------- | ---------------------------------------------------------------------------------- |
| Success path        | Calls `app.vault.process` with file and patch function, returns `"Updated {path}"` |
| `PatchFailed` error | Catches `PatchFailed`, returns `isError: true` with `e.reason`                     |
| Unknown error       | Non-`PatchFailed` exception re-throws (not swallowed)                              |

---

### `search.test.ts`

Handler captured via mocked `McpServer`. Tests call handler with `type: "simple"` or `type: "dataview"`.

#### `simpleSearch`

The core logic is the position offset trick: prepending `filename + "\n\n"` to content, searching the combined string, then categorizing matches by where they fall relative to the offset.

| Test                                                       | What it verifies                                                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Filename-only match                                        | Match falls before `positionOffset`, source is `"filename"`, end clamped to `basename.length`                                |
| Filename match at exact boundary (`end == positionOffset`) | Caught by filename branch (`end <= positionOffset`), not skipped                                                             |
| Content-only match                                         | Match falls after `positionOffset`, positions adjusted by offset, context sliced correctly                                   |
| Boundary-spanning match (skipped)                          | `start < positionOffset`, `end > positionOffset` — silently excluded from results                                            |
| All matches filtered out                                   | Every match is boundary-spanning — `matches` array empty, file excluded from results (different code path from "no matches") |
| No matches                                                 | `searchFn` returns null — file excluded from results                                                                         |
| Context clamping                                           | Match near start/end of file — context doesn't exceed `content.length` or go below `0`                                       |
| Multiple files, score sorting                              | Results sorted by `score` ascending                                                                                          |
| Custom `contextLength`                                     | Context window respects the parameter                                                                                        |

#### `dataviewSearch`

| Test                   | What it verifies                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin not installed   | `getPlugin("dataview")` returns null — error with "not installed or enabled"                                                                                              |
| Query throws           | `tryQuery` rejects — error message surfaced                                                                                                                               |
| Non-TABLE query        | `result.type !== "table"` — error                                                                                                                                         |
| TABLE WITHOUT ID       | Headers don't include ID column name — error                                                                                                                              |
| Successful TABLE query | Rows transformed: ID column value (mock as `{ path: string }` matching Dataview's file link representation) extracted as `filename`, remaining columns as `result` object |
| Multi-column result    | Multiple non-ID columns all appear in result object                                                                                                                       |

---

### `server.test.ts`

Integration tests: real `HttpServer` instance, real `fetch` calls. Each test group gets its own server on a random available port. `afterEach` calls `stop()` to prevent hanging processes. `createMcpServer` is a mock factory.

#### Authentication

| Test                    | What it verifies                 |
| ----------------------- | -------------------------------- |
| No Authorization header | 401, `{"error": "Unauthorized"}` |
| Wrong token             | 401, same response               |
| Valid Bearer token      | Request proceeds                 |

#### Routing

| Test                              | What it verifies                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/mcp`                       | Request handled                                                                                                                                                              |
| GET `/mcp`                        | 405, JSON-RPC error: `{"jsonrpc": "2.0", "error": {"code": -32000, "message": "Method not allowed."}, "id": null}`                                                           |
| DELETE `/mcp`                     | 405, same JSON-RPC error                                                                                                                                                     |
| Other method on `/mcp` (e.g. PUT) | 405, generic JSON: `{"error": "Method Not Allowed"}` (different body format — GET/DELETE are MCP-spec methods that get a JSON-RPC response; other methods get a plain error) |
| Unknown path                      | 404, `{"error": "Not Found"}`                                                                                                                                                |

#### Request handling

| Test                     | What it verifies                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request processing error | 400, `{"error": "Invalid request body"}` — triggered via malformed JSON as simplest path into the catch block (note: same catch handles `connect()` and `handleRequest()` failures) |
| Valid MCP request        | `createMcpServer` called, transport connected, response returned                                                                                                                    |

#### Lifecycle

| Test                             | What it verifies                                    |
| -------------------------------- | --------------------------------------------------- |
| Start then stop                  | Server starts, accepts requests, stops cleanly      |
| Stop destroys active connections | Connections in the `Set` are destroyed on stop      |
| Stop with no server              | `stop()` when server is null resolves without error |

---

### `metadata.test.ts`

Handler captured via mocked `McpServer`. Tests call handlers directly.

#### `tags_manage`

| Test                                  | What it verifies                                          |
| ------------------------------------- | --------------------------------------------------------- |
| List: returns tags without `#` prefix | Cache has `["#foo", "#bar"]` — returns `["foo", "bar"]`   |
| List: no tags                         | Empty frontmatter — returns `[]`                          |
| List: tags not an array               | Frontmatter `tags` is a string or null — returns `[]`     |
| Add: deduplicates                     | Adding a tag that already exists — no duplicate           |
| Add: strips `#` from input            | Caller passes `["#newtag"]` — stored as `"newtag"`        |
| Add: appends to existing              | Existing `["a"]`, add `["b"]` — result is `["a", "b"]`    |
| Remove: filters matching tags         | Existing `["a", "b"]`, remove `["b"]` — result is `["a"]` |
| Remove: tag not present               | Removing nonexistent tag — no error, list unchanged       |
| Add/Remove: missing tags param        | No tags provided — error "Tags array is required"         |
| File not found                        | Invalid filename — error                                  |

#### `frontmatter_manage`

| Test                                | What it verifies                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Read: returns frontmatter           | Cache has frontmatter — returned as JSON                                                                                                |
| Read: strips `position` field       | Obsidian's internal `position` metadata deleted before returning                                                                        |
| Read: empty frontmatter             | No cache — returns `{}`                                                                                                                 |
| Set: JSON string parsed             | Value `'[1,2,3]'` — stored as array                                                                                                     |
| Set: non-JSON string kept as string | Value `'hello world'` — stored as string                                                                                                |
| Set: no value provided              | `value` is `undefined` — key set to `undefined` (documents current behavior; code guards against missing `key` but not missing `value`) |
| Set: missing key                    | No `key` for set action — error "Key is required"                                                                                       |
| File not found                      | Invalid filename — error                                                                                                                |

---

## Design Decisions

### Decision 1: Delete all existing tests and mock, rebuild from scratch

**Options considered:**

1. Audit existing tests, keep useful ones, rewrite the rest
2. Delete everything, start from scratch

**Decision:** Option 2. The existing tests were written without maintainer oversight and are not well understood. The cost of auditing exceeds the cost of rewriting, and a clean slate ensures every test has a clear purpose and the maintainer understands every line.

### Decision 2: Minimal mocks over behavioral mocks

**Options considered:**

1. Behavioral mock — fake Obsidian classes with real-ish behavior (e.g., `Vault` backed by in-memory Map)
2. Minimal stubs — types and constructors for import resolution, `vi.fn()` per test for behavior

**Decision:** Option 2. Obsidian's internals are unpublished. Any behavioral mock is guesswork about how Obsidian actually works. Minimal stubs keep the mock small and obvious. Each test explicitly declares what Obsidian behavior it assumes, making assumptions visible rather than hidden in shared mock state. Live tool validation catches where assumptions are wrong.

### Decision 3: Mock `markdown-patch`, test `buildPatchInstruction` directly

**Options considered:**

1. Let `markdown-patch` run in tests (sociable unit tests)
2. Mock it, test our logic in isolation (solitary unit tests)

**Decision:** Option 2. `buildPatchInstruction` is a pure function — testable directly without the library. `applyUpdate` is tested by mocking `applyPatch` to verify we call it correctly and handle `PatchFailed` vs other errors. The library is fast and deterministic, so option 1 was viable, but mocking keeps the test boundary clean: we test our logic, not the library's.

### Decision 4: Integration tests for `server.ts`

**Options considered:**

1. Unit test individual methods (`authenticate`, `handleRequest`)
2. Integration test with real HTTP server and `fetch`

**Decision:** Option 2. The module is fundamentally about HTTP behavior — auth headers, status codes, response bodies, routing. Unit testing the methods in isolation would miss the integration between them. Localhost HTTP is fast and deterministic, so the usual downsides of integration tests (slow, flaky) don't apply.

### Decision 5: Test file placement — co-located siblings

**Options considered:**

1. Co-located siblings (`foo.test.ts` next to `foo.ts`)
2. Top-level `__tests__` directory
3. Mirrored tree (`tests/` paralleling `src/`)

**Decision:** Option 1. Modern convention, Vitest default, project already uses this pattern. With only four test files, the "clutter" downside doesn't apply.

---

## Requirements

### Must Have

- [ ] All existing test files removed
- [ ] `__mocks__/obsidian.ts` rebuilt with only what the four test files require
- [ ] `update-utils.test.ts` with 13 test cases
- [ ] `search.test.ts` with 15 test cases
- [ ] `server.test.ts` with 12 test cases (integration)
- [ ] `metadata.test.ts` with 17 test cases
- [ ] `docs/testing-guidelines.md` updated to reflect new strategy

### Nice to Have

- [ ] Coverage baseline captured after new tests are written

### Out of Scope

- CI/CD integration
- Coverage thresholds or enforcement
- Vitest config changes
- Tests for excluded modules
- Separate mock file for `markdown-patch` (mocked inline in test file)

---

## Acceptance Criteria

- [ ] All existing `.test.ts` files are deleted from `plugin/src/`
- [ ] Existing `__mocks__/obsidian.ts` is replaced with a minimal version exporting only `TFile` (real class), `normalizePath` (real implementation), and `prepareSimpleSearch` (stub)
- [ ] `update-utils.test.ts` passes — covers `buildPatchInstruction` (3 target type branches, JSON parse fallback, `::` splitting edge cases, `createIfMissing` default) and `applyUpdate` (success, `PatchFailed`, unknown error)
- [ ] `search.test.ts` passes — covers `simpleSearch` (filename match, exact boundary match, content match, boundary-spanning skip, all-filtered-out, no match, context clamping, sorting, custom context length) and `dataviewSearch` (plugin missing, query error, non-TABLE, TABLE WITHOUT ID, successful transform, multi-column)
- [ ] `server.test.ts` passes as integration tests — covers auth (missing, wrong, valid), routing (POST, GET, DELETE, other method, unknown path with correct response format distinctions), request handling (error, valid), lifecycle (start/stop, connection cleanup, null server stop)
- [ ] `metadata.test.ts` passes — covers `tags_manage` (list with/without `#`, empty, non-array, add dedup, add strip `#`, add append, remove, remove missing, missing tags param, file not found) and `frontmatter_manage` (read, read strips position, read empty, set JSON parse, set string fallback, set undefined value, missing key, file not found)
- [ ] `docs/testing-guidelines.md` reflects: testing philosophy, modules under test with rationale, mock strategy (minimal stubs, callback pattern, `TFile` must be real class), mock boundary table, three-layer validation model, integration test pattern for `server.ts`, exclusion rationale
- [ ] All tests run via `pnpm test` with no failures

---

## Suggested Files to Create/Modify

```
plugin/src/tools/update-utils.test.ts  # Create — new test file
plugin/src/tools/search.test.ts        # Create — new test file (replaces deleted version)
plugin/src/tools/metadata.test.ts      # Create — new test file (replaces deleted version)
plugin/src/server.test.ts              # Create — new test file (replaces deleted version)
plugin/src/__mocks__/obsidian.ts       # Modify — rebuild minimal
docs/testing-guidelines.md             # Modify — rewrite for new strategy
```

### Files to Delete

```
plugin/src/crypto.test.ts
plugin/src/main.test.ts
plugin/src/server.test.ts
plugin/src/settings.test.ts
plugin/src/tools/active-file.test.ts
plugin/src/tools/commands.test.ts
plugin/src/tools/metadata.test.ts
plugin/src/tools/navigation.test.ts
plugin/src/tools/periodic.test.ts
plugin/src/tools/search.test.ts
plugin/src/tools/vault.test.ts
```
