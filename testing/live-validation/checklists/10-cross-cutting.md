# Area: Cross-cutting Concerns

## Tools covered

- `vault_create`, `vault_read`, `vault_update`, `vault_delete`, `frontmatter_manage`, `search` (as triggers for cross-cutting behaviors)

## Setup

- **Action:** none — each test section creates its own files.
- **Expected:** `sandbox/` is writable.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. Metadata-cache timing

#### 1.1 Immediate vault_read after create

- **Action:** `vault_create` — path `sandbox/cache.md`, content:

  ```markdown
  ---
  title: Cache Test
  status: draft
  ---

  # Body
  ```

  Then immediately (no delay) `vault_read` — path `sandbox/cache.md`, format `json`.

- **Expected:** success; `content` contains the body; `frontmatter.title === "Cache Test"` and `frontmatter.status === "draft"`.
- **Result:** _pass | fail — record whether `frontmatter` was populated or missing/stale_

#### 1.2 Immediate frontmatter_manage read after create

- **Action:** `vault_create` — path `sandbox/cache2.md`, content identical to 1.1. Then immediately `frontmatter_manage` — path `sandbox/cache2.md`, action `read`.
- **Expected:** success; returned object contains `title === "Cache Test"` and `status === "draft"`.
- **Result:** _pass | fail — record whether frontmatter was populated or came back as `{}`_

#### 1.3 After 500ms delay

- **Action:** `vault_create` — path `sandbox/cache3.md`, content identical to 1.1. Wait ~500ms. Then `vault_read` — path `sandbox/cache3.md`, format `json`, and `frontmatter_manage` — path `sandbox/cache3.md`, action `read`.
- **Expected:** both calls return populated frontmatter.
- **Result:** _pass | fail — if either is still empty, the 500ms delay is insufficient; record the observation_

### 2. Concurrent operations

#### 2.1 Two creates on different paths back-to-back

- **Action:** issue two `vault_create` calls back-to-back (no await between): path `sandbox/concur-a.md` / content `A` and path `sandbox/concur-b.md` / content `B`.
- **Expected:** both succeed.
- **Assert:** `vault_read` on both paths returns the respective content.
- **Result:** _pass | fail_

#### 2.2 Two updates on different paths back-to-back

- **Action:** setup — `vault_create` at `sandbox/concur-u1.md` with `# H\n\nBody.\n` and at `sandbox/concur-u2.md` with the same. Then issue two `vault_update` calls back-to-back: both with targetType `heading`, target `H`, operation `append`, content `\nConcur.` on the two paths.
- **Expected:** both succeed.
- **Assert:** `vault_read` on both paths shows `Concur.` appended under `# H`.
- **Result:** _pass | fail_

#### 2.3 Two updates on the same file back-to-back

- **Action:** setup — `vault_create` at `sandbox/concur-same.md` with `# H\n\nBody.\n`. Then issue two `vault_update` calls back-to-back, both with targetType `heading`, target `H`, operation `append`: first content `\nFirst.`, second content `\nSecond.`
- **Expected:** either (a) both succeed and the final file contains both `First.` and `Second.` under `# H`, or (b) one fails cleanly with an error (no crash; no silent data loss).
- **Assert:** `vault_read` — path `sandbox/concur-same.md`, format `markdown` — record the final content.
- **Result:** _pass | fail — record which outcome and the exact final content_

### 3. Large content

#### 3.1 Create large file

- **Action:** `vault_create` — path `sandbox/large.md`, content a body of ~10,000 characters (e.g., the string `lorem ipsum dolor sit amet ` repeated ~370 times preceded by `# Large\n\n`).
- **Expected:** success.
- **Result:** _pass | fail_

#### 3.2 Read large file

- **Action:** `vault_read` — path `sandbox/large.md`, format `markdown`.
- **Expected:** returned `content` length equals the originally written length; no truncation.
- **Result:** _pass | fail_

#### 3.3 Search within large content

- **Action:** embed a unique sentinel (e.g., `sentinel_large_xyz`) inside the body written in 3.1, wait ~1s, then `search` — query `sentinel_large_xyz`, type `simple`.
- **Expected:** success; results contain `sandbox/large.md`.
- **Result:** _pass | fail_

#### 3.4 Update a heading in large file

- **Action:** `vault_update` — path `sandbox/large.md`, targetType `heading`, target `Large`, operation `append`, content `\nAppended.`
- **Expected:** success.
- **Assert:** `vault_read` shows `Appended.` under `# Large`.
- **Result:** _pass | fail_

### 4. Error response consistency

#### 4.1 Errors carry isError flag

- **Action:** trigger an error via `vault_read` — path `sandbox/does-not-exist.md`.
- **Expected:** response has `isError: true` and a non-empty, descriptive error message string.
- **Result:** _pass | fail_

#### 4.2 Errors don't leak internals

- **Action:** inspect the error response from 4.1.
- **Expected:** message does not contain a JS stack trace, internal absolute filesystem paths (e.g., paths containing `/Users/`, `/home/`, or the plugin's internal module paths), or raw `Error:` wrapper artifacts.
- **Result:** _pass | fail_

#### 4.3 Errors are actionable

- **Action:** inspect the error response from 4.1.
- **Expected:** message indicates the file was not found (e.g., contains `not found` or `File not found`), not a generic `Error` or opaque string.
- **Result:** _pass | fail_

### 5. Patch error codes surface correctly

Setup (extra):

- **Action:** `vault_create` — path `sandbox/patch-codes.md`, content:

  ```markdown
  # Alpha

  Alpha body. ^b1

  ## Beta

  Beta body.
  ```

- **Expected:** success.

#### 5.1 invalid-target (nonexistent heading)

- **Action:** `vault_update` — path `sandbox/patch-codes.md`, targetType `heading`, target `NoSuchHeading`, operation `append`, content `x`.
- **Expected:** error; response surfaces `invalid-target` as the failure reason (or message contains `invalid-target`).
- **Result:** _pass | fail_

#### 5.2 content-already-preexists-in-target

- **Action:** `vault_update` — target `Alpha::Beta`, operation `append`, content `\nDupe.` (first call; expected success). Then repeat the same call.
- **Expected on the second call:** error; response surfaces `content-already-preexists-in-target` (or message contains that phrase).
- **Result:** _pass | fail_

#### 5.3 content-type-invalid

- **Action:** `vault_update` — path `sandbox/patch-codes.md`, targetType `frontmatter`, target `tags`, operation `append`, content `[invalid json here`, `createIfMissing: true` (or similar combination chosen to violate the frontmatter value's expected structure).
- **Expected:** error; response surfaces `content-type-invalid` (or message contains that phrase). If this tool path is not observable as `content-type-invalid`, record which failure reason is surfaced instead.
- **Result:** _pass | fail_

#### 5.4 content-not-mergeable

- **Action:** `vault_update` — path `sandbox/patch-codes.md`, targetType `block`, target `b1`, operation `replace`, content `# Heading inside block replacement\n\nWith a sub-paragraph.` (a multi-block replacement that cannot be merged into a single block reference).
- **Expected:** error; response surfaces `content-not-mergeable` (or message contains that phrase). If a different reason is surfaced, record which.
- **Result:** _pass | fail_

#### 5.5 table-content-incorrect-column-count

- **Action:** setup a file with a markdown table at `sandbox/patch-table.md`, content `| A | B |\n|---|---|\n| 1 | 2 |\n` then `vault_update` on that file targeting the table with content whose column count does not match (e.g., operation `replace`, content `| 1 | 2 | 3 |`). If the tool does not expose a table-targeting operation, skip.
- **Expected:** if table patching is exposed: error; response surfaces `table-content-incorrect-column-count`. If not exposed: record as `skipped — table patching not available`.
- **Result:** _pass | fail | skipped_

## Teardown

- **Action:** `vault_delete` on `sandbox/cache.md`, `sandbox/cache2.md`, `sandbox/cache3.md`, `sandbox/concur-a.md`, `sandbox/concur-b.md`, `sandbox/concur-u1.md`, `sandbox/concur-u2.md`, `sandbox/concur-same.md`, `sandbox/large.md`, `sandbox/patch-codes.md`, `sandbox/patch-table.md`.
- **Expected:** each delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
