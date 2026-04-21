# Live Validation Report: Navigation + Commands

- **Date:** 2026-04-20
- **Checklist:** testing/live-validation/checklists/08-navigation-commands.md
- **Operator:** Claude Code
- **Note:** run with operator observing each tool call one-at-a-time (deviation from normal batched cadence).

## Summary

- Items run: 10
- Passed: 8
- Failed: 2

## Failures

### 1.2 Open in new tab (newLeaf: true)

- **Checklist item:** testing/live-validation/checklists/08-navigation-commands.md §1.2
- **Action run:** `file_open` — path `sandbox/nav-b.md`, `newLeaf: true`
- **Expected:** success; `sandbox/nav-b.md` becomes the active file
- **Observed:** tool returned `Opened sandbox/nav-b.md`; operator confirmed a new tab was opened but focus did NOT shift — nav.md remained the active tab. `active_file_read` returned `# Nav\n\nBody.\n`.
- **Category:** behavior mismatch

### 2.1 Nonexistent file

- **Checklist item:** testing/live-validation/checklists/08-navigation-commands.md §2.1
- **Action run:** `file_open` — path `sandbox/does-not-exist.md`
- **Expected:** either (a) error indicating file not found, or (b) success with no actual file opened
- **Observed:** tool returned `Opened sandbox/does-not-exist.md` AND created an empty file at `sandbox/does-not-exist.md`. The newly-created empty file then triggered Templater's new-file hook, opening the template picker. Neither option (a) nor option (b) matches — option (b) explicitly requires "no actual file opened", but the tool silently created and opened one.
- **Category:** missing validation

## Passes

All other items passed, with these recorded observations:

- **1.1** `file_open` returned `Opened sandbox/nav.md`; `active_file_read` (markdown) returned `# Nav\n\nBody.\n`.
- **1.3** `file_open` (newLeaf: false) returned `Opened sandbox/nav.md`; operator had manually focused nav-b's tab first (deviation — see Deviations). After the call, nav.md was focused and nav-b's tab still existed. **Caveat:** test does not isolate the "replace current tab" semantic — tab dedupe caused focus to switch to the pre-existing nav.md tab rather than replacing nav-b's content. See Checklist defects.
- **3.1** `commands_list` returned a JSON array.
- **3.2** Every entry has exactly two keys: `id` (non-empty string) and `name` (non-empty string).
- **3.3** Both `editor:toggle-bold` and `app:open-settings` are present.
- **4.1** `commands_execute` for `editor:toggle-bold` returned `Executed command: editor:toggle-bold`; operator confirmed bold markers (`****`) were inserted at cursor in nav.md.
- **4.2** `commands_execute` with `fake:command-id` raised error `Command not found: fake:command-id` — exact match.
- **4.3** With all tabs closed, `commands_execute` for `editor:toggle-bold` returned `Executed command: editor:toggle-bold` with no visible side effect — option b.

## Deviations

- §1.3: operator manually switched focus to nav-b.md before the call, because §1.2's failure left nav.md as the active tab; without this manual step the checklist's §1.3 action would have been a no-op. Recorded as a checklist defect below.
- §4.3: first attempt ran against nav.md (which was still active because operator hadn't yet closed tabs between §4.2 and §4.3). Result invalidated and the step re-run after operator closed all tabs; the pass recorded reflects the re-run.

## Checklist defects (not tool issues)

These should be addressed in `docs/live-validation/checklists/08-navigation-commands.md`:

- §1.3 presupposes §1.2 succeeded. If §1.2 fails (as it did), the previously-focused tab is still nav.md, and §1.3's `newLeaf: false` on nav.md is a no-op. The checklist should set an explicit precondition (e.g., "operator manually focuses nav-b.md before running §1.3").
- §1.3 cannot isolate `newLeaf: false` replacement semantics when the target file is already open elsewhere — Obsidian's tab dedupe focus-switches instead of replacing. The checklist needs a third file (or a target not already open) to demonstrate replacement.
- §4.3 requires an operator-gated precondition ("close all open files") but this is embedded in prose rather than called out as an explicit stop-point.

## Setup/teardown

- Setup: passed — both `sandbox/nav.md` and `sandbox/nav-b.md` created.
- Teardown: passed — both files deleted successfully. `sandbox/does-not-exist.md` (created as a side effect of §2.1) was deleted by the operator during the session; not part of checklist teardown.
