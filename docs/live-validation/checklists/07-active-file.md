# Area: Active File

## Tools covered

- `active_file_read`, `active_file_update`, `file_open` (setup only), `vault_create`, `vault_read`, `vault_update`, `vault_delete` (assertions / parity only)

## Setup

- **Action:** `vault_create` — path `sandbox/active.md`, content:

  ```markdown
  ---
  title: Active Test
  status: draft
  ---

  # Heading

  Body.
  ```

  Then `file_open` — path `sandbox/active.md`.

- **Expected:** file created; `file_open` succeeds; Obsidian's active file is now `sandbox/active.md`.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. Read

#### 1.1 Read JSON matches vault_read for same file

- **Action:** `active_file_read` — format `json`.
- **Expected:** success; returned object has `content`, `frontmatter`, `stat` fields.
- **Assert:** `vault_read` — path `sandbox/active.md`, format `json`. Compare: `content`, `frontmatter`, `stat.mtime` all equal between the two responses.
- **Result:** _pass | fail_

#### 1.2 Read markdown matches vault_read for same file

- **Action:** `active_file_read` — format `markdown`.
- **Expected:** success; raw markdown body returned.
- **Assert:** `vault_read` — path `sandbox/active.md`, format `markdown`. Both responses contain the same raw text.
- **Result:** _pass | fail_

### 2. Update

#### 2.1 Append under heading

- **Action:** `active_file_update` — targetType `heading`, target `Heading`, operation `append`, content `\nAppended to active.`
- **Expected:** success.
- **Assert:** `active_file_read` (markdown) contains `Appended to active.` under `# Heading`.
- **Result:** _pass | fail_

#### 2.2 Replace frontmatter field

- **Action:** `active_file_update` — targetType `frontmatter`, target `status`, operation `replace`, content `"published"`.
- **Expected:** success.
- **Assert:** `active_file_read` (JSON) shows `frontmatter.status === "published"`.
- **Result:** _pass | fail_

#### 2.3 Reads match between active_file_read and vault_read after update

- **Action:** `active_file_read` (JSON) and `vault_read` — path `sandbox/active.md`, format `json`.
- **Expected:** both responses have identical `content` and `frontmatter` fields reflecting the updates from 2.1 and 2.2.
- **Result:** _pass | fail_

### 3. Parity with vault_update

Setup (extra):

- **Action:** `vault_create` — path `sandbox/active-parity-a.md`, content `# H\n\nBody.\n`. Then `vault_create` — path `sandbox/active-parity-b.md`, content `# H\n\nBody.\n`. Then `file_open` — path `sandbox/active-parity-a.md`.
- **Expected:** both files exist; `sandbox/active-parity-a.md` is active.

#### 3.1 Same operation via active_file_update and vault_update

- **Action:** `active_file_update` — targetType `heading`, target `H`, operation `append`, content `\nParity.` Then `vault_update` — path `sandbox/active-parity-b.md`, targetType `heading`, target `H`, operation `append`, content `\nParity.`
- **Expected:** both succeed.
- **Assert:** `vault_read` (markdown) on both paths returns bodies that differ only by filename/path — the textual changes under `# H` are identical.
- **Result:** _pass | fail_

### 4. No-active-file errors

Setup (extra):

- **Action:** Operator closes all open files in Obsidian so no file is active. (If no direct tool exists, use `commands_execute` with a command that closes tabs, or have the operator close manually.) Confirm via the Obsidian UI that no file is focused.
- **Expected:** no active file.

#### 4.1 active_file_read with no active file

- **Action:** `active_file_read` — format `json`.
- **Expected:** error; message contains `No active file open` (or equivalent).
- **Result:** _pass | fail_

#### 4.2 active_file_update with no active file

- **Action:** `active_file_update` — targetType `heading`, target `Anything`, operation `append`, content `x`.
- **Expected:** error; message contains `No active file open`.
- **Result:** _pass | fail_

### 5. Active-file state transitions

Setup (extra):

- **Action:** `file_open` — path `sandbox/active.md`.
- **Expected:** file A is active again.

#### 5.1 Read after delete of active file

- **Action:** `vault_delete` — path `sandbox/active.md`. Then `active_file_read` — format `json`.
- **Expected:** either (a) error indicating no active file, or (b) error indicating the underlying file cannot be read. Record which; either is acceptable. Tool must not crash or return stale content.
- **Result:** _pass | fail_

#### 5.2 Switching active file via file_open

- **Action:** `vault_create` — path `sandbox/active-b.md`, content `# B\n\nB body.\n`. Then `file_open` — path `sandbox/active-b.md`. Then `active_file_read` — format `markdown`.
- **Expected:** success; returned markdown is the content of `sandbox/active-b.md` (contains `B body.`), not the prior active file.
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on `sandbox/active.md` (if still present), `sandbox/active-parity-a.md`, `sandbox/active-parity-b.md`, `sandbox/active-b.md`.
- **Expected:** each delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
