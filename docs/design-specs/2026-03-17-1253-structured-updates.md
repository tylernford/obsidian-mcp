# Structured Updates

**Created:** 2026-03-17
**Implementation Plan:** TBD
**Parent Spec:** [Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)

---

## Overview

**What:** Implement the final 3 MCP tools — `vault_update`, `active_file_update`, and `periodic_update` — which perform structured content targeting (heading, block reference, and frontmatter) using the `markdown-patch` library and Obsidian's atomic `Vault.process()` API.

**Why:** These are the last 3 of 15 tools needed to reach full feature parity with the legacy MCP server. They were classified as "Hard" in the root design doc because they require reimplementing the content targeting logic that the Local REST API plugin previously handled.

**Type:** Feature

---

## Architecture

### Data Flow

```
MCP Tool Handler
  → Resolve TFile (tool-specific)
  → app.vault.process(file, (data) => {
      return applyPatch(data, instruction);  // markdown-patch
    })
  → Return success/error response
```

`Vault.process()` provides atomic read-modify-write semantics. The `markdown-patch` library handles all content targeting (heading hierarchy, block references, frontmatter fields) inside the callback.

### File Resolution by Tool

| Tool                 | Resolution                                                                     |
| -------------------- | ------------------------------------------------------------------------------ |
| `vault_update`       | `normalizePath(filename)` → `vault.getAbstractFileByPath()`                    |
| `active_file_update` | `workspace.getActiveFile()`                                                    |
| `periodic_update`    | Periodic Notes plugin API → `vault.getAbstractFileByPath()`, create if missing |

---

## Requirements

### Must Have

- [ ] `vault_update` tool with identical name, Zod schema, and response format as legacy
- [ ] `active_file_update` tool with identical name, Zod schema, and response format as legacy
- [ ] `periodic_update` tool with identical name, Zod schema, and response format as legacy
- [ ] All three target types work: heading (with `::` hierarchy), block reference, frontmatter
- [ ] All three operations work: append, prepend, replace
- [ ] `createIfMissing` parameter creates the target if it doesn't exist
- [ ] `periodic_update` creates the periodic note file if it doesn't exist before applying the patch
- [ ] Atomic writes via `Vault.process()`
- [ ] `markdown-patch` added as a bundled dependency
- [ ] `PatchFailed` errors returned as `{ isError: true }` with the failure reason
- [ ] User-provided paths normalized via `normalizePath()`
- [ ] Unit tests following existing tool test patterns
- [ ] `Vault.process()` added to obsidian mock

### Nice to Have

- [ ] Shared helper extracted to avoid duplicating patch instruction construction across 3 tools

### Out of Scope

- `applyIfContentPreexists` parameter (REST API v3 feature, never exposed in legacy MCP tools)
- `trimTargetWhitespace` parameter (same)
- JSON content type / table row insertion (same)
- Custom heading delimiter (legacy hardcodes `::`)
- New tools or changes to existing tools

---

## Design Decisions

### 1. Use `markdown-patch` library for content targeting

**Options considered:**

1. **Use `markdown-patch`** — The same library the Local REST API plugin v3 uses. Battle-tested, handles heading hierarchy, block references, and frontmatter. ~15KB bundled.
2. **Reimplement targeting logic** — Use `metadataCache.getFileCache()` for headings, manual parsing for blocks and frontmatter. Full control but significant effort and edge-case risk.

**Decision:** Option 1. The library is proven, the REST API plugin already validates it works, and it keeps the implementation focused on wiring rather than parsing. It bundles cleanly via esbuild since it's a pure JS library.

### 2. `markdown-patch` for all three target types (including frontmatter)

**Options considered:**

1. **`markdown-patch` for everything** — Single code path for heading, block, and frontmatter targeting.
2. **`processFrontMatter()` for frontmatter, `markdown-patch` for heading/block** — Uses Obsidian's native API for frontmatter but splits the code path.

**Decision:** Option 1. Consistency outweighs the marginal benefit of using the native API. One code path means one set of error handling, one mock strategy in tests, and predictable behavior across all target types.

### 3. Shared helper for patch instruction construction

Extract a `buildPatchInstruction()` helper into `plugin/src/tools/update-utils.ts`. All three tools resolve their `TFile` differently but construct the patch instruction identically. This avoids tripling the same mapping logic.

```typescript
// plugin/src/tools/update-utils.ts
interface UpdateParams {
  operation: "append" | "prepend" | "replace";
  targetType: "heading" | "block" | "frontmatter";
  target: string;
  content: string;
  createIfMissing?: boolean;
}

function buildPatchInstruction(params: UpdateParams): PatchInstruction {
  return {
    operation: params.operation,
    targetType: params.targetType,
    target:
      params.targetType === "heading"
        ? params.target.split("::")
        : params.target,
    contentType: "text/markdown",
    content: params.content,
    createTargetIfMissing: params.createIfMissing ?? false,
    applyIfContentPreexists: false,
    trimTargetWhitespace: false,
  };
}
```

### 4. `periodic_update` create-then-patch flow

Preserves legacy behavior where a missing periodic note is created before the patch is applied:

1. Resolve periodic note path via Periodic Notes plugin API
2. `vault.getAbstractFileByPath(path)`
3. If `null`: `vault.create(path, "")` → re-resolve file
4. `vault.process(file, applyPatch(...))`

This matches the legacy POST-then-retry-PATCH pattern.

### 5. Mock `markdown-patch` in tests

Tests mock `markdown-patch` via `vi.mock("markdown-patch")` rather than testing the library's parsing. We test our wiring: correct parameters passed to `applyPatch`, correct error handling of `PatchFailed`, correct file resolution per tool. The library's own tests validate its parsing logic.

---

## Tool Schemas (Legacy Parity)

### `vault_update`

```typescript
{
  filename: z.string(),           // Path relative to vault root
  operation: z.enum(["append", "prepend", "replace"]),
  targetType: z.enum(["heading", "block", "frontmatter"]),
  target: z.string(),             // Heading path (::), block ID, or field name
  content: z.string(),            // Content to insert/replace
  createIfMissing: z.boolean().optional().default(false),
}
```

### `active_file_update`

```typescript
{
  operation: z.enum(["append", "prepend", "replace"]),
  targetType: z.enum(["heading", "block", "frontmatter"]),
  target: z.string(),
  content: z.string(),
  createIfMissing: z.boolean().optional().default(false),
}
```

### `periodic_update`

```typescript
{
  period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  operation: z.enum(["append", "prepend", "replace"]),
  targetType: z.enum(["heading", "block", "frontmatter"]),
  target: z.string(),
  content: z.string(),
  createIfMissing: z.boolean().optional().default(false),
}
```

---

## Acceptance Criteria

- [ ] `vault_update` appends content after a heading target
- [ ] `vault_update` prepends content before a block target
- [ ] `vault_update` replaces a frontmatter field value
- [ ] `vault_update` with nested heading path (`::` delimiter) targets correctly
- [ ] `vault_update` with `createIfMissing: true` creates a missing heading
- [ ] `vault_update` returns `isError: true` when file not found
- [ ] `vault_update` returns `isError: true` with reason when `PatchFailed` thrown
- [ ] `active_file_update` applies patch to the active file
- [ ] `active_file_update` returns `isError: true` when no file is active
- [ ] `periodic_update` applies patch to existing periodic note
- [ ] `periodic_update` creates periodic note then patches when note is missing
- [ ] `periodic_update` returns `isError: true` when Periodic Notes plugin unavailable
- [ ] All paths normalized via `normalizePath()` before API calls
- [ ] All writes use `Vault.process()` for atomicity
- [ ] `markdown-patch` is bundled (not externalized) in esbuild output
- [ ] Unit tests pass for all three tools covering happy paths and error cases
- [ ] Existing tests remain green

---

## Files to Create/Modify

```
plugin/package.json                          # Add markdown-patch dependency
plugin/src/tools/update-utils.ts             # NEW — shared buildPatchInstruction() helper
plugin/src/tools/vault.ts                    # Add vault_update tool registration
plugin/src/tools/active-file.ts              # Add active_file_update tool registration
plugin/src/tools/periodic.ts                 # Add periodic_update tool registration
plugin/src/__mocks__/obsidian.ts             # Add Vault.process() to mock
plugin/src/tools/vault.test.ts               # Add vault_update tests
plugin/src/tools/active-file.test.ts         # Add active_file_update tests
plugin/src/tools/periodic.test.ts            # Add periodic_update tests
```

---

## Test Plan

### Mock Strategy

- **`markdown-patch`**: Mocked via `vi.mock("markdown-patch")`. `applyPatch` returns modified content on success, throws `PatchFailed` on failure. Tests verify correct arguments passed.
- **`Vault.process()`**: Added to obsidian mock. Calls the callback with mock file content and returns the result.

### Test Cases per Tool

**`vault_update`** (extend `vault.test.ts`):

- Success: each targetType (heading, block, frontmatter)
- Heading `::` splitting verified in `applyPatch` call
- `createIfMissing` passed through correctly
- File not found → `isError: true`
- `PatchFailed` → `isError: true` with reason

**`active_file_update`** (extend `active-file.test.ts`):

- Success: patch applied to active file
- No active file → `isError: true`
- `PatchFailed` → `isError: true` with reason

**`periodic_update`** (extend `periodic.test.ts`):

- Success: patch applied to existing periodic note
- Missing note: file created then patched
- Periodic Notes plugin unavailable → `isError: true`
- `PatchFailed` → `isError: true` with reason

---

## References

- [Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md) — root design doc, "Hard" tool tier
- [markdown-patch](https://github.com/coddingtonbear/markdown-patch) — content targeting library (v0.4.3)
- [Local REST API Plugin](../../reference/obsidian-local-rest-api/src/requestHandler.ts) — v3 PATCH handler using markdown-patch (lines 575-661)
- [Obsidian API: Vault.process()](../../reference/obsidianmd/obsidian-api/obsidian.d.ts) — atomic read-modify-write
