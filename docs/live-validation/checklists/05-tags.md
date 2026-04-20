# Area: Tags

## Tools covered

- `tags_manage`, `vault_create`, `vault_read` (assertions and semantics comparison)

## Setup

- **Action:** `vault_create` — path `sandbox/tags.md`, content:

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

- **Expected:** success.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. List

#### 1.1 List returns frontmatter tags

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `list`.
- **Expected:** success; returns an array containing `existing` and `another`.
- **Result:** _pass | fail_

#### 1.2 Returned tags have no `#` prefix

- **Action:** inspect the response from 1.1.
- **Expected:** none of the returned tag strings begin with `#`.
- **Result:** _pass | fail_

#### 1.3 Inline-tag inclusion

- **Action:** inspect the response from 1.1 for `inline-tag` (from the body).
- **Expected:** `tags_manage list` returns only the frontmatter tags (`existing`, `another`) and does NOT include `inline-tag`. Record the exact outcome.
- **Result:** _pass | fail_

### 2. Scalar tags (string-valued `tags:`)

Setup (extra):

- **Action:** `vault_create` — path `sandbox/tags_scalar.md`, content:

  ```markdown
  ---
  title: Scalar Tags
  tags: single-tag
  ---

  Body.
  ```

- **Expected:** success.

#### 2.1 List on scalar tags

- **Action:** `tags_manage` — path `sandbox/tags_scalar.md`, action `list`.
- **Expected:** success; returns an array containing `single-tag` (scalar coerced to single-element array in the response).
- **Result:** _pass | fail_

#### 2.2 Add converts scalar to array

- **Action:** `tags_manage` — path `sandbox/tags_scalar.md`, action `add`, tags `["new-tag"]`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) shows `frontmatter.tags` is an array containing both `single-tag` and `new-tag`.
- **Result:** _pass | fail_

### 3. Empty tags

Setup (extra):

- **Action:** `vault_create` — path `sandbox/tags_empty.md`, content:

  ```markdown
  ---
  title: Empty Tags
  tags: []
  ---

  Body.
  ```

- **Expected:** success.

#### 3.1 List on empty tags

- **Action:** `tags_manage` — path `sandbox/tags_empty.md`, action `list`.
- **Expected:** success; returns `[]`.
- **Result:** _pass | fail_

#### 3.2 Add to empty tags

- **Action:** `tags_manage` — path `sandbox/tags_empty.md`, action `add`, tags `["first"]`.
- **Expected:** success.
- **Assert:** `vault_read` (JSON) shows `frontmatter.tags === ["first"]`.
- **Result:** _pass | fail_

### 4. Add

#### 4.1 Add a new tag

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `add`, tags `["new-tag"]`.
- **Expected:** success.
- **Assert:** subsequent `tags_manage list` contains `new-tag`.
- **Result:** _pass | fail_

#### 4.2 Add duplicate is a no-op

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `add`, tags `["existing"]`.
- **Expected:** success.
- **Assert:** `tags_manage list` contains `existing` exactly once (no duplicate appears).
- **Result:** _pass | fail_

#### 4.3 `#`-prefixed input is stripped

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `add`, tags `["#prefixed"]`.
- **Expected:** success.
- **Assert:** `tags_manage list` contains `prefixed` (no `#`); does not contain `#prefixed` as a literal.
- **Result:** _pass | fail_

### 5. Remove

#### 5.1 Remove existing

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `remove`, tags `["new-tag"]`.
- **Expected:** success.
- **Assert:** `tags_manage list` does not contain `new-tag`.
- **Result:** _pass | fail_

#### 5.2 Remove nonexistent

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `remove`, tags `["nonexistent-tag"]`.
- **Expected:** success as a silent no-op (OR a clean error — record which).
- **Assert:** `tags_manage list` is unchanged from before the call.
- **Result:** _pass | fail_

### 6. Error cases

#### 6.1 Add without `tags` param

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `add` (omit `tags`).
- **Expected:** error; message contains `Tags array is required for add/remove actions`.
- **Result:** _pass | fail_

#### 6.2 Remove without `tags` param

- **Action:** `tags_manage` — path `sandbox/tags.md`, action `remove` (omit `tags`).
- **Expected:** error; message contains `Tags array is required`.
- **Result:** _pass | fail_

#### 6.3 List on nonexistent file

- **Action:** `tags_manage` — path `sandbox/does-not-exist.md`, action `list`.
- **Expected:** error; message indicates file not found.
- **Result:** _pass | fail_

#### 6.4 Add on nonexistent file

- **Action:** `tags_manage` — path `sandbox/does-not-exist.md`, action `add`, tags `["x"]`.
- **Expected:** error; message indicates file not found.
- **Result:** _pass | fail_

#### 6.5 Remove on nonexistent file

- **Action:** `tags_manage` — path `sandbox/does-not-exist.md`, action `remove`, tags `["x"]`.
- **Expected:** error; message indicates file not found.
- **Result:** _pass | fail_

### 7. Interaction with vault_read (inline vs frontmatter semantics)

#### 7.1 Compare top-level `tags` vs `frontmatter.tags`

- **Action:** `vault_read` — path `sandbox/tags.md`, format `json`.
- **Expected:** response contains both a top-level `tags` field and a `frontmatter.tags` field. Top-level `tags` contains inline tags found in the body (with `#` prefix, e.g., `#inline-tag`); `frontmatter.tags` contains frontmatter tags (without `#`, e.g., `existing`, `another`). These are two distinct fields with distinct semantics.
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on `sandbox/tags.md`, `sandbox/tags_scalar.md`, `sandbox/tags_empty.md`.
- **Expected:** each delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
