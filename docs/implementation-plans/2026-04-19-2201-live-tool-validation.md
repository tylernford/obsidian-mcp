# Implementation Plan: Live Tool Validation

**Created:** 2026-04-19 **Type:** Process **Overview:** A protocol and set of artifacts for manually validating obsidian-mcp tools against a real Obsidian instance. Claude Code executes structured, single-tool checklists against a test vault; sessions produce immutable reports and proposed diffs to a human-curated known-issues log. **Design Spec:** [docs/design-specs/2026-04-19-2145-live-tool-validation.md](../design-specs/2026-04-19-2145-live-tool-validation.md)

---

## Summary

Build the `docs/live-validation/` package defined by the design spec: a protocol README, 10 per-area checklist files migrated from the existing research doc, an empty human-curated known-issues log, and the report / log-diff directory scaffolding. No code changes — documentation and process artifacts only.

---

## Codebase Verification

- [x] `docs/live-validation/` does not yet exist — clean slate. **Verified:** yes.
- [x] `docs/research/live-tool-validation.md` exists with 12 sections close to the `action → expected` format. **Verified:** yes. Spec's ~80% migration estimate holds.
- [x] Every MCP tool listed in spec is actually registered. **Verified:** yes. All 15 tools confirmed via `server.registerTool(...)` calls in `plugin/src/tools/`:
  - `vault_list`, `vault_read`, `vault_create`, `vault_update`, `vault_delete`
  - `active_file_read`, `active_file_update`
  - `commands_list`, `commands_execute`
  - `file_open`
  - `search`
  - `periodic_read`, `periodic_update`
  - `tags_manage`, `frontmatter_manage`

**Patterns to leverage:**

- Existing research doc (`docs/research/live-tool-validation.md`) is the source-of-truth for item content; this plan reworks its 12 sections into the 10 area-file structure from the spec.

**Discrepancies found:**

- None. Design spec assumptions hold.

---

## Tasks

### Task 1: Create directory skeleton

**Description:** Create the `docs/live-validation/` directory tree with `.gitkeep` files so empty dirs (`reports/`, `log-diffs/`) are tracked. **Files:**

- `docs/live-validation/reports/.gitkeep` — create (empty)
- `docs/live-validation/log-diffs/.gitkeep` — create (empty)

**Done when:** `reports/` and `log-diffs/` exist as tracked empty directories. **Commit:** `Add live-validation directory skeleton`

---

### Task 2: Write protocol README

**Description:** Write `docs/live-validation/README.md`. Must define prerequisites, session flow (start → run → end), and inline all four format references (checklist item, section, report, known-issues log entry, log-diff) plus the five-category failure reference. Must be self-contained enough that an operator can run a trial session following only the README. **Files:**

- `docs/live-validation/README.md` — create

**Done when:** README covers:

1. Prerequisites (Obsidian open, test vault, `git reset --hard && git clean -fd`, MCP connected).
2. Session start handshake and Claude's acknowledgement behavior.
3. Per-section run loop (setup → items → teardown) and abort-on-setup-failure rule.
4. End-of-session write steps (report always; log-diff only if changes).
5. Inlined formats: checklist item, section, report, log entry, log-diff.
6. Failure category reference table (five closed-set values).
7. Sandbox conventions (all paths under `sandbox/`, no `__test__` prefix, cleanup is courtesy).
8. Log-diff rules Claude must follow (Remove only when specific referenced item ran + passed; never modify untouched tool sections; skip writing diff if no Add/Update/Remove).

**Commit:** `Add live-validation protocol README`

---

### Task 3: Write empty known-issues log

**Description:** Create `docs/live-validation/log.md` as an empty, structured starting point. Include the header, `_Last updated:_` line, and a `## Setup/environment issues` placeholder section. No tool sections yet — they're added as issues appear. **Files:**

- `docs/live-validation/log.md` — create

**Done when:** File exists with the exact structure shown in design spec §"Known-issues log format", with no open issues. **Commit:** `Add empty live-validation known-issues log`

---

### Task 4: Checklist 01 — vault

**Description:** Write the vault-lifecycle checklist. Covers `vault_create`, `vault_read`, `vault_update` (body only — heading/block targeting is in later files), `vault_delete`, `vault_list`. Migrate research doc §1 into the four-field per-item format and add structured Setup/Teardown. **Files:**

- `docs/live-validation/checklists/01-vault.md` — create

**Migration rules (apply to all checklist tasks 4–13):**

- Four-field item format: **Action / Expected / (optional) Assert / Result**.
- Drop open-ended items ("what happens?", "document behavior") or replace with concrete Expected.
- Replace `__test__` prefix with `sandbox/` paths.
- Add `## Tools covered` list at top.
- Structured Setup and Teardown per the section format in the spec.

**Done when:** Every item has verifiable Expected. All 5 vault tools appear in at least one item. **Commit:** `Add 01-vault live-validation checklist`

---

### Task 5: Checklist 02 — headings

**Description:** Heading-targeting tests via `vault_update`. Migrate research §2. **Files:**

- `docs/live-validation/checklists/02-headings.md` — create

**Done when:** Covers basic targeting, disambiguation, skipped levels, operations (append/prepend/replace), newline handling, `createIfMissing`, duplicate-content prevention, special characters — all with verifiable Expected outcomes. **Commit:** `Add 02-headings live-validation checklist`

---

### Task 6: Checklist 03 — blocks

**Description:** Block-reference targeting via `vault_update`. Migrate research §3. **Files:**

- `docs/live-validation/checklists/03-blocks.md` — create

**Done when:** Basic ops, error cases, `createIfMissing`, duplicate-content prevention — all with verifiable Expected. The research §3.3 open-ended "where does it get placed?" is resolved into a concrete Expected (verified via Assert read). **Commit:** `Add 03-blocks live-validation checklist`

---

### Task 7: Checklist 04 — frontmatter (merged)

**Description:** Merge research §4 (frontmatter via `vault_update`) + §5 (`frontmatter_manage`). Organize as two top-level test sections within the file. **Files:**

- `docs/live-validation/checklists/04-frontmatter.md` — create

**Done when:** `vault_update` frontmatter `targetType` paths and `frontmatter_manage` read/set paths each have concrete Expected. Parity section (research §4.6) preserved. **Commit:** `Add 04-frontmatter live-validation checklist`

---

### Task 8: Checklist 05 — tags

**Description:** `tags_manage` list/add/remove plus interactions with `vault_read` for inline vs frontmatter-tag semantics. Migrate research §6. **Files:**

- `docs/live-validation/checklists/05-tags.md` — create

**Done when:** All `tags_manage` branches covered with verifiable Expected. Scalar-tag and empty-tag edge cases resolved into concrete Expected. **Commit:** `Add 05-tags live-validation checklist`

---

### Task 9: Checklist 06 — search

**Description:** `search` simple + dataview. Migrate research §7. **Files:**

- `docs/live-validation/checklists/06-search.md` — create

**Done when:** Simple search success/empty/shape, `contextLength` variants, dataview TABLE happy path + unsupported-query errors, edge cases — all with verifiable Expected. Open-ended "what happens?" items resolved or dropped. **Commit:** `Add 06-search live-validation checklist`

---

### Task 10: Checklist 07 — active-file

**Description:** `active_file_read`, `active_file_update`. Migrate research §8. **Files:**

- `docs/live-validation/checklists/07-active-file.md` — create

**Done when:** Read/update/parity-with-vault_update/no-active-file-error items all have verifiable Expected. Setup includes `file_open` as a setup step (it's the only way to establish active-file state). **Commit:** `Add 07-active-file live-validation checklist`

---

### Task 11: Checklist 08 — navigation + commands (merged)

**Description:** Merge research §9 (`file_open`) + §10 (`commands_list`, `commands_execute`). **Files:**

- `docs/live-validation/checklists/08-navigation-commands.md` — create

**Done when:** `file_open` basics + error handling, `commands_list` shape, `commands_execute` success + not-found all with verifiable Expected. Research §9.2 open-ended response-shape question resolved into concrete Expected (record the literal returned shape). **Commit:** `Add 08-navigation-commands live-validation checklist`

---

### Task 12: Checklist 09 — periodic

**Description:** `periodic_read`, `periodic_update`. Migrate research §11. **Files:**

- `docs/live-validation/checklists/09-periodic.md` — create

**Done when:** Read behavior per period type, update auto-create behavior, configured/unconfigured error paths all have verifiable Expected. The plugin-config prerequisite noted at the top per spec §"Sandbox conventions". **Commit:** `Add 09-periodic live-validation checklist`

---

### Task 13: Checklist 10 — cross-cutting

**Description:** Metadata-cache timing, concurrency, large content, error-shape consistency, patch-error-code surfacing. Migrate research §12. **Files:**

- `docs/live-validation/checklists/10-cross-cutting.md` — create

**Done when:** Every item has a concrete pass/fail criterion. Strictly per spec Decision 6: no "note the latency", no "is the message confusing" items — those belong to agent user testing. The patch-error-codes check (§12.5) becomes a set of discrete items, one per `PatchFailureReason` with a triggering Action. **Commit:** `Add 10-cross-cutting live-validation checklist`

---

### Task 14: Coverage audit

**Description:** Verification-only pass — no files changed, no commit. Walk the 15 MCP tools and confirm each appears in at least one checklist item (not just in `## Tools covered` headers, but in an actual Action). Scan all 10 files for residual "what happens?" / "document behavior" language and fix any found (re-commit under the relevant checklist task). **Files:** none (audit only).

**Done when:**

- Every one of the 15 tools is referenced in ≥1 Action.
- Zero residual open-ended items.
- All items have four fields.

**Commit:** none (audit only; any fixes get folded into the relevant checklist commit or a small fixup commit as needed).

---

## Acceptance Criteria

- [ ] `docs/live-validation/README.md` exists, defines prerequisites, session flow, and inlines all four formats plus the failure-category reference.
- [ ] `docs/live-validation/checklists/` contains 10 area files matching the Grouping X layout.
- [ ] Every MCP tool exposed by the plugin (all 15) is exercised by at least one item across the 10 checklists.
- [ ] Every item has a concrete, verifiable Expected outcome. No "what happens?" or "document behavior" items remain.
- [ ] `docs/live-validation/log.md` exists (initially empty, with the documented structure).
- [ ] `docs/live-validation/reports/` and `docs/live-validation/log-diffs/` directories exist as tracked empty directories.
- [ ] `docs/research/live-tool-validation.md` is preserved in place as archived research (not touched by any task).
- [ ] A trial session (any one checklist) can be completed end-to-end following only the README, producing a valid report and — if applicable — a valid log-diff.

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task    | Files                                                                          | Notes                                                                                                                  |
| ---------- | ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-04-19 | Task 1  | docs/live-validation/reports/.gitkeep, docs/live-validation/log-diffs/.gitkeep | Created directory skeleton.                                                                                            |
| 2026-04-19 | Task 2  | docs/live-validation/README.md                                                 | Wrote protocol README covering prerequisites, session flow, all five formats, log-diff rules, and failure categories.  |
| 2026-04-19 | Task 3  | docs/live-validation/log.md                                                    | Created empty known-issues log with header, `_Last updated:_`, and `## Setup/environment issues` placeholder.          |
| 2026-04-19 | Task 4  | docs/live-validation/checklists/01-vault.md                                    | Migrated research §1 into 6 sub-areas covering all 5 vault tools with four-field items.                                |
| 2026-04-19 | Task 5  | docs/live-validation/checklists/02-headings.md                                 | Migrated research §2 into 8 sub-areas; open-ended bracket/colon items resolved to concrete Expected.                   |
| 2026-04-19 | Task 6  | docs/live-validation/checklists/03-blocks.md                                   | Migrated research §3 into 4 sub-areas; §3.3 placement question captured as Result note on a concrete assert.           |
| 2026-04-19 | Task 7  | docs/live-validation/checklists/04-frontmatter.md                              | Merged research §4 + §5 into 9 sub-areas; parity section preserved (§6).                                               |
| 2026-04-19 | Task 8  | docs/live-validation/checklists/05-tags.md                                     | Migrated research §6 into 7 sub-areas; scalar/empty edge cases resolved into concrete Expected.                        |
| 2026-04-19 | Task 9  | docs/live-validation/checklists/06-search.md                                   | Migrated research §7 into 5 sub-areas; simple + dataview + edge cases all concrete.                                    |
| 2026-04-19 | Task 10 | docs/live-validation/checklists/07-active-file.md                              | Migrated research §8 into 5 sub-areas; `file_open` used in setup as only path to establish active-file state.          |
| 2026-04-19 | Task 11 | docs/live-validation/checklists/08-navigation-commands.md                      | Merged research §9 + §10 into 4 sub-areas; response-shape questions captured as Result-note fields.                    |
| 2026-04-19 | Task 12 | docs/live-validation/checklists/09-periodic.md                                 | Migrated research §11 into 4 sub-areas; plugin-config prerequisite noted; per-period Configured/Unconfigured variants. |
| 2026-04-19 | Task 13 | docs/live-validation/checklists/10-cross-cutting.md                            | Migrated research §12 into 5 sub-areas; §12.5 split into 5 discrete items, one per PatchFailureReason.                 |

---

## Completion

**Completed:** [Date] **Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- The test vault itself lives in a separate private repo — not produced by this plan. Checklists assume it exists and that `git reset --hard && git clean -fd` is run before each session.
- Research doc is preserved in place; no task deletes or edits it. It's archived by leaving it where it is.
- No code is changed. If a checklist reveals a tool bug during a future session, the fix is a separate activity outside this plan.
