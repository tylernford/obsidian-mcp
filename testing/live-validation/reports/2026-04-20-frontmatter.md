# Live Validation Report: Frontmatter

- **Date:** 2026-04-20
- **Checklist:** testing/live-validation/checklists/04-frontmatter.md
- **Operator:** Claude Code

## Summary

- Items run: 29
- Passed: 27
- Failed: 2

## Failures

### 4.1 Append array to array

- **Checklist item:** testing/live-validation/checklists/04-frontmatter.md §4.1
- **Action run:** `vault_update` — path `sandbox/frontmatter.md`, targetType `frontmatter`, target `tags`, operation `append`, content `["gamma"]` (existing tags: `["alpha","beta","gamma"]`)
- **Expected:** append extends array; existing `gamma` is not duplicated
- **Observed:** `tags` became `["alpha","beta","gamma","gamma"]` — duplicate `gamma` was inserted
- **Category:** behavior mismatch

### 9.2 Set without value

- **Checklist item:** testing/live-validation/checklists/04-frontmatter.md §9.2
- **Action run:** `frontmatter_manage` — action `set`, key `foo`, value omitted
- **Expected:** error
- **Observed:** tool returned success (`Set foo in sandbox/fm_manage.md`); subsequent read shows no `foo` key was actually written
- **Category:** missing validation

## Passes

All other items in the checklist passed.

## Setup/teardown

- Setup: passed
- Teardown: passed
