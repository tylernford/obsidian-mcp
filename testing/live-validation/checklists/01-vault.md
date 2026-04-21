# Area: Vault Lifecycle

## Tools covered

- `vault_create`, `vault_read`, `vault_update`, `vault_delete`, `vault_list`

## Setup

- **Action:** none — each test section below creates its own files under `sandbox/`.
- **Expected:** `sandbox/` exists (or is creatable). Test vault has been reset with `git reset --hard && git clean -fd`.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. Create → Read → Update → Delete

#### 1.1 Create a file

- **Action:** `vault_create` — path `sandbox/lifecycle.md`, content `# Hello\n\nWorld.`
- **Expected:** tool returns success; no error.
- **Assert:** `vault_read` at same path (JSON) returns content matching input; `content`, `frontmatter`, `stat` fields all present.
- **Result:** _pass | fail — <one-line observation if fail>_

#### 1.2 Read as markdown

- **Action:** `vault_read` — path `sandbox/lifecycle.md`, format `markdown`.
- **Expected:** raw markdown returned; body equals `# Hello\n\nWorld.`; no JSON wrapper.
- **Result:** _pass | fail_

#### 1.3 Update body under heading

- **Action:** `vault_update` — path `sandbox/lifecycle.md`, targetType `heading`, target `Hello`, operation `append`, content `\nMore content.`
- **Expected:** tool returns success.
- **Assert:** `vault_read` (markdown) contains both `World.` and `More content.`.
- **Result:** _pass | fail_

#### 1.4 Delete the file

- **Action:** `vault_delete` — path `sandbox/lifecycle.md`.
- **Expected:** tool returns success.
- **Assert:** `vault_read` at same path fails with an error whose message contains `File not found` (or equivalent not-found indicator).
- **Result:** _pass | fail_

### 2. Duplicate creation

#### 2.1 First create succeeds

- **Action:** `vault_create` — path `sandbox/dup.md`, content `dup`.
- **Expected:** success.
- **Result:** _pass | fail_

#### 2.2 Re-create same path fails

- **Action:** `vault_create` — path `sandbox/dup.md`, content `dup2`.
- **Expected:** error; message contains `already exists`.
- **Result:** _pass | fail_

### 3. Operations on nonexistent files

#### 3.1 Read nonexistent

- **Action:** `vault_read` — path `sandbox/ghost.md`.
- **Expected:** error; message indicates file not found.
- **Result:** _pass | fail_

#### 3.2 Update nonexistent

- **Action:** `vault_update` — path `sandbox/ghost.md`, targetType `heading`, target `Any`, operation `append`, content `x`.
- **Expected:** error; message indicates file not found.
- **Result:** _pass | fail_

#### 3.3 Delete nonexistent

- **Action:** `vault_delete` — path `sandbox/ghost.md`.
- **Expected:** error; message indicates file not found.
- **Result:** _pass | fail_

### 4. Directory behavior

#### 4.1 Create in nonexistent subdir

- **Action:** `vault_create` — path `sandbox/subdir/note.md`, content `x`.
- **Expected:** error whose message references `ENOENT` or missing parent directory (not `File already exists`).
- **Result:** _pass | fail_

#### 4.2 Listing surfaces newly created file

- **Action:** `vault_create` — path `sandbox/dir_test.md`, content `x`. Then `vault_list` — path `sandbox`.
- **Expected:** `vault_list` returns an array containing `dir_test.md` (or `sandbox/dir_test.md` depending on listing convention).
- **Result:** _pass | fail_

#### 4.3 List nonexistent directory

- **Action:** `vault_list` — path `sandbox/nonexistent_dir`.
- **Expected:** error; message indicates directory not found.
- **Result:** _pass | fail_

#### 4.4 List a file path

- **Action:** `vault_list` — path `sandbox/dir_test.md`.
- **Expected:** error; message indicates path is not a directory (or equivalent). Record the exact message on fail.
- **Result:** _pass | fail_

### 5. Filename edge cases

#### 5.1 No extension

- **Action:** `vault_create` — path `sandbox/no_ext`, content `x`.
- **Expected:** success.
- **Assert:** `vault_read` — path `sandbox/no_ext` returns the content.
- **Result:** _pass | fail_

#### 5.2 Spaces in name

- **Action:** `vault_create` — path `sandbox/spaces in name.md`, content `x`. Then `vault_read` at same path. Then `vault_delete` at same path.
- **Expected:** create, read, and delete all succeed.
- **Result:** _pass | fail_

#### 5.3 Case sensitivity

- **Action:** `vault_create` — path `sandbox/UPPERCASE.md`, content `x`. Then `vault_read` — path `sandbox/uppercase.md`.
- **Expected:** create succeeds. Second `vault_read` either returns the same file (case-insensitive filesystem) or errors with file-not-found (case-sensitive filesystem). Record which.
- **Result:** _pass | fail_

### 6. Non-markdown files

#### 6.1 JSON file

- **Action:** `vault_create` — path `sandbox/data.json`, content `{"key": "value"}`.
- **Expected:** success.
- **Assert:** `vault_read` (markdown) returns the raw JSON text unchanged.
- **Result:** _pass | fail_

#### 6.2 Plain text file

- **Action:** `vault_create` — path `sandbox/plain.txt`, content `plain text`.
- **Expected:** success.
- **Assert:** `vault_read` (markdown) returns `plain text` unchanged.
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on each file created above that still exists (best effort).
- **Expected:** each delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
