# Testing Refactor

**Created:** 2026-04-03 **Type:** Root Design Spec

---

## Overview

**What:** A complete rework of the project's testing strategy, replacing all existing tests with a three-tier approach: traditional tests, live tool validation, and agent user testing.

**Why:** The existing tests were AI-generated without active human oversight. They are not well understood by the maintainer, and many are suspected to be mirror tests that re-implement production logic rather than catching real bugs. Starting from scratch with a deliberate strategy ensures every test justifies its existence.

**Type:** Refactor

---

## Testing Philosophy

Every test must justify its existence by catching something that would otherwise go undetected. No mirror tests. No tests that re-implement production logic to verify it produces the same output. No tests written for coverage numbers.

Tests should focus on edge cases, failure modes, and boundary conditions. A test that only exercises the happy path by repeating what the code already does provides no value.

---

## Three Test Types

| Type                     | Purpose                                               | What it catches                                                       | How it runs                                   |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| **Traditional tests**    | Verify logic correctness in complex code              | Logic bugs, regressions, edge cases                                   | `pnpm test`, during development               |
| **Live tool validation** | Verify tools work against a real Obsidian instance    | Integration failures, Obsidian API behavior, real-world breakage      | Manual Claude Code session against test vault |
| **Agent user testing**   | Evaluate tool UX from an agent consumer's perspective | Bad descriptions, unhelpful errors, missing tools, poor composability | Manual Claude Code session against test vault |

The three types are complementary, not hierarchical. Findings from any type naturally inform the others — a UX issue found during agent testing may lead to a tool improvement verified by live validation and protected by a traditional test.

---

## Traditional Tests

### Scope

Traditional tests target modules with meaningful logic — branching, parsing, transformation. Thin wrappers around Obsidian APIs are explicitly excluded; they are better served by live tool validation.

#### Must Test

| Module            | Rationale                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update-utils.ts` | Complex patch logic: heading hierarchy parsing via `::` delimiter, block reference targeting, frontmatter JSON parse with silent string fallback. Content corruption risk is the highest in the codebase. |
| `search.ts`       | String offset calculations for match context extraction, boundary-spanning match handling, Dataview result transformation with structural assumptions.                                                    |

#### Good ROI

| Module        | Rationale                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `server.ts`   | Authentication logic — low complexity but high impact if broken. Bearer token validation, connection tracking.                  |
| `metadata.ts` | Tag normalization and deduplication, frontmatter JSON parsing with fallback, multiple action paths (list/add/remove, read/set). |

#### Excluded from Traditional Tests

| Module           | Reason                                                             |
| ---------------- | ------------------------------------------------------------------ |
| `crypto.ts`      | Single line — `randomBytes(32).toString("hex")`. No logic to test. |
| `navigation.ts`  | Single wrapper call to `openLinkText()`.                           |
| `commands.ts`    | Thin map over command registry, direct execution by ID.            |
| `active-file.ts` | Mirrors vault.ts logic with an "is file open" guard.               |
| `main.ts`        | Glue code — lifecycle hooks, delegation.                           |
| `settings.ts`    | UI rendering with one port validation check.                       |

### What Makes a Good Test

- Tests edge cases and failure modes, not happy paths
- Tests boundary inputs: empty strings, malformed JSON, special characters in heading targets, `::` delimiter edge cases, multibyte UTF-8
- Tests that the right error surfaces for the right condition
- Tests logic we wrote, not Obsidian API behavior

### Framework

Vitest. No reason to switch — it works, the project already uses it, and the configuration is in place.

---

## Live Tool Validation

### Purpose

Verify that MCP tools work correctly against a real Obsidian instance. This is functional correctness testing — does the tool do what it claims?

### How It Runs

A Claude Code session connected to a test vault (a duplicate of the maintainer's real Obsidian vault). Claude follows structured instructions to exercise tools and report results.

### What It Covers

- Full CRUD lifecycle (create, read, update, delete)
- Targeting mechanics (headings, blocks, frontmatter)
- Error handling (nonexistent files, invalid arguments, plugin dependencies)
- Cross-cutting concerns (metadata cache timing, concurrent operations, large content)
- Edge cases that cannot be mocked (Obsidian-specific behavior, real file system interactions)

### Test Vault

A duplicate of the maintainer's real vault. This means testing against realistic, varied data rather than a sterile purpose-built environment — a strength for catching real-world issues.

### Relationship to Existing Work

`docs/research/live-tool-validation.md` is a starting point for the checklist structure. The child design spec will determine whether to adopt, rework, or rebuild it.

---

## Agent User Testing

### Purpose

Evaluate the tools from the perspective of an agent consumer. Not "does the tool work?" but "does the tool make sense to use?"

### What It Evaluates

- **Description accuracy** — Does the tool do what its description says?
- **Parameter intuitiveness** — Do names and schemas match an agent's mental model?
- **Error helpfulness** — Do errors tell the agent what to fix?
- **Missing tools** — Are there workflow gaps where a tool should exist?
- **Composition** — Do tools chain together naturally?
- **Consistency** — Do similar tools behave consistently with each other?

### How It Runs

A Claude Code session against the test vault. Unlike live validation, which follows a structured checklist, agent user testing is exploratory — the agent uses the tools to accomplish real tasks and evaluates the experience qualitatively.

### Key Distinction from Live Validation

Live validation asks "does this work?" with expected outcomes. Agent user testing asks "is this good?" with subjective assessment. Live validation is scripted; agent user testing is exploratory.

### Relationship to Existing Work

`docs/research/llm-as-mcp-tool-tester.md` establishes the research basis and identifies the gap this type fills. The child design spec will define the evaluation protocol and how findings feed back into tool improvements.

---

## Findings Capture

Both live tool validation and agent user testing produce findings in two layers:

### Reports

An immutable record of each session's findings. One report per session, dated. Provides a history of what was found and when.

### Structured Log

A maintained snapshot of currently known issues, organized by tool or category. Updated after each session by comparing the new report against the existing log. New findings are added; resolved items are removed.

---

## Requirements

### Must Have

- [x] All existing tests removed
- [x] Traditional test suite covering `update-utils.ts`, `search.ts`, `server.ts`, `metadata.ts`
- [ ] Live tool validation protocol defined and usable
- [ ] Agent user testing protocol defined and usable
- [ ] Findings capture structure (reports + structured log) in place

### Nice to Have

- [ ] Traditional test coverage metrics baselined after new tests are written
- [ ] Templated report format for live validation and agent user testing sessions

### Out of Scope

- CI/CD integration for any test type
- Purpose-built test vault (using vault duplicate instead)
- Automated running of live validation or agent user testing
- Implementation details (deferred to child specs)

---

## Design Decisions

### Decision 1: Delete all existing tests rather than salvaging

**Options considered:**

1. Audit existing tests, keep useful ones, rewrite the rest
2. Delete everything, start from scratch

**Decision:** Option 2. The existing tests were written without maintainer oversight, are not well understood, and are suspected to be largely mirror tests. The cost of auditing exceeds the cost of rewriting, and a clean slate ensures every test has a clear purpose.

### Decision 2: Traditional tests target logic-heavy code only

**Options considered:**

1. Logic-heavy code only — test modules with meaningful branching, parsing, transformation
2. Boundary coverage — test every tool handler's input/output contract
3. Risk-based — test whatever is most likely to break or most costly when broken

**Decision:** A combination of options 1 and 3. Modules are prioritized by logic density and risk. Thin wrappers around Obsidian APIs are excluded because they are better covered by live tool validation, and traditional tests for them would likely become the mirror tests we're trying to avoid.

### Decision 3: Vitest stays

**Options considered:**

1. Keep Vitest
2. Evaluate alternatives (Jest, node:test, etc.)

**Decision:** Keep Vitest. It works, the project already uses it, and there is no specific pain point driving a switch.

### Decision 4: Findings captured as reports + structured log

**Options considered:**

1. Per-session markdown reports only
2. Structured log only (updated in place)
3. Both — reports as immutable records, structured log as maintained snapshot

**Decision:** Option 3. Reports preserve history; the structured log provides a current view. The log is updated by diffing against the latest report.

---

## Child Design Specs

This root spec identifies three child design specs to be written separately:

### 1. Traditional Tests

What specifically to test in each priority module, mock strategy, test organization, file structure, naming conventions.

### 2. Live Tool Validation

Checklist structure and content, report format, structured log format, session protocol.

### 3. Agent User Testing

Evaluation criteria, session protocol, report format, how findings translate into tool improvements.

---

## Acceptance Criteria

- [x] All existing test files are removed from the codebase
- [x] This root design spec is reviewed and approved
- [x] Child design spec for traditional tests is created and results in a working test suite where every test targets logic-heavy code and catches meaningful edge cases or failure modes
- [ ] Child design spec for live tool validation is created and results in a usable protocol that can be run in a Claude Code session against the test vault
- [ ] Child design spec for agent user testing is created and results in a usable protocol that produces actionable UX findings
- [ ] Findings capture structure (reports directory + structured log) exists and is documented

---

## Suggested Files to Create/Modify

```
plugin/src/**/*.test.ts          # Remove all existing test files
plugin/src/__mocks__/obsidian.ts # Evaluate whether to keep, rework, or rebuild (child spec decision)
docs/testing-guidelines.md       # Replace with updated guidelines reflecting new strategy
```
