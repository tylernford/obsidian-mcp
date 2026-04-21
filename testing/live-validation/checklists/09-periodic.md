# Area: Periodic Notes

## Tools covered

- `periodic_read`, `periodic_update`, `vault_read` (assertions only)

## Prerequisites

- The Periodic Notes community plugin (or core Daily Notes) is installed and enabled.
- At least `daily` is configured. If `weekly`, `monthly`, `quarterly`, or `yearly` periods are not configured in the operator's test vault, items targeting those periods must still run and are expected to error with the `not enabled` message.
- Periodic note paths are determined by plugin config; checklist items therefore assert content behavior, not exact paths.

## Setup

- **Action:** none — tests create/read their own periodic notes. Before starting, confirm via the Obsidian UI which periods are configured in the test vault and record that list in the session report.
- **Expected:** at least `daily` is configured.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. Read — configured period, note may or may not exist

#### 1.1 Daily when today's note does not yet exist

> Precondition: today's daily note does not exist. If it does, operator deletes it before running this item (via Obsidian UI or `vault_delete` on the current daily path), then proceeds.

- **Action:** `periodic_read` — period `daily`.
- **Expected:** error; message contains `No daily note exists for the current period`.
- **Result:** _pass | fail_

#### 1.2 Daily when today's note exists

> Run item 2.1 first to create today's daily note.

- **Action:** `periodic_read` — period `daily`.
- **Expected:** success; response shape matches `vault_read` (i.e., returns an object with `content`, `frontmatter`, `stat` fields).
- **Result:** _pass | fail_

### 2. Update — auto-creates the note

#### 2.1 Append to heading when note does not exist

> Precondition: today's daily note does not exist.

- **Action:** `periodic_update` — period `daily`, targetType `heading`, target `Log`, operation `append`, content `\nEntry from periodic_update.`, `createIfMissing: true`.
- **Expected:** success; today's daily note is auto-created (unlike `periodic_read`, which errors when the note is missing).
- **Assert:** `periodic_read` — period `daily` — succeeds and its `content` contains `Entry from periodic_update.` under a `Log` heading.
- **Result:** _pass | fail_

#### 2.2 Append to an existing note

- **Action:** `periodic_update` — period `daily`, targetType `heading`, target `Log`, operation `append`, content `\nSecond entry.`
- **Expected:** success; note is updated in place (not replaced).
- **Assert:** `periodic_read` — period `daily` — `content` contains both `Entry from periodic_update.` and `Second entry.`.
- **Result:** _pass | fail_

#### 2.3 createIfMissing on a heading that doesn't exist

- **Action:** `periodic_update` — period `daily`, targetType `heading`, target `BrandNew`, operation `append`, content `Body.`, `createIfMissing: true`.
- **Expected:** success; a new `## BrandNew` (or top-level if the implementation treats it as h1) heading is created.
- **Assert:** `periodic_read` — period `daily` — `content` contains the new heading with `Body.` beneath it.
- **Result:** _pass | fail_

### 3. Read — each period type

> For each period below: if the period is configured in the test vault, run the Configured variant; otherwise run the Unconfigured variant.

#### 3.1 weekly

- **Action (Configured):** `periodic_read` — period `weekly`.
- **Expected (Configured):** success with `content`/`frontmatter`/`stat` fields, OR error `No weekly note exists for the current period`. Either is acceptable; record which.
- **Action (Unconfigured):** same.
- **Expected (Unconfigured):** error; message contains `Periodic notes for weekly is not enabled`.
- **Result:** _pass | fail — record which variant ran and the exact message_

#### 3.2 monthly

- **Action (Configured):** `periodic_read` — period `monthly`.
- **Expected (Configured):** success or `No monthly note exists for the current period`.
- **Action (Unconfigured):** same.
- **Expected (Unconfigured):** error; message contains `Periodic notes for monthly is not enabled`.
- **Result:** _pass | fail_

#### 3.3 quarterly

- **Action (Configured):** `periodic_read` — period `quarterly`.
- **Expected (Configured):** success or `No quarterly note exists for the current period`.
- **Action (Unconfigured):** same.
- **Expected (Unconfigured):** error; message contains `Periodic notes for quarterly is not enabled`.
- **Result:** _pass | fail_

#### 3.4 yearly

- **Action (Configured):** `periodic_read` — period `yearly`.
- **Expected (Configured):** success or `No yearly note exists for the current period`.
- **Action (Unconfigured):** same.
- **Expected (Unconfigured):** error; message contains `Periodic notes for yearly is not enabled`.
- **Result:** _pass | fail_

### 4. Update — unconfigured period

#### 4.1 periodic_update on an unconfigured period

> Run only if at least one of the non-`daily` periods is unconfigured. Pick one such period.

- **Action:** `periodic_update` — period `<unconfigured>`, targetType `heading`, target `Log`, operation `append`, content `x`, `createIfMissing: true`.
- **Expected:** error; message contains `Periodic notes for <period> is not enabled`.
- **Result:** _pass | fail_

## Teardown

- **Action:** delete the daily note created during this session (via Obsidian UI or `vault_delete` on its path).
- **Expected:** delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
