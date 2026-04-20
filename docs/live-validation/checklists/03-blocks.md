# Area: Block Reference Targeting

## Tools covered

- `vault_update` (block targetType), `vault_create`, `vault_read` (assertions only)

## Setup

- **Action:** `vault_create` — path `sandbox/blocks.md`, content:

  ```markdown
  # Blocks

  First paragraph. ^block1

  Second paragraph. ^block2

  ## Sub

  Sub content. ^block3

  No block ref here.
  ```

- **Expected:** success.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. Basic operations

#### 1.1 Append to block

- **Action:** `vault_update` — path `sandbox/blocks.md`, targetType `block`, target `block1`, operation `append`, content `\nAppended after block1.`
- **Expected:** success.
- **Assert:** `vault_read` (markdown) shows `Appended after block1.` immediately following the `First paragraph. ^block1` paragraph.
- **Result:** _pass | fail_

#### 1.2 Prepend to block

- **Action:** `vault_update` — target `block2`, operation `prepend`, content `Prepended before block2.\n`.
- **Expected:** success.
- **Assert:** `vault_read` shows `Prepended before block2.` appears before `Second paragraph. ^block2`.
- **Result:** _pass | fail_

#### 1.3 Replace block content

- **Action:** `vault_update` — target `block3`, operation `replace`, content `Replaced block3 content.`
- **Expected:** success.
- **Assert:** `vault_read` shows `Replaced block3 content.` under `## Sub`, and the `^block3` marker is still attached to that line (not lost).
- **Result:** _pass | fail_

### 2. Error cases

#### 2.1 Nonexistent block

- **Action:** `vault_update` — target `noblock`, operation `append`, content `x`.
- **Expected:** error (`invalid-target` or equivalent).
- **Result:** _pass | fail_

#### 2.2 Target with leading `^`

- **Action:** `vault_update` — target `^block1`, operation `append`, content `x`.
- **Expected:** error — the implementation passes the target as-is, so `^block1` does not match the internal id `block1`.
- **Result:** _pass | fail_

### 3. createIfMissing

#### 3.1 Create a new block

- **Action:** `vault_update` — target `newblock`, operation `append`, content `New block body.`, `createIfMissing: true`.
- **Expected:** success.
- **Assert:** `vault_read` shows a line containing `New block body.` with `^newblock` attached. Record the placement (file end vs. section end) in Result notes.
- **Result:** _pass | fail_

#### 3.2 Missing block without createIfMissing

- **Action:** `vault_update` — target `anothernew`, operation `append`, content `x`.
- **Expected:** error (`invalid-target` or equivalent); no new block created.
- **Assert:** `vault_read` does not contain `^anothernew`.
- **Result:** _pass | fail_

### 4. Duplicate content prevention

#### 4.1 First insertion succeeds

- **Action:** `vault_update` — target `block1`, operation `append`, content `\nBlock sentinel.`
- **Expected:** success.
- **Result:** _pass | fail_

#### 4.2 Exact repeat is rejected

- **Action:** `vault_update` — target `block1`, operation `append`, content `\nBlock sentinel.`
- **Expected:** error; failure reason `content-already-preexists-in-target` (or message containing that phrase).
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on `sandbox/blocks.md`.
- **Expected:** delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
