# Area: Frontmatter

## Tools covered

- `vault_update` (frontmatter targetType), `frontmatter_manage`, `vault_create`, `vault_read` (assertions only)

## Setup

- **Action:** `vault_create` — path `sandbox/frontmatter.md`, content:

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

- **Expected:** success.

  Then `vault_create` — path `sandbox/fm_manage.md`, content:

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

- **Expected:** success.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. vault_update frontmatter — replace scalar

#### 1.1 Replace string scalar

- **Action:** `vault_update` — path `sandbox/frontmatter.md`, targetType `frontmatter`, target `status`, operation `replace`, content `"published"`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) returns `frontmatter.status === "published"`.
- **Result:** _pass | fail_

#### 1.2 Replace number scalar

- **Action:** `vault_update` — target `count`, operation `replace`, content `10`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) returns `frontmatter.count === 10` (number type, not string).
- **Result:** _pass | fail_

#### 1.3 Replace title

- **Action:** `vault_update` — target `title`, operation `replace`, content `"Updated Title"`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) returns `frontmatter.title === "Updated Title"`.
- **Result:** _pass | fail_

### 2. vault_update frontmatter — complex values

#### 2.1 Replace with array

- **Action:** `vault_update` — target `tags`, operation `replace`, content `["alpha","beta","gamma"]`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) returns `frontmatter.tags` as array `["alpha","beta","gamma"]`.
- **Result:** _pass | fail_

#### 2.2 Replace with object

- **Action:** `vault_update` — target `status`, operation `replace`, content `{"state":"published","date":"2026-03-21"}`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) returns `frontmatter.status` as an object equal to `{state:"published",date:"2026-03-21"}`.
- **Result:** _pass | fail_

### 3. vault_update frontmatter — createIfMissing

#### 3.1 New string field

- **Action:** `vault_update` — target `newfield`, operation `replace`, content `"hello"`, `createIfMissing: true`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) shows `frontmatter.newfield === "hello"`.
- **Result:** _pass | fail_

#### 3.2 New number field

- **Action:** `vault_update` — target `priority`, operation `replace`, content `5`, `createIfMissing: true`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) shows `frontmatter.priority === 5` as number.
- **Result:** _pass | fail_

#### 3.3 New boolean field

- **Action:** `vault_update` — target `archived`, operation `replace`, content `false`, `createIfMissing: true`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) shows `frontmatter.archived === false` (boolean, not string).
- **Result:** _pass | fail_

#### 3.4 Missing field without createIfMissing

- **Action:** `vault_update` — target `missing`, operation `replace`, content `"value"`.
- **Expected:** error.
- **Result:** _pass | fail_

### 4. vault_update frontmatter — append to arrays

#### 4.1 Append array to array

- **Action:** `vault_update` — target `tags`, operation `append`, content `["gamma"]`.
- **Expected:** success; `tags` array extended; existing `gamma` is not duplicated.
- **Assert:** `vault_read` (JSON) shows `frontmatter.tags` contains `gamma` exactly once.
- **Result:** _pass | fail_

#### 4.2 Append scalar to array field

- **Action:** `vault_update` — target `tags`, operation `append`, content `"scalar"`.
- **Expected:** either (a) success — `scalar` added to the array, or (b) error — scalar-to-array rejected. Record which and the exact outcome.
- **Result:** _pass | fail_

### 5. vault_update frontmatter — edge cases

#### 5.1 Dot-notation target

- **Action:** `vault_update` — target `status.sub`, operation `replace`, content `"nested"`, `createIfMissing: true`.
- **Expected:** success; a top-level key named literally `status.sub` is created (dot-notation is NOT interpreted as a nested path).
- **Assert:** `vault_read` (JSON) shows `frontmatter["status.sub"] === "nested"`; `frontmatter.status` retains its prior value unchanged.
- **Result:** _pass | fail_

#### 5.2 Invalid JSON falls back to raw string

- **Action:** `vault_update` — target `newraw`, operation `replace`, content `not valid json`, `createIfMissing: true`.
- **Expected:** success; value stored as the raw string `not valid json`.
- **Assert:** `vault_read` (JSON) shows `frontmatter.newraw === "not valid json"`.
- **Result:** _pass | fail_

#### 5.3 Empty string

- **Action:** `vault_update` — target `title`, operation `replace`, content `""`.
- **Expected:** success; `title` stored as empty string.
- **Assert:** `vault_read` (JSON) shows `frontmatter.title === ""`.
- **Result:** _pass | fail_

#### 5.4 Null value

- **Action:** `vault_update` — target `status`, operation `replace`, content `null`.
- **Expected:** success; `status` stored as null.
- **Assert:** `vault_read` (JSON) shows `frontmatter.status === null` (or YAML null equivalent).
- **Result:** _pass | fail_

### 6. vault_update ↔ frontmatter_manage parity

#### 6.1 Set via vault_update

- **Action:** `vault_update` — target `status`, operation `replace`, content `"reviewed"`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) shows `frontmatter.status === "reviewed"`.
- **Result:** _pass | fail_

#### 6.2 Set via frontmatter_manage

- **Action:** `frontmatter_manage` — path `sandbox/frontmatter.md`, action `set`, key `status`, value `"final"`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) shows `frontmatter.status === "final"`.
- **Result:** _pass | fail_

#### 6.3 Both paths produce equivalent shape

- **Action:** Compare the two `vault_read` responses from 6.1 and 6.2.
- **Expected:** the frontmatter object differs only in `status` value; no structural difference (ordering, types) attributable to which write tool was used.
- **Result:** _pass | fail_

### 7. frontmatter_manage — read

#### 7.1 Read returns expected fields

- **Action:** `frontmatter_manage` — path `sandbox/fm_manage.md`, action `read`.
- **Expected:** returns an object containing `title`, `tags`, `status` with the values from setup.
- **Result:** _pass | fail_

#### 7.2 Internal properties filtered

- **Action:** inspect the response from 7.1.
- **Expected:** no `position` property present; no other Obsidian-internal keys (e.g. `$$`, `_`) leaking into the result.
- **Result:** _pass | fail_

### 8. frontmatter_manage — set

#### 8.1 Set string

- **Action:** `frontmatter_manage` — path `sandbox/fm_manage.md`, action `set`, key `title`, value `"New Title"`.
- **Expected:** success.
- **Assert:** subsequent `frontmatter_manage read` shows `title === "New Title"`.
- **Result:** _pass | fail_

#### 8.2 Numeric string coerced to number

- **Action:** `frontmatter_manage` — action `set`, key `priority`, value `"5"`.
- **Expected:** success; value stored as number `5` (JSON.parse on the string).
- **Assert:** `frontmatter_manage read` shows `priority === 5` as number.
- **Result:** _pass | fail_

#### 8.3 JSON-string coerced to object

- **Action:** `frontmatter_manage` — action `set`, key `data`, value `'{"key":"value"}'`.
- **Expected:** success; stored as object `{key:"value"}`.
- **Assert:** `frontmatter_manage read` shows `data` equals `{key:"value"}`.
- **Result:** _pass | fail_

#### 8.4 JSON-string coerced to array

- **Action:** `frontmatter_manage` — action `set`, key `flags`, value `'[true, false]'`.
- **Expected:** success; stored as array `[true, false]`.
- **Assert:** `frontmatter_manage read` shows `flags` equals `[true, false]`.
- **Result:** _pass | fail_

### 9. frontmatter_manage — error cases

#### 9.1 Set without key

- **Action:** `frontmatter_manage` — action `set`, value `"x"` (omit `key`).
- **Expected:** error; message contains `Key is required for set action`.
- **Result:** _pass | fail_

#### 9.2 Set without value

- **Action:** `frontmatter_manage` — action `set`, key `foo` (omit `value`).
- **Expected:** error.
- **Result:** _pass | fail_

#### 9.3 Read on file with no frontmatter

- **Action:** `vault_create` — path `sandbox/nofm.md`, content `# Just a heading\n\nNo frontmatter here.\n`. Then `frontmatter_manage` — path `sandbox/nofm.md`, action `read`.
- **Expected:** success; returns `{}`.
- **Result:** _pass | fail_

#### 9.4 Set on file with no frontmatter

- **Action:** `frontmatter_manage` — path `sandbox/nofm.md`, action `set`, key `title`, value `"Added"`.
- **Expected:** success; `---` fences are created at the top of the file with `title: Added`.
- **Assert:** `vault_read` (markdown) shows the file now starts with a frontmatter block containing `title: Added`.
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on `sandbox/frontmatter.md`, `sandbox/fm_manage.md`, `sandbox/nofm.md`.
- **Expected:** each delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
