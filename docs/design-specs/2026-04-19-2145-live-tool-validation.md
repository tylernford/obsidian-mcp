# Live Tool Validation

**Created:** 2026-04-19 **Parent spec:** [2026-04-03-1550-testing-refactor.md](2026-04-03-1550-testing-refactor.md) **Implementation plan:** [docs/implementation-plans/2026-04-19-2201-live-tool-validation.md](../implementation-plans/2026-04-19-2201-live-tool-validation.md)

---

## Overview

**What:** A protocol and set of artifacts for manually validating obsidian-mcp tools against a real Obsidian instance. Claude Code executes structured, single-tool checklists against a test vault; sessions produce immutable reports and proposed diffs to a human-curated known-issues log.

**Why:** The root testing-refactor spec establishes live tool validation as the second of three test types. Traditional unit tests cover logic-heavy modules but cannot catch integration failures, Obsidian API behavior, or real-world breakage. Live validation fills that gap with a "traditional testing executed by Claude instead of code" framing — discrete tool calls, explicit expected outcomes, strict pass/fail.

**Type:** Process

---

## Guiding Framing

**This is traditional testing, executed by Claude instead of code.** Every decision below derives from that framing:

- Each test item is a single, discrete tool call with a concrete expected outcome.
- Pass/fail is strict. Subjective observations ("the error message was confusing", "this was slow") belong in agent user testing, not here.
- Claude does not improvise. The checklist is the contract.
- Broader workflow-level testing is the job of the third test type (agent user testing), not this one.

---

## Requirements

### Must Have

- [ ] Protocol document (`docs/live-validation/README.md`) that defines prerequisites, session flow, output files, and format references.
- [ ] Checklist files — one per test area, structured as `Action → Expected → (optional) Assert`.
- [ ] Session reports directory (`docs/live-validation/reports/`) for immutable per-session records.
- [ ] Human-curated known-issues log (`docs/live-validation/log.md`) organized by tool.
- [ ] Log-diff files (`docs/live-validation/log-diffs/`) produced by Claude at session end, proposing log changes for human review.
- [ ] Checklists cover every MCP tool exposed by the plugin.
- [ ] Test vault sandbox convention: all artifacts in a `sandbox/` subfolder; checklists never reference vault content outside sandbox.
- [ ] Pre-session reset convention: `git reset --hard && git clean -fd` in the test-vault repo.

### Nice to Have

- [ ] Migration of the existing `docs/research/live-tool-validation.md` content into the new structure (rework, not rebuild).

### Out of Scope

- Test vault content itself (lives in a separate private repo on the operator's machine).
- CI/CD integration or automation.
- Multi-client support (Claude Code is the only operator).
- Automated application of log-diffs to `log.md` (human-applied only).
- Bug-fix proposals or triage. The log describes problems; fixing them is a separate activity.
- Workflow / multi-tool-composition testing (agent user testing covers this).
- Performance, UX, or error-message-quality observations.

---

## Design Decisions

### Decision 1: Single-tool, discrete-action granularity

**Options considered:**

1. One checklist item = one tool invocation with a verifiable outcome.
2. One item = a workflow spanning multiple tool calls.
3. One item = one behavior/assertion regardless of tool count.

**Decision:** Option 1. Workflow-level testing is the explicit job of agent user testing (the third test type). Keeping live validation at one-tool-per-item preserves a clean boundary between the two suites and makes failures trivially attributable to a specific tool.

### Decision 2: Assertions may use read-only companion tools

**Options considered:**

1. Strict — expected outcomes limited to what the tool under test returns.
2. Pragmatic — read-only companion tools (e.g., `vault_read` after `vault_create`) are allowed purely as assertion mechanisms.

**Decision:** Option 2. Some tools don't return enough in their own response to verify the outcome. The tool under test remains the subject; companions only assert. Claude does not retry a failing action with a different tool.

### Decision 3: Sessions organized by area, not by tool or all-at-once

**Options considered:**

1. One session covers all tools.
2. One session per tool (~13 sessions).
3. Multiple sessions organized by area, with some small areas merged.

**Decision:** Option 3, with "Grouping X": 10 area files. All-tools sessions are unmanageable; per-tool is excessive bookkeeping. Area grouping balances session length and coherence.

### Decision 4: Test vault lives in a separate private repo

**Options considered:**

1. Test vault committed to the MCP repo.
2. Test vault in its own private repo, outside the MCP repo.

**Decision:** Option 2. The MCP repo is public and cannot contain personal vault content. The test vault is a dump of real notes, lives in a private repo, and is reset via `git reset --hard && git clean -fd` before each session. Checklists operate only inside a `sandbox/` subfolder and never reference real vault content.

### Decision 5: All MCP tools are in scope

**Options considered:**

1. Tier tools by importance; validate only the critical ones.
2. Validate every tool.

**Decision:** Option 2. Every tool shipped by the plugin is part of the MCP surface; every one is a potential integration failure. Tiering invites coverage gaps.

### Decision 6: Strict pass/fail findings

**Options considered:**

1. Strict — findings are only pass/fail against expected outcomes.
2. Inclusive — findings also include perf, error-message quality, payload oddities.
3. Middle — pass/fail primary; optional "notes" for observations.

**Decision:** Option 1. The "traditional tests executed by Claude" framing requires this. Subjective observations are agent user testing's domain; letting them leak into live validation blurs the boundary and invites coverage-by-vibes.

### Decision 7: Master README + one file per area

**Options considered:**

1. Single master checklist file.
2. One file per area, with a master README describing the protocol.
3. Single file with explicit session markers.

**Decision:** Option 2. The master README holds the protocol and format references; each area has its own checklist file. Individual checklist files stay focused on what's tested, not how. Matches our session-per-area decision cleanly.

### Decision 8: Setup and teardown are first-class, structured steps

**Options considered:**

1. Setup/teardown as prose instructions at the top of each section.
2. Setup/teardown formatted as testable steps with expected outcomes.

**Decision:** Option 2. Setup calls are real tool calls. A setup failure is itself a finding (a regressed tool makes every dependent section's setup fail). Structured setup makes that signal trivial to capture.

### Decision 9: Reports are immutable; log is human-curated; log-diffs bridge them

**Options considered:**

1. Claude edits `log.md` directly at session end.
2. Human updates `log.md` entirely manually; Claude only writes reports.
3. Claude writes a proposed log-diff file; human reviews and applies manually.

**Decision:** Option 3. Automated edits to the known-issues log are risky (false removals on partial-coverage sessions). Pure manual updates introduce friction that leads to log staleness. Claude drafts, human curates — the log remains authoritative and trustworthy.

### Decision 10: Five-category closed set for failures

**Options considered:**

1. Free-form category text per failure.
2. A closed, predefined set of category tags.

**Decision:** Option 2. Categories: `behavior mismatch`, `missing validation`, `error shape`, `regression`, `setup failure`. A closed set makes log grouping mechanical and cross-session comparison tractable. If a failure doesn't fit, this spec is updated — no "other".

### Decision 11: Rework the existing research doc, don't rebuild

**Options considered:**

1. Adopt `docs/research/live-tool-validation.md` as-is.
2. Delete it; write new checklists from scratch.
3. Rework the content into the new structure.

**Decision:** Option 3. The research doc has ~80% of items already close to the `action → expected` format and reflects real thinking about coverage. Starting blank wastes that. Adopting as-is is incompatible with the protocol. Migration plan: split into area files, convert items to the four-field format, drop open-ended "document behavior" items, replace the findings block with the reports/log structure, swap `__test__` prefixes for `sandbox/` paths. Original research doc is archived in place.

---

## Specification Details

### Directory layout

```
docs/live-validation/
├── README.md                         # protocol, prerequisites, format references
├── checklists/
│   ├── 01-vault.md                   # vault_create, vault_read, vault_update, vault_delete, vault_list
│   ├── 02-headings.md                # heading targeting via vault_update
│   ├── 03-blocks.md                  # block-reference targeting via vault_update
│   ├── 04-frontmatter.md             # vault_update frontmatter + frontmatter_manage (merged)
│   ├── 05-tags.md                    # tags_manage
│   ├── 06-search.md                  # search (simple + dataview)
│   ├── 07-active-file.md             # active_file_read, active_file_update
│   ├── 08-navigation-commands.md     # file_open + commands_list + commands_execute (merged)
│   ├── 09-periodic.md                # periodic_read, periodic_update
│   └── 10-cross-cutting.md           # metadata-cache timing, concurrency, large content, error-shape consistency
├── reports/
│   └── YYYY-MM-DD-<area>.md          # one immutable report per session
├── log-diffs/
│   └── YYYY-MM-DD-<area>.md          # one per session, only if log changes proposed; deleted after application
└── log.md                            # human-curated known-issues snapshot
```

### Checklist item format

Each test item is a numbered subsection with four fields:

```markdown
#### 1.1 Create a file

- **Action:** `vault_create` — path `sandbox/lifecycle.md`, content `# Hello\n\nWorld.`
- **Expected:** tool returns success; no error.
- **Assert:** `vault_read` at same path returns content matching input.
- **Result:** _pass | fail — <one-line observation if fail>_
```

`Assert` is optional — present only when the tool's own return value isn't enough to confirm the outcome. `Result` is filled in during the session.

### Section format in a checklist file

```markdown
# Area: <Area Name>

## Tools covered

- tool_a, tool_b, tool_c

## Setup

- **Action:** <tool call>
- **Expected:** success
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. <Sub-area>

#### 1.1 ...

#### 1.2 ...

### 2. <Sub-area>

#### 2.1 ...

## Teardown

- **Action:** <cleanup>
- **Expected:** success
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
```

### Report format

```markdown
# Live Validation Report: <Area Name>

- **Date:** YYYY-MM-DD
- **Checklist:** docs/live-validation/checklists/<file>
- **Operator:** Claude Code

## Summary

- Items run: N
- Passed: N
- Failed: N

## Failures

### <section>.<item> <Title>

- **Checklist item:** docs/live-validation/checklists/<file> §<section>.<item>
- **Action run:** <tool + inputs>
- **Expected:** <one line>
- **Observed:** <one line>
- **Category:** <one of the 5 categories>

## Passes

All other items in the checklist passed.

## Setup/teardown

- Setup: passed | failed — <detail>
- Teardown: passed | failed — <detail>
```

Reports are immutable once written. Re-runs produce new reports, never edits to prior ones.

### Failure categories (closed set)

| Category             | Meaning                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `behavior mismatch`  | Tool ran but output or side effect did not match the expected outcome.                          |
| `missing validation` | Tool accepted bad input it should have rejected.                                                |
| `error shape`        | Tool failed correctly but the error was malformed or unhelpful in a way that breaks the caller. |
| `regression`         | An item that passed in a prior report now fails.                                                |
| `setup failure`      | Failure occurred during setup or teardown rather than a test item proper.                       |

### Known-issues log format

```markdown
# Live Validation — Known Issues

_Last updated: YYYY-MM-DD_

## <tool_name>

### <short descriptive title>

- **Category:** <one of the 5>
- **First seen:** YYYY-MM-DD
- **Last confirmed:** YYYY-MM-DD
- **Item:** checklists/<file> §<section>.<item>
- **Expected:** <one line>
- **Observed:** <one line>
- **Notes:** (optional) human commentary

## Setup/environment issues

_(non-tool-specific issues)_
```

- Top-level sections are tool names, alphabetical.
- Issues within a section are ordered newest-`Last confirmed` first.
- An issue's presence in the log means it's open; resolved issues are deleted, not marked closed. History lives in reports.
- `Notes` is the one place human commentary is allowed.

### Log-diff format

```markdown
# Log Diff: <Area> session, YYYY-MM-DD

_Source report: reports/YYYY-MM-DD-<area>.md_

## Add

### <tool_name> → <issue title>

_Place at top of `## <tool_name>` section. Create the section if it doesn't exist._

- **Category:** ...
- **First seen:** ...
- **Last confirmed:** ...
- **Item:** ...
- **Expected:** ...
- **Observed:** ...

## Update (re-confirm)

### <tool_name> → <existing issue title>

- **Last confirmed:** → YYYY-MM-DD (was YYYY-MM-DD)
- **Reason:** re-surfaced in checklists/<file> §<section>.<item>

## Remove (proposed)

### <tool_name> → <existing issue title>

- **Reason:** item previously failing at §<section>.<item> now passes in this session.
- **Caution:** <explanation of why this removal is safe, or a warning that it may not be>

## No change

- All other existing log entries were not exercised by this session's checklist.
```

**Rules Claude follows when generating a diff:**

- Propose **Remove** only when the specific checklist item referenced in that log entry's `Item` field ran and passed in this session.
- Never modify existing entries beyond `Last confirmed`. New observations on an existing issue go in a new report, not a log edit.
- Never touch entries under a tool section the session didn't exercise.
- If nothing would go in Add, Update, or Remove, the diff file is not produced.

### Session protocol (summary)

Detailed in `docs/live-validation/README.md`. Summary:

1. **Prerequisites (operator):** Obsidian open with test vault; `git reset --hard && git clean -fd` run in test-vault repo; plugin connected via MCP.
2. **Start:** Operator tells Claude "Run live validation checklist `<path>`. Follow the protocol in `docs/live-validation/README.md`." Claude acknowledges.
3. **Run:** For each section: execute Setup (failure = finding, section aborted); run each test item (Action → compare to Expected → optional Assert); execute Teardown. Failures within one section do not abort other sections. Claude does not improvise items or retry with different tools.
4. **End:** Claude writes the report and (if applicable) the log-diff. Claude does not edit `log.md`.

### Sandbox conventions

- All file artifacts live under `sandbox/` at the test vault root.
- No `__test__` prefix — the folder is already test-scoped.
- Checklists never reference vault paths outside `sandbox/`.
- Cleanup is courtesy; correctness comes from the pre-session reset.
- Tools without a file-path target (`commands_*`, periodic notes when plugin-configured, active-file when no path) follow the nearest sensible rule: create any files they need in `sandbox/`; accept that periodic-note paths are determined by plugin config.

---

## Acceptance Criteria

- [ ] `docs/live-validation/README.md` exists, defines prerequisites, session flow, and inlines all four formats (checklist item, report, log entry, log-diff) plus the failure-category reference.
- [ ] `docs/live-validation/checklists/` contains 10 area files matching the Grouping X layout, each using the Section format and four-field item format.
- [ ] Every MCP tool exposed by the plugin is exercised by at least one item across the 10 checklists.
- [ ] Every item has a concrete, verifiable Expected outcome. No "what happens?" or "document behavior" items remain.
- [ ] `docs/live-validation/log.md` exists (initially empty, with the documented structure).
- [ ] `docs/live-validation/reports/` and `docs/live-validation/log-diffs/` directories exist (may be empty).
- [ ] `docs/research/live-tool-validation.md` is preserved in place as archived research.
- [ ] A trial session (any one checklist) can be completed end-to-end following only the README, producing a valid report and — if applicable — a valid log-diff.

---

## Suggested Files to Create/Modify

```
docs/live-validation/README.md                         # new — protocol + format references
docs/live-validation/checklists/01-vault.md            # new
docs/live-validation/checklists/02-headings.md         # new
docs/live-validation/checklists/03-blocks.md           # new
docs/live-validation/checklists/04-frontmatter.md      # new — merges research doc §4 + §5
docs/live-validation/checklists/05-tags.md             # new
docs/live-validation/checklists/06-search.md           # new
docs/live-validation/checklists/07-active-file.md      # new
docs/live-validation/checklists/08-navigation-commands.md  # new — merges research doc §9 + §10
docs/live-validation/checklists/09-periodic.md         # new
docs/live-validation/checklists/10-cross-cutting.md    # new
docs/live-validation/log.md                            # new — empty structured snapshot
docs/live-validation/reports/.gitkeep                  # new — preserve empty dir
docs/live-validation/log-diffs/.gitkeep                # new — preserve empty dir
docs/research/live-tool-validation.md                  # keep in place as archived research
```
