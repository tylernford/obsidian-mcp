# Area: Search

## Tools covered

- `search` (simple and dataview), `vault_create`, `vault_read` (assertions only)

## Setup

- **Action:** `vault_create` — path `sandbox/search.md`, content:

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

- **Expected:** success. After create, wait ~1 second to allow Obsidian's search index to update.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. Simple search

#### 1.1 Hit

- **Action:** `search` — query `unique_sentinel_mcp_test_xyz`, type `simple`.
- **Expected:** success; result array contains at least one entry whose `filename` references `sandbox/search.md`. Each entry has `filename` and `score` fields.
- **Result:** _pass | fail_

#### 1.2 Miss returns empty array

- **Action:** `search` — query `xyzzy_nonexistent_content_99999`, type `simple`.
- **Expected:** success; returns `[]`. No error.
- **Result:** _pass | fail_

### 2. Result shape

#### 2.1 Multiple results, sorted by score

- **Action:** `search` — query `search`, type `simple`.
- **Expected:** success; array length ≥ 1. Results sorted by `score` with most-negative (best match) first. Each entry has `filename`, `score`, and `matches` (array). Each element in `matches` has a `context` field (and may have `offset` or similar positional fields — record the exact keys).
- **Result:** _pass | fail_

### 3. contextLength

#### 3.1 Short context

- **Action:** `search` — query `unique_sentinel_mcp_test_xyz`, type `simple`, contextLength `10`.
- **Expected:** success; `matches[].context` strings are noticeably shorter than the default.
- **Result:** _pass | fail_

#### 3.2 Long context

- **Action:** `search` — query `unique_sentinel_mcp_test_xyz`, type `simple`, contextLength `500`.
- **Expected:** success; `matches[].context` strings are longer than 3.1 (and may equal the full surrounding line/paragraph).
- **Result:** _pass | fail_

#### 3.3 Zero context

- **Action:** `search` — query `unique_sentinel_mcp_test_xyz`, type `simple`, contextLength `0`.
- **Expected:** success; `matches[].context` is empty string or contains only the match token itself. Record the exact behavior.
- **Result:** _pass | fail_

#### 3.4 Negative context

- **Action:** `search` — query `unique_sentinel_mcp_test_xyz`, type `simple`, contextLength `-1`.
- **Expected:** either (a) error due to invalid input (ideal: `missing validation`), or (b) success behaving as if `0` or some default. Record which and the exact outcome.
- **Result:** _pass | fail_

### 4. Dataview

> If Dataview plugin is not installed/enabled, only 4.1 runs; skip 4.2–4.5 and record in Result.

#### 4.1 Unavailable path

- **Action:** `search` — query `TABLE title FROM ""`, type `dataview`.
- **Expected (Dataview absent):** error; message contains `Dataview plugin is not installed or enabled`.
- **Expected (Dataview present):** success; skip to 4.2.
- **Result:** _pass | fail_

#### 4.2 TABLE happy path

- **Action:** `search` — query `TABLE title, status FROM "" WHERE status = "published"`, type `dataview`.
- **Expected:** success; result includes a row referencing `sandbox/search.md` with `title === "Search Target"` and `status === "published"`.
- **Result:** _pass | fail_

#### 4.3 LIST is rejected

- **Action:** `search` — query `LIST FROM ""`, type `dataview`.
- **Expected:** error; message indicates that only TABLE queries are supported.
- **Result:** _pass | fail_

#### 4.4 TASK is rejected

- **Action:** `search` — query `TASK FROM ""`, type `dataview`.
- **Expected:** error; message indicates that only TABLE queries are supported.
- **Result:** _pass | fail_

#### 4.5 TABLE WITHOUT ID is rejected

- **Action:** `search` — query `TABLE WITHOUT ID title FROM ""`, type `dataview`.
- **Expected:** error; message contains `TABLE WITHOUT ID queries are not supported`.
- **Result:** _pass | fail_

### 5. Edge cases

#### 5.1 Empty query

- **Action:** `search` — query `""`, type `simple`.
- **Expected:** either (a) error due to empty input, or (b) success returning `[]`. Record which.
- **Result:** _pass | fail_

#### 5.2 Very long query

- **Action:** `search` — query equal to the string `unique_sentinel_mcp_test_xyz ` repeated 20 times (approximately 580 characters), type `simple`.
- **Expected:** success; tool does not crash. Result array may be empty or contain matches — record which.
- **Result:** _pass | fail_

#### 5.3 Regex-like characters

- **Action:** `search` — query `[test](match)`, type `simple`.
- **Expected:** success; tool does not crash and does not return an error from regex compilation. Result array may be empty.
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on `sandbox/search.md`.
- **Expected:** delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
