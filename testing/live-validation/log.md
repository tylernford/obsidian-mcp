# Live Validation — Known Issues

_Last updated: 2026-04-20_


## Setup/environment issues

_(non-tool-specific issues)_

## frontmatter_manage

### Set action accepts missing value without error

- **Category:** missing validation
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-20
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
- **Last confirmed:** 2026-04-20
- **Item:** checklists/06-search.md §3.4
- **Expected:** error, or success behaving as contextLength `0` / default
- **Observed:** `contextLength: -1` accepted silently; returned context `"nique_sentinel_mcp_test_xy"` — the negative value is applied as an offset that trims 1 char from each side of the match token rather than being rejected

## tags_manage

### Add drops pre-existing scalar tag value

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-20
- **Item:** checklists/05-tags.md §2.2
- **Expected:** adding `new-tag` to a file with scalar `tags: single-tag` yields array `["single-tag", "new-tag"]`
- **Observed:** `frontmatter.tags` becomes `["new-tag"]` — the pre-existing `single-tag` value is discarded

### Scalar `tags:` frontmatter treated as empty by list

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-20
- **Item:** checklists/05-tags.md §2.1
- **Expected:** scalar `tags: single-tag` coerced to `["single-tag"]` in the list response
- **Observed:** `tags_manage list` returns `{"tags": []}` for a file whose frontmatter has `tags: single-tag`

## vault_update

### Append to array duplicates existing values

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-20
- **Item:** checklists/04-frontmatter.md §4.1
- **Expected:** appending `["gamma"]` to a `tags` array that already contains `gamma` should not duplicate the value
- **Observed:** `tags` became `["alpha","beta","gamma","gamma"]` — existing `gamma` was duplicated rather than deduplicated

### Append without leading newline still inserts blank-line separator

- **Category:** behavior mismatch
- **First seen:** 2026-04-20
- **Last confirmed:** 2026-04-20
- **Item:** checklists/02-headings.md §5.2
- **Expected:** with no leading newline in the appended content, the new text is written adjacent to the trailing text of the target section (no automatic separator)
- **Observed:** a blank line is inserted between the prior section body (`Zeta content.`) and the appended text (`No leading newline.`), so content is blank-line-separated rather than directly adjacent
