# Live Tool Validation

Protocol for validating obsidian-mcp tools against a real Obsidian instance. Claude Code executes structured, single-tool checklists against a test vault and produces immutable reports plus proposed diffs to a human-curated known-issues log.

**This is traditional testing, executed by Claude instead of code.** Each item is a discrete tool call with a concrete expected outcome. Pass/fail is strict. Claude does not improvise — the checklist is the contract.

---

## Prerequisites (operator)

Before starting a session:

1. **Obsidian is open** with the test vault loaded.
2. **Test vault is reset:** in the test-vault repo, run `git reset --hard && git clean -fd`. This is the authoritative reset; checklist teardown is courtesy only.
3. **obsidian-mcp plugin is connected** to Claude Code via MCP.
4. **Plugin config for periodic notes** (only for `09-periodic.md`): at least one period (`daily`, `weekly`, `monthly`, `quarterly`, `yearly`) must be configured via the Periodic Notes plugin or core Daily Notes.

---

## Session start

Operator tells Claude:

> Run live validation checklist `docs/live-validation/checklists/<file>`. Follow the protocol in `docs/live-validation/README.md`.

Claude acknowledges by:

1. Reading the README and the referenced checklist.
2. Confirming the checklist area, the Setup step, and the number of test items.
3. Waiting for the operator's "go" before making any tool calls.

---

## Session run loop

For each `### N. <Sub-area>` section in the checklist:

1. **Run Setup** — execute the Setup action. If it fails, record a finding with category `setup failure`, **abort the section**, and continue to the next section. Do not run the section's items.
2. **Run items in order** — for each `#### N.M` item:
   - Execute the **Action** exactly as written.
   - Compare the tool response to **Expected**. If **Assert** is present, run it as an additional check.
   - Record **Result** as `pass` or `fail — <one-line observation>`.
   - Do not retry a failing action with a different tool. Do not improvise.
3. **Run Teardown** — execute teardown action. Teardown failures are recorded but do not invalidate earlier results; the pre-session `git reset --hard` is the real safety net.

Failures in one section do not abort other sections. A full session runs all sections in the checklist.

---

## Session end

Claude writes two artifacts:

1. **Report** — always. Path: `docs/live-validation/reports/YYYY-MM-DD-<area>.md`. Immutable once written.
2. **Log-diff** — only if the session proposes Add, Update, or Remove changes to `log.md`. Path: `docs/live-validation/log-diffs/YYYY-MM-DD-<area>.md`. If there are no proposed changes, skip this file entirely.

Claude never edits `log.md` directly. The log-diff is a proposal for human review; the operator applies it manually and deletes the diff file.

---

## Sandbox conventions

- All file artifacts live under `sandbox/` at the test vault root.
- No `__test__` filename prefix — the folder is already test-scoped.
- Checklists never reference vault paths outside `sandbox/`.
- Cleanup (Teardown) is courtesy; correctness comes from the pre-session `git reset --hard`.
- Tools without a file-path target (`commands_*`, periodic notes when plugin-configured, active-file when no path) follow the nearest sensible rule: create any files they need under `sandbox/`; accept that periodic-note paths are determined by plugin config.

---

## Formats

### Checklist item

```markdown
#### 1.1 Create a file

- **Action:** `vault_create` — path `sandbox/lifecycle.md`, content `# Hello\n\nWorld.`
- **Expected:** tool returns success; no error.
- **Assert:** `vault_read` at same path returns content matching input.
- **Result:** _pass | fail — <one-line observation if fail>_
```

`Assert` is optional — present only when the tool's own return value isn't enough to confirm the outcome. `Result` is filled in during the session. Read-only companion tools (e.g., `vault_read`) are allowed purely as assertion mechanisms; they never substitute for the tool under test.

### Section (within a checklist file)

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

### Report

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

### Known-issues log entry

```markdown
## <tool_name>

### <short descriptive title>

- **Category:** <one of the 5>
- **First seen:** YYYY-MM-DD
- **Last confirmed:** YYYY-MM-DD
- **Item:** checklists/<file> §<section>.<item>
- **Expected:** <one line>
- **Observed:** <one line>
- **Notes:** (optional) human commentary
```

- Top-level sections are tool names, alphabetical.
- Issues within a section are ordered newest-`Last confirmed` first.
- An issue's presence in the log means it's open. Resolved issues are deleted, not marked closed. History lives in reports.
- `Notes` is the one place human commentary is allowed.

### Log-diff

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

---

## Log-diff rules (Claude)

- Propose **Remove** only when the specific checklist item referenced in that log entry's `Item` field ran and passed in this session. Never remove based on indirect evidence.
- Never modify existing entries beyond `Last confirmed`. New observations on an existing issue go in a new report, not a log edit.
- Never touch entries under a tool section the session didn't exercise.
- If nothing would go in Add, Update, or Remove, **do not write a log-diff file**.

---

## Failure categories (closed set)

| Category             | Meaning                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `behavior mismatch`  | Tool ran but output or side effect did not match the expected outcome.                          |
| `missing validation` | Tool accepted bad input it should have rejected.                                                |
| `error shape`        | Tool failed correctly but the error was malformed or unhelpful in a way that breaks the caller. |
| `regression`         | An item that passed in a prior report now fails.                                                |
| `setup failure`      | Failure occurred during setup or teardown rather than a test item proper.                       |

If a failure does not fit one of these five, update this spec — there is no `other` category.
