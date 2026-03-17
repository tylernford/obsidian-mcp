# Implementation Plan: Structured Updates

**Created:** 2026-03-17
**Type:** Feature
**Overview:** Implement the final 3 MCP tools — `vault_update`, `active_file_update`, and `periodic_update` — which perform structured content targeting (heading, block reference, and frontmatter) using the `markdown-patch` library and Obsidian's atomic `Vault.process()` API.
**Design Spec:** docs/design-specs/2026-03-17-1253-structured-updates.md

---

## Summary

Add the last 3 of 15 tools needed for full feature parity with the legacy MCP server. These "Hard" tools require structured content targeting (heading hierarchy, block references, frontmatter fields) using the `markdown-patch` library, with atomic writes via `Vault.process()`. A shared helper avoids duplicating patch instruction construction across the three tools.

---

## Codebase Verification

- [x] Tool files exist at `plugin/src/tools/{vault,active-file,periodic}.ts` with consistent `register*Tools()` pattern — Verified
- [x] `Vault.process()` not yet in obsidian mock — Verified: must be added
- [x] `markdown-patch` not yet in `package.json` — Verified: must be added
- [x] `markdown-patch` not in esbuild externals — Verified: will be bundled automatically
- [x] Periodic Notes plugin API resolution exists in `periodic.ts` — Verified: uses `obsidian-daily-notes-interface`
- [x] `normalizePath` used consistently in existing tools — Verified
- [x] Registration pattern: `main.ts` calls each `register*Tools()` sequentially — Verified

**Patterns to leverage:**

- `register*Tools(server, app)` export pattern for tool registration
- `vi.mock()` + `registeredTools` map + `callTool()` helper for tests
- `createTFile()` / `createApp()` factories in tests
- `normalizePath()` on all user-provided paths
- Periodic Notes accessor pattern mapping period → `{ isLoaded, getAll, get }`
- Standard response format: `{ content: [{ type: "text", text }], isError?: true }`

**Discrepancies found:**

- None

---

## Tasks

### Task 1: Add `markdown-patch` dependency and shared helper

**Description:** Install `markdown-patch`, create the shared `buildPatchInstruction()` helper and `applyUpdate()` function, and add `Vault.process()` to the obsidian mock.

**Files:**

- `plugin/package.json` — modify (add `markdown-patch` dependency)
- `plugin/src/tools/update-utils.ts` — create (shared helper)
- `plugin/src/__mocks__/obsidian.ts` — modify (add `Vault.process()` mock)

**Code example:**

```typescript
// plugin/src/tools/update-utils.ts
import { applyPatch, type PatchInstruction } from "markdown-patch";
import type { App, TFile } from "obsidian";

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

**Done when:** `pnpm install` succeeds, `update-utils.ts` exports helper functions, obsidian mock has `Vault.process()`, existing tests still pass.

**Commit:** "Add markdown-patch dependency and shared update helpers"

---

### Task 2: Implement `vault_update` tool with tests

**Description:** Add `vault_update` tool registration to `vault.ts` using the shared helper. Resolves file via `normalizePath()` → `vault.getAbstractFileByPath()`, then applies patch via `Vault.process()`.

**Files:**

- `plugin/src/tools/vault.ts` — modify (add `vault_update` registration)
- `plugin/src/tools/vault.test.ts` — modify (add `vault_update` tests)

**Test cases:**

- Success: each targetType (heading, block, frontmatter)
- Heading `::` splitting verified in `applyPatch` call args
- `createIfMissing` passed through correctly
- File not found → `isError: true`
- `PatchFailed` → `isError: true` with reason

**Done when:** All vault_update tests pass, existing vault tests still pass.

**Commit:** "feat: Add vault_update tool with structured content targeting"

---

### Task 3: Implement `active_file_update` tool with tests

**Description:** Add `active_file_update` tool registration to `active-file.ts`. Resolves file via `workspace.getActiveFile()`, then applies patch via `Vault.process()`.

**Files:**

- `plugin/src/tools/active-file.ts` — modify (add `active_file_update` registration)
- `plugin/src/tools/active-file.test.ts` — modify (add `active_file_update` tests)

**Test cases:**

- Success: patch applied to active file
- No active file → `isError: true`
- `PatchFailed` → `isError: true` with reason

**Done when:** All active_file_update tests pass, existing active-file tests still pass.

**Commit:** "feat: Add active_file_update tool with structured content targeting"

---

### Task 4: Implement `periodic_update` tool with tests

**Description:** Add `periodic_update` tool registration to `periodic.ts` with the create-then-patch flow. Resolves periodic note via Periodic Notes plugin API, creates the note if missing via `vault.create()`, then applies patch via `Vault.process()`.

**Files:**

- `plugin/src/tools/periodic.ts` — modify (add `periodic_update` registration)
- `plugin/src/tools/periodic.test.ts` — modify (add `periodic_update` tests)

**Test cases:**

- Success: patch applied to existing periodic note
- Missing note: file created via `vault.create()` then patched
- Periodic Notes plugin unavailable → `isError: true`
- `PatchFailed` → `isError: true` with reason

**Done when:** All periodic_update tests pass, existing periodic tests still pass.

**Commit:** "feat: Add periodic_update tool with structured content targeting"

---

### Task 5: Integration verification

**Description:** Run full test suite, verify all three tools are registered in `main.ts`, and confirm esbuild bundles `markdown-patch` correctly.

**Files:**

- `plugin/src/main.ts` — modify if needed (verify registration calls)

**Done when:** Full test suite green, `pnpm build` succeeds, `markdown-patch` is present in bundled output.

**Commit:** "chore: Verify structured update tools integration" (only if `main.ts` changes needed)

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

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                                                                                    | Notes                                                                                                                                             |
| ---------- | ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-17 | Task 1 | plugin/package.json, plugin/src/tools/update-utils.ts, plugin/src/**mocks**/obsidian.ts  | Deviated: frontmatter patches require ContentType.json with parsed content, not text/markdown. buildPatchInstruction handles this per targetType. |
| 2026-03-17 | Task 2 | plugin/src/tools/vault.ts, plugin/src/tools/vault.test.ts                                | 7 new tests: heading/block/frontmatter success, nested heading ::, createIfMissing, file not found, PatchFailed error.                            |
| 2026-03-17 | Task 3 | plugin/src/tools/active-file.ts, plugin/src/tools/active-file.test.ts                    | 3 new tests: success, no active file, PatchFailed error.                                                                                          |
| 2026-03-17 | Task 4 | plugin/src/tools/periodic.ts, plugin/src/tools/periodic.test.ts, plugin/src/main.test.ts | 4 new tests. Used create\*Note from obsidian-daily-notes-interface instead of vault.create. Added create exports to main.test.ts mock.            |

---

## Completion

**Completed:** [Date]
**Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- `markdown-patch` types may need a declaration file if the library doesn't ship types. Check during Task 1 and add a `markdown-patch.d.ts` if needed.
- The `periodic_update` create-then-patch flow uses `vault.create()` then `vault.process()` as separate operations — this is intentional to match legacy behavior, though it's not fully atomic.
