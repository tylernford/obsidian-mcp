# Live Validation — Known Issues

_Last updated: 2026-04-21_



## Setup/environment issues

_(non-tool-specific issues)_

## frontmatter_manage

### Object/array values render as serialized JSON in Obsidian Properties UI

- **Category:** behavior mismatch
- **First seen:** 2026-04-21
- **Last confirmed:** 2026-04-21
- **Item:** checklists/04-frontmatter.md §8.3
- **Expected:** complex values (objects, arrays) rendered as structured values in Obsidian Properties UI
- **Observed:** `frontmatter_manage read` returns parsed structures correctly, but Obsidian's Properties UI displays them as serialized JSON strings (§8.3: object shows as `{"key":"value"}`; §8.4: array shows as `[true,false]` with an orange invalid-property chip)

### Set action accepts missing value without error

- **Category:** missing validation
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/04-frontmatter.md §9.2
- **Expected:** error when `value` is omitted for a `set` action
- **Observed:** tool returned success (`Set foo in sandbox/fm_manage.md`), but subsequent read shows the key was never written — silent no-op instead of a validation error

## file_open

### newLeaf: true opens tab but does not shift focus

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-20
- **Item:** checklists/08-navigation-commands.md §1.2
- **Expected:** opening `sandbox/nav-b.md` with `newLeaf: true` leaves `sandbox/nav-b.md` as the active file
- **Observed:** new tab is created but focus remains on the previously-active tab; `active_file_read` returns the prior file's content

### Nonexistent path silently creates an empty file

- **Category:** missing validation
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-20
- **Item:** checklists/08-navigation-commands.md §2.1
- **Expected:** error indicating file not found, or success without opening anything
- **Observed:** tool returns success and creates an empty file at the given path; the new empty file then triggers Templater's new-file hook, opening the template picker as a side effect

## search

### Negative contextLength silently trims match token

- **Category:** missing validation
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/06-search.md §3.4
- **Expected:** error, or success behaving as contextLength `0` / default
- **Observed:** `contextLength: -1` accepted silently; returned context `"nique_sentinel_mcp_test_xy"` — the negative value is applied as an offset that trims 1 char from each side of the match token rather than being rejected

## tags_manage

### Remove of nonexistent tag returns misleading success message

- **Category:** behavior mismatch
- **First seen:** 2026-04-21
- **Last confirmed:** 2026-04-21
- **Item:** checklists/05-tags.md §5.2
- **Expected:** silent no-op OR clean error when removing a tag that isn't present
- **Observed:** tool returns `Tags removed: nonexistent-tag` as if the tag had been removed, even though it was never present; frontmatter state is correctly unchanged, but the success string is misleading to callers

### Add drops pre-existing scalar tag value

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/05-tags.md §2.2
- **Expected:** adding `new-tag` to a file with scalar `tags: single-tag` yields array `["single-tag", "new-tag"]`
- **Observed:** `frontmatter.tags` becomes `["new-tag"]` — the pre-existing `single-tag` value is discarded

### Scalar `tags:` frontmatter treated as empty by list

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/05-tags.md §2.1
- **Expected:** scalar `tags: single-tag` coerced to `["single-tag"]` in the list response
- **Observed:** `tags_manage list` returns `{"tags": []}` for a file whose frontmatter has `tags: single-tag`

## vault_list

### Listing a file path returns "Directory not found"

- **Category:** error shape
- **First seen:** 2026-04-21
- **Last confirmed:** 2026-04-21
- **Item:** checklists/01-vault.md §4.4
- **Expected:** error indicating the path is not a directory
- **Observed:** error `Directory not found: sandbox/dir_test.md` — the path exists as a file; caller cannot distinguish "not a directory" from "doesn't exist"

## vault_update

### Object value in frontmatter renders as serialized JSON in Obsidian Properties UI

- **Category:** behavior mismatch
- **First seen:** 2026-04-21
- **Last confirmed:** 2026-04-21
- **Item:** checklists/04-frontmatter.md §2.2
- **Expected:** object value rendered as a nested structure readable in Obsidian
- **Observed:** file contains valid nested YAML and `vault_read` parses it as an object, but Obsidian's Properties UI displays the value as the serialized string `{"state":"published","date":"2026-03-21"}`

### Block append relocates block-id marker to last line

- **Category:** behavior mismatch
- **First seen:** 2026-04-21
- **Last confirmed:** 2026-04-21
- **Item:** checklists/03-blocks.md §1.1
- **Expected:** appending to a block leaves the `^<id>` marker on the line it was originally attached to
- **Observed:** append to `^block1` moved the marker from `First paragraph.` onto the newly appended line (`Appended after block1. ^block1`); link still resolves, but callers assuming the anchor stays put will be surprised

### createIfMissing places block id on separate line with blank-line separator

- **Category:** behavior mismatch
- **First seen:** 2026-04-21
- **Last confirmed:** 2026-04-21
- **Item:** checklists/03-blocks.md §3.1
- **Expected:** created block uses the conventional inline form (`<content> ^<id>`)
- **Observed:** `^newblock` was placed on its own line separated from `New block body.` by a blank line; the id still binds to the preceding paragraph but the layout differs from conventional inline block ids

### Frontmatter append accepts malformed value without validation

- **Category:** missing validation
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/10-cross-cutting.md §5.3
- **Expected:** error; response surfaces `content-type-invalid` when appending a malformed value to a frontmatter field
- **Observed:** tool returned success; frontmatter stored the literal string `tags: "[invalid json here"` — no `content-type-invalid` error surfaced

### Block replace accepts multi-block content without validation

- **Category:** missing validation
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/10-cross-cutting.md §5.4
- **Expected:** error; response surfaces `content-not-mergeable` when replacing a block with content containing a heading plus additional paragraph
- **Observed:** tool returned success; the multi-block replacement was applied and the `^b1` reference was silently moved to the trailing paragraph — no `content-not-mergeable` error surfaced

### Append to array duplicates existing values

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/04-frontmatter.md §4.1
- **Expected:** appending `["gamma"]` to a `tags` array that already contains `gamma` should not duplicate the value
- **Observed:** `tags` became `["alpha","beta","gamma","gamma"]` — existing `gamma` was duplicated rather than deduplicated

### Append without leading newline still inserts blank-line separator

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-21
- **Item:** checklists/02-headings.md §5.2
- **Expected:** with no leading newline in the appended content, the new text is written adjacent to the trailing text of the target section (no automatic separator)
- **Observed:** a blank line is inserted between the prior section body (`Zeta content.`) and the appended text (`No leading newline.`), so content is blank-line-separated rather than directly adjacent
