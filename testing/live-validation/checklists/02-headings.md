# Area: Heading Targeting

## Tools covered

- `vault_update` (heading targetType), `vault_create`, `vault_read` (assertions only)

## Setup

- **Action:** `vault_create` — path `sandbox/headings.md`, content:

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

- **Expected:** success.
- **On failure:** abort section; record as failed item with category `setup failure`.

## Tests

### 1. Basic targeting

#### 1.1 Append to top-level heading (h1, single-element)

- **Action:** `vault_update` — path `sandbox/headings.md`, targetType `heading`, target `Alpha`, operation `append`, content `\nAlpha appended.`
- **Expected:** success.
- **Assert:** `vault_read` (markdown) shows `Alpha appended.` under the `Alpha` h1 section.
- **Result:** _pass | fail_

#### 1.2 Bare h2 target fails (single-element = h1 only)

- **Action:** `vault_update` — path `sandbox/headings.md`, target `Beta`, operation `append`, content `x`.
- **Expected:** error (ambiguous / invalid-target); no content written.
- **Result:** _pass | fail_

#### 1.3 Bare unambiguous h2 still fails (confirms h1-only rule)

- **Action:** `vault_update` — path `sandbox/headings.md`, target `Delta`, operation `append`, content `x`.
- **Expected:** error; no content written.
- **Result:** _pass | fail_

#### 1.4 Two-level path

- **Action:** `vault_update` — target `Alpha::Beta`, operation `append`, content `\nAlphaBeta appended.`
- **Expected:** success.
- **Assert:** `vault_read` shows `AlphaBeta appended.` under `## Beta` within `# Alpha`.
- **Result:** _pass | fail_

#### 1.5 Three-level path

- **Action:** `vault_update` — target `Alpha::Beta::Gamma`, operation `append`, content `\nGamma appended.`
- **Expected:** success.
- **Assert:** `vault_read` shows `Gamma appended.` under `### Gamma`.
- **Result:** _pass | fail_

### 2. Disambiguation

#### 2.1 Ambiguous bare name

- **Action:** `vault_update` — target `Beta`, operation `append`, content `ambig`.
- **Expected:** error (`Beta` exists under both `Alpha` and `Epsilon`).
- **Result:** _pass | fail_

#### 2.2 Disambiguated under Alpha

- **Action:** `vault_update` — target `Alpha::Beta`, operation `append`, content `\nUnder Alpha.`
- **Expected:** success.
- **Assert:** `vault_read` shows `Under Alpha.` in the Alpha→Beta section only.
- **Result:** _pass | fail_

#### 2.3 Disambiguated under Epsilon

- **Action:** `vault_update` — target `Epsilon::Beta`, operation `append`, content `\nUnder Epsilon.`
- **Expected:** success.
- **Assert:** `vault_read` shows `Under Epsilon.` in the Epsilon→Beta section only.
- **Result:** _pass | fail_

### 3. Skipped heading levels

#### 3.1 H3 directly under H1 (no H2 between)

- **Action:** `vault_update` — target `Eta::Skipped`, operation `append`, content `\nSkipped appended.`
- **Expected:** success.
- **Assert:** `vault_read` shows `Skipped appended.` under `### Skipped`.
- **Result:** _pass | fail_

### 4. Operations

#### 4.1 Prepend

- **Action:** `vault_update` — target `Alpha::Delta`, operation `prepend`, content `Prepended.\n`.
- **Expected:** success.
- **Assert:** `vault_read` shows `Prepended.` appears before `Delta content.` within the Delta section.
- **Result:** _pass | fail_

#### 4.2 Replace

- **Action:** `vault_update` — target `Alpha::Delta`, operation `replace`, content `Replaced Delta body.\n`.
- **Expected:** success.
- **Assert:** `vault_read` shows the Delta section body equals `Replaced Delta body.` — the earlier `Delta content.` and `Prepended.` are gone; the `## Delta` heading itself remains.
- **Result:** _pass | fail_

#### 4.3 Document structure intact after ops

- **Action:** `vault_read` (markdown) — path `sandbox/headings.md`.
- **Expected:** all original headings (`# Alpha`, `## Beta`, `### Gamma`, `## Delta`, `# Epsilon`, `## Beta`, `## Zeta`, `# Eta`, `### Skipped`) still present with correct levels; no merged or lost sections.
- **Result:** _pass | fail_

### 5. Newline handling

#### 5.1 Leading newline preserves paragraph separation

- **Action:** `vault_update` — target `Alpha`, operation `append`, content `\nWith leading newline.`
- **Expected:** success.
- **Assert:** `vault_read` shows `With leading newline.` separated from the prior content by a blank line.
- **Result:** _pass | fail_

#### 5.2 No leading newline merges with prior content

- **Action:** `vault_update` — target `Epsilon`, operation `append`, content `No leading newline.`
- **Expected:** success; content is appended directly to the trailing text of Epsilon's content area with no automatic separator inserted.
- **Assert:** `vault_read` shows `No leading newline.` adjacent to (not blank-line-separated from) the prior Epsilon body content.
- **Result:** _pass | fail_

### 6. createIfMissing

#### 6.1 Create a new sub-heading under existing h1

- **Action:** `vault_update` — target `Alpha::NewSection`, operation `append`, content `New section body.\n`, `createIfMissing: true`.
- **Expected:** success.
- **Assert:** `vault_read` shows a new `## NewSection` heading under `# Alpha` containing `New section body.`.
- **Result:** _pass | fail_

#### 6.2 Regression: trailing-newline corruption check

- **Action:** `vault_update` — target the heading that follows `NewSection` in document order (e.g. `Alpha::Beta` or `Epsilon`), operation `append`, content `\nRegression probe.`
- **Expected:** success; subsequent heading is still targetable.
- **Assert:** If tool returns `invalid-target`, the trailing-newline corruption bug is present — record as `behavior mismatch`.
- **Result:** _pass | fail_

#### 6.3 Missing target without createIfMissing

- **Action:** `vault_update` — target `Alpha::Nonexistent`, operation `append`, content `x`. (No `createIfMissing`.)
- **Expected:** error (`invalid-target` or equivalent).
- **Result:** _pass | fail_

#### 6.4 createIfMissing at top level

- **Action:** `vault_update` — target `NewTopLevel`, operation `append`, content `Top body.\n`, `createIfMissing: true`.
- **Expected:** success; a new `# NewTopLevel` heading is created at document end (or documented location).
- **Assert:** `vault_read` shows a heading `# NewTopLevel` exists with `Top body.` beneath it.
- **Result:** _pass | fail_

### 7. Duplicate content prevention

#### 7.1 First insertion succeeds

- **Action:** `vault_update` — target `Epsilon::Zeta`, operation `append`, content `\nSentinel text.`
- **Expected:** success.
- **Result:** _pass | fail_

#### 7.2 Exact repeat is rejected

- **Action:** `vault_update` — target `Epsilon::Zeta`, operation `append`, content `\nSentinel text.`
- **Expected:** error; failure reason `content-already-preexists-in-target` (or message containing that phrase).
- **Result:** _pass | fail_

#### 7.3 Different content still succeeds

- **Action:** `vault_update` — target `Epsilon::Zeta`, operation `append`, content `\nDifferent text.`
- **Expected:** success.
- **Result:** _pass | fail_

### 8. Special characters in headings

#### 8.1 Brackets

- **Action:** `vault_create` — path `sandbox/heading-brackets.md`, content `# Heading [with] (brackets)\n\nBody.\n`. Then `vault_update` — target `Heading [with] (brackets)`, operation `append`, content `\nBracket test.`
- **Expected:** either success (brackets resolved correctly) or `invalid-target` error — record which.
- **Assert (on success):** `vault_read` shows `Bracket test.` appended under the heading.
- **Result:** _pass | fail_

#### 8.2 Literal `::` in heading name (unescapable)

- **Action:** `vault_create` — path `sandbox/heading-colons.md`, content `# Special::Colon\n\nBody.\n`. Then `vault_update` — target `Special::Colon`, operation `append`, content `x`.
- **Expected:** error — the `::` in the target is always interpreted as a path separator; there is no escape sequence.
- **Result:** _pass | fail_

#### 8.3 Emoji and non-ASCII

- **Action:** `vault_create` — path `sandbox/heading-emoji.md`, content `# 🎯 Goals\n\n## 日本語\n\nBody.\n`. Then `vault_update` — target `🎯 Goals`, operation `append`, content `\nEmoji top.` Then `vault_update` — target `🎯 Goals::日本語`, operation `append`, content `\nNested non-ASCII.`
- **Expected:** both updates succeed.
- **Assert:** `vault_read` shows both appended lines under their respective headings.
- **Result:** _pass | fail_

## Teardown

- **Action:** `vault_delete` on `sandbox/headings.md`, `sandbox/heading-brackets.md`, `sandbox/heading-colons.md`, `sandbox/heading-emoji.md`.
- **Expected:** each delete succeeds, or fails cleanly with file-not-found.
- **Note:** primary reset is `git reset --hard` between sessions; teardown is courtesy.
