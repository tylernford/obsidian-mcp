# Live Validation Report: Cross-cutting Concerns

- **Date:** 2026-04-21
- **Checklist:** testing/live-validation/checklists/10-cross-cutting.md
- **Operator:** Claude Code

## Summary

- Items run: 17 (1 skipped: 5.5)
- Passed: 15
- Failed: 2
- Skipped: 1

## Failures

### 5.3 content-type-invalid

- **Checklist item:** testing/live-validation/checklists/10-cross-cutting.md §5.3
- **Action run:** `vault_update` — path `sandbox/patch-codes.md`, targetType `frontmatter`, target `tags`, operation `append`, content `[invalid json here`, `createIfMissing: true`
- **Expected:** error; response surfaces `content-type-invalid`
- **Observed:** tool returned `Updated sandbox/patch-codes.md`; frontmatter now contains `tags: "[invalid json here"` as a literal string — no validation error
- **Category:** missing validation

### 5.4 content-not-mergeable

- **Checklist item:** testing/live-validation/checklists/10-cross-cutting.md §5.4
- **Action run:** `vault_update` — path `sandbox/patch-codes.md`, targetType `block`, target `b1`, operation `replace`, content `# Heading inside block replacement\n\nWith a sub-paragraph.`
- **Expected:** error; response surfaces `content-not-mergeable`
- **Observed:** tool returned `Updated sandbox/patch-codes.md`; multi-block replacement applied and the `^b1` reference was relocated to the trailing paragraph — no validation error
- **Category:** missing validation

## Passes

All other items in the checklist passed. 5.5 was skipped — `vault_update` does not expose a table targetType, so table patching is not available.

## Setup/teardown

- Setup: passed — no global setup; section 5 extra setup (`vault_create patch-codes.md`) succeeded
- Teardown: passed — all 10 sandbox files deleted cleanly (patch-table.md not created due to 5.5 skip)

## Notes

- §3.1 filler was adjusted from the checklist example (`lorem ipsum dolor sit amet` × 370) to 180 varied numbered lines (~9,900 chars body) due to an Anthropic output-filter block on long identical-token repetitions in the test harness. Size and intent preserved; plugin behavior unaffected. The varied-line payload is not identical to a pure-repetition payload, so this run does not fully cover the repetitive-large-content case.
