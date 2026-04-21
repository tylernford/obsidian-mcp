# Area: Navigation + Commands

## Tools covered

- `file_open`, `commands_list`, `commands_execute`, `vault_create`, `active_file_read`, `vault_delete` (assertions only)

## Setup

- **Action:** `vault_create` — path `sandbox/nav.md`, content `# Nav\n\nBody.\n`. Then `vault_create` — path `sandbox/nav-b.md`, content `# Nav B\n\nOther body.\n`.
- **Expected:** both files created.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. file_open basics

#### 1.1 Open existing file (default newLeaf)

- **Action:** `file_open` — path `sandbox/nav.md`.
- **Expected:** success.
- **Assert:** `active_file_read` (markdown) returns content of `sandbox/nav.md` (contains `# Nav`).
- **Result:** _pass | fail — record the exact response shape (what fields are on the return object)_

#### 1.2 Open in new tab (newLeaf: true)

- **Action:** `file_open` — path `sandbox/nav-b.md`, `newLeaf: true`.
- **Expected:** success; `sandbox/nav-b.md` is now active.
- **Assert:** `active_file_read` (markdown) contains `# Nav B`. Operator visually confirms a new tab was opened (prior tab still exists).
- **Result:** _pass | fail_

#### 1.3 Open replacing current tab (newLeaf: false)

- **Action:** `file_open` — path `sandbox/nav.md`, `newLeaf: false`.
- **Expected:** success; `sandbox/nav.md` is active in the previously-focused tab (no new tab opened).
- **Assert:** `active_file_read` (markdown) contains `# Nav`. Operator visually confirms no new tab was opened.
- **Result:** _pass | fail_

### 2. file_open error handling

#### 2.1 Nonexistent file

- **Action:** `file_open` — path `sandbox/does-not-exist.md`.
- **Expected:** either (a) error indicating file not found (ideal), or (b) success with no actual file opened (known: implementation may return success without error handling). Record which, and record the exact response shape.
- **Assert:** `active_file_read` — record whether the active file changed or not.
- **Result:** _pass | fail_

### 3. commands_list

#### 3.1 List returns array

- **Action:** `commands_list`.
- **Expected:** success; returns an array.
- **Result:** _pass | fail_

#### 3.2 Each command has an id

- **Action:** inspect response from 3.1.
- **Expected:** every entry is an object with a non-empty `id` string field. Record the full set of keys present on each entry (e.g., `id`, `name`).
- **Result:** _pass | fail — note the keys observed_

#### 3.3 Known commands present

- **Action:** inspect response from 3.1 for entries with `id === "editor:toggle-bold"` and `id === "app:open-settings"`.
- **Expected:** both entries are present.
- **Result:** _pass | fail_

### 4. commands_execute

Setup (extra):

- **Action:** `file_open` — path `sandbox/nav.md` (ensure a file is active for editor commands).
- **Expected:** `sandbox/nav.md` is active.

#### 4.1 Execute a safe, observable command

- **Action:** `commands_execute` — id `editor:toggle-bold`.
- **Expected:** success. Record the exact response shape.
- **Result:** _pass | fail — note the response shape_

#### 4.2 Execute nonexistent command

- **Action:** `commands_execute` — id `fake:command-id`.
- **Expected:** error; message contains `Command not found: fake:command-id`.
- **Result:** _pass | fail_

#### 4.3 Execute editor command with no file open

Setup (extra): operator closes all open files so no file is active.

- **Action:** `commands_execute` — id `editor:toggle-bold`.
- **Expected:** either (a) error indicating no editor context, or (b) success with no side effect. Record which and the exact response.
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on `sandbox/nav.md`, `sandbox/nav-b.md`.
- **Expected:** each delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
