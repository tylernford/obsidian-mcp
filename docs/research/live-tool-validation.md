# Live Tool Validation

Run this with Claude Code against a live Obsidian instance to validate MCP tool behavior.

**Setup**: Obsidian open with a test vault, MCP server running, Claude Code connected via MCP.

**Rules**:

- All test files use the prefix `__test__` and are cleaned up after each section
- Report each result inline: pass, fail, or unexpected behavior
- If something fails, investigate before moving on — try to determine if it's a tool bug, an Obsidian API quirk, or a test design issue
- After all sections, summarize findings at the end

---

## 1. CRUD Lifecycle

### 1.1 Create → Read → Update → Delete

- Create `__test__lifecycle.md` with content `# Hello\n\nWorld.`
- Read it back (JSON format) — verify `content`, `frontmatter`, `stat` fields exist
- Read it back (markdown format) — verify raw markdown returned
- Update: append `\nMore content.` under heading `Hello`
- Read again — verify both "World." and "More content." present
- Delete the file
- Read again — verify error with "File not found"

### 1.2 Duplicate creation

- Create `__test__dup.md`
- Create `__test__dup.md` again — verify error with "already exists"
- Clean up

### 1.3 Operations on nonexistent files

- Read `__test__ghost.md` — verify error
- Update `__test__ghost.md` — verify error
- Delete `__test__ghost.md` — verify error

### 1.4 Directory behavior

- Create `__test__subdir/note.md` — verify error reports ENOENT (not "File already exists")
- Create `__test__dir_test.md`, then `vault_list` on root — verify the file appears in listing
- `vault_list` on `__nonexistent_dir__` — verify error
- `vault_list` on a file path (not a directory) — what happens?
- Clean up

### 1.5 Filename edge cases

- Create `__test__no_ext` (no .md extension) — does it succeed? Can it be read back?
- Create `__test__ spaces in name.md` — create, read, delete cycle
- Create `__test__UPPERCASE.md` — create, then try to read as `__test__uppercase.md` (case sensitivity check)
- Clean up all

### 1.6 Non-markdown files

- Create `__test__data.json` with content `{"key": "value"}` — does vault_create accept it?
- Read it back — what format is the response? Does JSON format parse frontmatter?
- Create `__test__plain.txt` — same questions
- Clean up

---

## 2. Heading Targeting

Setup: create `__test__headings.md` with:

```markdown
# Alpha

Alpha content.

## Beta

Beta content.

### Gamma

Gamma content.

## Delta

Delta content.

# Epsilon

## Beta

Beta under Epsilon (duplicate name).

## Zeta

Zeta content.

# Eta

### Skipped

H3 directly under H1, no H2.
```

### 2.1 Basic targeting

- Append to `Alpha` (h1, single-element target) — should succeed
- Append to `Beta` (h2, single-element target) — should fail (single-element = h1 only)
- Append to `Delta` (h2, single-element target) — should also fail (confirms h1-only rule)
- Append to `Alpha::Beta` — should succeed
- Append to `Alpha::Beta::Gamma` (3 levels deep) — should succeed
- Read file and verify all appended content is in the right places

### 2.2 Disambiguation

- Append to `Beta` (bare) — should fail (ambiguous: exists under Alpha and Epsilon)
- Append to `Alpha::Beta` — should succeed (disambiguated)
- Append to `Epsilon::Beta` — should succeed (disambiguated)
- Read file, verify content went to the correct Beta sections

### 2.3 Skipped heading levels

- Append to `Eta::Skipped` (h3 under h1, no h2 between) — should succeed

### 2.4 Operations

- Prepend to `Alpha::Delta` — verify content appears before "Delta content."
- Replace `Alpha::Delta` — verify old content gone, new content present
- Read full file, verify document structure is intact (no merged headings, no lost sections)

### 2.5 Newline handling

- Append `\nWith leading newline.` to `Alpha` — verify paragraph separation preserved
- Append `No leading newline.` to `Epsilon` — verify content merges directly with existing text (known behavior: no automatic separator)

### 2.6 createIfMissing

- Append to `Alpha::NewSection` with `createIfMissing: true` — should create `## NewSection` under Alpha
- Read file — verify heading exists with correct level and content
- **Regression check**: is there a blank line before the next heading? Attempt to target the heading that follows `NewSection` — if it fails with `invalid-target`, the trailing newline bug has corrupted the document structure
- Append to `Alpha::Nonexistent` without createIfMissing — should fail
- createIfMissing on a top-level heading: append to `NewTopLevel` with createIfMissing — does it create an h1?

### 2.7 Duplicate content prevention

- Append `\nSentinel text.` to `Epsilon::Zeta`
- Append `\nSentinel text.` to `Epsilon::Zeta` again — should fail with `content-already-preexists-in-target`
- Append `\nDifferent text.` to `Epsilon::Zeta` — should succeed
- Note: `applyIfContentPreexists` is hardcoded to `false` internally and not exposed as a tool parameter — callers cannot override duplicate prevention

### 2.8 Special characters in headings

- Create a file with heading `# Heading [with] (brackets)`
- Try to target it — document what happens (known: brackets may fail with `invalid-target`)
- Create a file with heading `# Special::Colon` (literal `::` in heading name)
- Try to target it — document what happens (known: `::` is always split, no escape sequence)
- Create a file with headings containing emoji: `# 🎯 Goals`, `## 日本語`
- Target `🎯 Goals` and `🎯 Goals::日本語` — should both work
- Clean up all test files

---

## 3. Block References

Setup: create `__test__blocks.md` with:

```markdown
# Blocks

First paragraph. ^block1

Second paragraph. ^block2

## Sub

Sub content. ^block3

No block ref here.
```

### 3.1 Basic operations

- Append to `block1` — verify content appears after the block1 paragraph
- Prepend to `block2` — verify content appears before the block2 paragraph
- Replace `block3` — verify old content replaced, `^block3` marker preserved

### 3.2 Error cases

- Target nonexistent block `noblock` — should fail
- Target `^block1` (with `^` prefix) — should fail (implementation passes target as-is; `^block1` won't match the internal ID `block1`)

### 3.3 createIfMissing

- Append to `newblock` with `createIfMissing: true` — verify `^newblock` marker created
- Where does the new block get placed? (end of file? end of current section?)

### 3.4 Duplicate content prevention

- Append `\nBlock sentinel.` to `block1`
- Append `\nBlock sentinel.` to `block1` again — should fail

Clean up.

---

## 4. Frontmatter via vault_update

Setup: create `__test__frontmatter.md` with:

```markdown
---
title: Test Note
tags:
  - alpha
  - beta
status: draft
count: 3
---

# Content

Body.
```

### 4.1 Replace scalar values

- Replace `status` with `"published"` — verify via read
- Replace `count` with `10` — verify it's stored as number, not string
- Replace `title` with `"Updated Title"` — verify

### 4.2 Replace with complex values

- Replace `tags` with `["alpha","beta","gamma"]` — verify array updated
- Replace `status` with `{"state":"published","date":"2026-03-21"}` — verify object stored

### 4.3 createIfMissing

- Replace `newfield` with `"hello"` and `createIfMissing: true` — verify field created
- Replace `priority` with `5` and `createIfMissing: true` — verify number
- Replace `archived` with `false` and `createIfMissing: true` — verify boolean (not string "false")
- Replace `missing` with `"value"` without createIfMissing — should fail

### 4.4 Append to arrays

- Append `["gamma"]` to `tags` — verify array extended, no duplicates
- Append `"scalar"` to `tags` (non-array to array field) — what happens?

### 4.5 Edge cases

- Dot notation: replace `status.sub` with `"nested"` and createIfMissing — document behavior (known: creates literal key `status.sub`, not nested path)
- Replace with invalid JSON: content `not valid json` — should fall back to storing as raw string
- Replace with empty string `""` — what happens?
- Replace with `null` — what happens?

### 4.6 Comparison with frontmatter_manage

- Set `status` to `"reviewed"` via `vault_update` (targetType: frontmatter, operation: replace)
- Set `status` to `"final"` via `frontmatter_manage` (action: set)
- Read back after each — verify both paths produce the same result structure
- Do they handle JSON parsing the same way? (both attempt JSON.parse with string fallback)

Clean up.

---

## 5. Frontmatter via frontmatter_manage

Setup: create `__test__fm_manage.md` with:

```markdown
---
title: FM Test
tags:
  - one
status: active
---

# Body

Content.
```

### 5.1 Read

- `frontmatter_manage` read — verify returns title, tags, status
- Verify `position` property is filtered out (internal Obsidian metadata)
- Check that no other internal Obsidian properties leak through

### 5.2 Set fields

- Set `title` to `"New Title"` — verify
- Set `priority` to `"5"` — does it store as number or string? (should be number via JSON.parse)
- Set `data` to `'{"key":"value"}'` — verify JSON parsed into object
- Set `flags` to `'[true, false]'` — verify array

### 5.3 Edge cases

- Set without `key` param — should error ("Key is required for set action")
- Set without `value` param — should error
- Read on a file with no frontmatter — what comes back? (implementation falls back to `{}` if cache is null)
- Set on a file with no frontmatter — does it create the `---` fences?

Clean up.

---

## 6. Tags

Setup: create `__test__tags.md` with:

```markdown
---
title: Tag Test
tags:
  - existing
  - another
---

# Content

Body with #inline-tag here.
```

### 6.1 List

- `tags_manage` list — verify returns frontmatter tags
- Verify no `#` prefix on returned tags
- Does it include `inline-tag` from the body, or only frontmatter tags?

### 6.2 Scalar tags

- Create `__test__tags_scalar.md` with `tags: single-tag` (string, not array)
- `tags_manage` list — what comes back?
- `tags_manage` add `["new-tag"]` — does it convert to array? Error?
- Clean up

### 6.3 Empty tags

- Create `__test__tags_empty.md` with `tags: []` (empty array)
- `tags_manage` list — returns `[]`?
- `tags_manage` add — works normally?
- Clean up

### 6.4 Add

- Add `["new-tag"]` — verify it appears in subsequent list
- Add `["existing"]` (duplicate) — should succeed as no-op, verify no duplicate in list
- Add `["#prefixed"]` (with `#`) — verify stored without `#`

### 6.5 Remove

- Remove `["new-tag"]` — verify gone from list
- Remove `["nonexistent-tag"]` — what happens? Error or silent no-op?

### 6.6 Error cases

- Add without `tags` param — should error ("Tags array is required for add/remove actions")
- Remove without `tags` param — should error
- List/add/remove on nonexistent file — should error

### 6.7 Interaction with vault_read

- Read file via `vault_read` (JSON format)
- Compare `tags` field (top-level) vs `frontmatter.tags`
- Verify `tags` contains inline tags (with `#`), `frontmatter.tags` contains frontmatter tags (without `#`)
- These are two different fields with different semantics — document clearly

Clean up.

---

## 7. Search

Setup: create `__test__search.md` with:

```markdown
---
title: Search Target
status: published
category: testing
---

# Search Test

This note contains unique_sentinel_mcp_test_xyz content.

Another paragraph with different words.
```

Wait ~1s for indexing.

### 7.1 Simple search

- Search `unique_sentinel_mcp_test_xyz` (simple) — should find the test file
- Verify result has `filename` and `score` fields
- Search `xyzzy_nonexistent_content_99999` — should return empty array, not error

### 7.2 Result shape

- Search `search` (simple) — likely multiple results
- Verify results sorted by score (most negative = best match first)
- Document the full result structure: what fields are on each result? Expected: `filename`, `score`, `matches[]` (each with `context`, `offset`?)

### 7.3 contextLength

- Search `unique_sentinel_mcp_test_xyz` with `contextLength: 10` — verify shorter context
- Search with `contextLength: 500` — verify longer context
- Search with `contextLength: 0` — what happens?
- Search with `contextLength: -1` — what happens?

### 7.4 Dataview (if installed)

- Run `TABLE title, status FROM "" WHERE status = "published"` as dataview query
- If Dataview not installed, verify clean error message ("Dataview plugin is not installed or enabled")
- If installed, verify test file appears in results
- Run `LIST FROM ""` as dataview — should error with "Only TABLE" message
- Run `TASK FROM ""` as dataview — should also error
- Run `TABLE WITHOUT ID title FROM ""` — should error with "TABLE WITHOUT ID queries are not supported"

### 7.5 Edge cases

- Empty query string `""` — error or empty results?
- Very long query (500+ chars) — what happens?
- Query with regex-like characters `[test](match)` — handled gracefully?

Clean up.

---

## 8. Active File

### 8.1 Setup

- Create `__test__active.md` with a heading and frontmatter
- Open it via `file_open`

### 8.2 Read

- `active_file_read` (JSON) — verify returns same data as `vault_read` for that file
- `active_file_read` (markdown) — verify raw content matches

### 8.3 Update

- `active_file_update`: append to a heading — verify change applied
- `active_file_update`: replace frontmatter field — verify
- Read back via both `active_file_read` and `vault_read` — results should match

### 8.4 Parity with vault_update

- Perform the same update via `active_file_update` and `vault_update` on separate files
- Verify identical behavior (both use `applyUpdate()` internally)

### 8.5 Edge cases

- `active_file_read` with no file open — should error ("No active file open")
- `active_file_update` with no file open — should error ("No active file open")
- Open a file, then delete it via `vault_delete`, then `active_file_read` — what happens?
- Open file A, then open file B (replacing tab), then `active_file_read` — returns file B?

Clean up.

---

## 9. Navigation

### 9.1 file_open basics

- `file_open` with existing file — should succeed
- `file_open` with `newLeaf: true` — should open in new tab
- `file_open` with `newLeaf: false` (default) — should replace current tab

### 9.2 Error handling

- `file_open` with nonexistent file — what happens? (known: implementation may return success regardless — no error handling in the tool)
- Verify the response structure on success — what does it return?

---

## 10. Commands

### 10.1 List

- `commands_list` — should return array of commands
- Verify each command has an `id` field
- Verify response structure — what other fields? (`name`?)
- Spot-check a few known commands (e.g., `editor:toggle-bold`, `app:open-settings`)

### 10.2 Execute

- Execute a safe, observable command (e.g., `editor:toggle-bold` while a file is open)
- Verify the response structure on success — what does it return?
- Execute nonexistent command `fake:command-id` — should error ("Command not found: fake:command-id")
- Execute command that requires context not present (e.g., editor command with no file open) — what happens?

---

## 11. Periodic Notes

> These tests depend on the Periodic Notes plugin (or core Daily Notes) being installed and configured.

### 11.1 Read

- `periodic_read` with period `daily` — what happens if today's note exists? Doesn't exist?
- Try each period type: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`
- Verify response format matches `vault_read`
- For unconfigured periods, verify error: "Periodic notes for {period} is not enabled"
- For configured period with no note, verify error: "No {period} note exists for the current period"

### 11.2 Update

- `periodic_update` with `daily`, append to a heading — does it auto-create the note? (expected: yes, unlike periodic_read which fails)
- Verify content was written
- Update with `createIfMissing: true` on a heading that doesn't exist in the daily note
- Try each period type that's configured

### 11.3 Edge cases

- What happens when Periodic Notes plugin is not installed?
- What happens when the plugin is installed but no template is configured for a period?
- `periodic_update` on a period that has no note — does it create from template or empty?

---

## 12. Cross-cutting Concerns

### 12.1 Metadata cache timing

- Create a file with frontmatter
- Immediately read frontmatter via `vault_read` (JSON) — is it populated or stale?
- Immediately read via `frontmatter_manage read` — same question
- Wait 500ms, read again — now populated?
- Document the minimum reliable delay between write and cache-dependent read

### 12.2 Concurrent operations

- Create two files in rapid succession — both succeed?
- Update two different files in rapid succession — both succeed?
- Update the same file twice in rapid succession (different content) — what happens? Race condition? Second wins?

### 12.3 Large content

- Create a file with a very large body (10,000+ chars) — succeeds?
- Read it back — complete content returned?
- Search for content within it — found?
- Update a heading in it — works?

### 12.4 Error response consistency

- Collect all error responses encountered during testing
- Verify consistent structure: `isError: true`, descriptive message
- Check that errors don't leak stack traces or internal paths
- Verify error messages are actionable (e.g., "File not found" not just "Error")

### 12.5 Patch error codes

Verify the following `PatchFailureReason` values surface correctly through the tool:

- `invalid-target` — targeting a heading/block that doesn't exist
- `content-already-preexists-in-target` — duplicate content prevention
- `content-type-invalid` — when does this trigger?
- `content-not-mergeable` — when does this trigger?
- `table-content-incorrect-column-count` — if table patching is ever used

---

## Findings

> Claude: summarize all findings here after running the tests. Group into:
>
> - **Bugs**: things that are broken
> - **Behavioral discoveries**: things that work but may surprise callers
> - **Confirmed behaviors**: things that work as expected/documented
> - **Tool description improvements**: where the tool schema/description should be clearer
