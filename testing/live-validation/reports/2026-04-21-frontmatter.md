# Live Validation Report: Frontmatter

- **Date:** 2026-04-21
- **Checklist:** testing/live-validation/checklists/04-frontmatter.md
- **Operator:** Claude Code

## Summary

- Items run: 29
- Passed: 24
- Failed: 5

## Failures

### 2.2 Replace with object

- **Checklist item:** testing/live-validation/checklists/04-frontmatter.md §2.2
- **Action run:** `vault_update` — path `sandbox/frontmatter.md`, targetType `frontmatter`, target `status`, operation `replace`, content `{"state":"published","date":"2026-03-21"}`
- **Expected:** object value rendered as a nested structure readable in Obsidian
- **Observed:** file contains valid nested YAML and `vault_read` parses it as an object, but Obsidian's Properties UI displays the value as the serialized string `{"state":"published","date":"2026-03-21"}` rather than a structured nested value
- **Category:** behavior mismatch

### 4.1 Append array to array

- **Checklist item:** testing/live-validation/checklists/04-frontmatter.md §4.1
- **Action run:** `vault_update` — path `sandbox/frontmatter.md`, targetType `frontmatter`, target `tags`, operation `append`, content `["gamma"]` (existing tags: `["alpha","beta","gamma"]`)
- **Expected:** append extends array; existing `gamma` is not duplicated
- **Observed:** `tags` became `["alpha","beta","gamma","gamma"]` — existing `gamma` was duplicated
- **Category:** behavior mismatch

### 8.3 JSON-string coerced to object

- **Checklist item:** testing/live-validation/checklists/04-frontmatter.md §8.3
- **Action run:** `frontmatter_manage` — action `set`, key `data`, value `{"key":"value"}`
- **Expected:** object value rendered as a nested structure readable in Obsidian
- **Observed:** file has valid nested YAML (`data:` / `  key: value`) and `frontmatter_manage read` returns it as a parsed object, but Obsidian's Properties UI displays the value as the serialized string `{"key":"value"}`
- **Category:** behavior mismatch

### 8.4 JSON-string coerced to array

- **Checklist item:** testing/live-validation/checklists/04-frontmatter.md §8.4
- **Action run:** `frontmatter_manage` — action `set`, key `flags`, value `[true, false]`
- **Expected:** array value rendered as a structured value in Obsidian
- **Observed:** `frontmatter_manage read` returns `[true, false]`, but Obsidian's Properties UI displays the value as the serialized string `[true,false]` (shown as an orange invalid-property chip)
- **Category:** behavior mismatch

### 9.2 Set without value

- **Checklist item:** testing/live-validation/checklists/04-frontmatter.md §9.2
- **Action run:** `frontmatter_manage` — action `set`, key `foo`, value omitted
- **Expected:** error
- **Observed:** tool returned success (`Set foo in sandbox/fm_manage.md`); subsequent read shows no `foo` key was actually written — silent no-op
- **Category:** missing validation

## Passes

All other items in the checklist passed.

## Setup/teardown

- Setup: passed
- Teardown: passed
