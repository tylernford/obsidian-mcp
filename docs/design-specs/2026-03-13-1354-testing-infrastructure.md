# Testing Infrastructure

**Created:** 2026-03-13 **Implementation Plan:** TBD

---

## Overview

**What:** Add vitest-based testing infrastructure to the plugin workspace with manual Obsidian API mocks, coverage reporting, and lefthook integration.

**Why:** The plugin is entering active development (phases 2–5: HTTP server, tool porting). Testing infrastructure needs to be in place so tests can be written alongside implementation. As a future community plugin, we need confidence across unit, integration, and Obsidian API layers.

**Type:** Process

---

## Requirements

### Must Have

- [ ] Vitest configured as test runner in `plugin/`
- [ ] Manual mock file for the `obsidian` module via vitest alias
- [ ] Co-located test file convention (`*.test.ts` next to source)
- [ ] `pnpm test` script (single run)
- [ ] `pnpm test:watch` script (watch mode for development)
- [ ] `pnpm test:coverage` script with `@vitest/coverage-v8`
- [ ] Lefthook pre-commit hook runs tests on plugin source changes
- [ ] Test files excluded from production esbuild bundle
- [ ] All test dependencies are devDependencies only

### Nice to Have

- [ ] CI via GitHub Actions (`pnpm test` on push/PR)
- [ ] E2E testing with [wdio-obsidian-service](https://github.com/jesse-r-s-hines/wdio-obsidian-service)

### Out of Scope

- Writing test cases (those come in phases 2–5 alongside implementation)
- E2E testing framework setup
- CI/CD pipeline

---

## Design Decisions

### Test Framework

**Options considered:**

1. Jest — most used in Obsidian plugin community, but slow, ESM issues
2. Bun Test — very fast (~200ms vs 6–8s), but less ecosystem support
3. Vitest — fast, native TypeScript/ESM, built-in mocking/coverage, aligns with MCP SDK reference

**Decision:** Vitest. Best TypeScript support, fastest developer experience without sacrificing ecosystem maturity, and consistent with the MCP SDK reference repo already in the project.

### Obsidian Module Mocking

**Options considered:**

1. [Obsimian](https://github.com/motif-software/obsimian) — simulation framework with fake App/Vault/Plugin. Jest-only, 21 stars, last release 2021, effectively unmaintained.
2. [jest-environment-obsidian](https://github.com/obsidian-community/jest-environment-obsidian) — pre-built Jest environment. Jest-only, doesn't work with vitest.
3. Manual mock file via vitest alias — zero dependencies, full control, grows with the project.

**Decision:** Manual mock via vitest alias. The `obsidian` module only exists inside the Obsidian runtime, so any test runner needs mocks. A manual mock is the simplest approach with no stale dependencies, and our architecture naturally separates tool logic from Obsidian API calls.

**Key caveat:** Mocked Obsidian API tests verify our _assumptions_ about the API, not real behavior. Design for testability by keeping Obsidian API interactions in thin wrappers.

### Mock File Structure

**Options considered:**

1. Single flat file (`__mocks__/obsidian.ts`) — simple, all stubs in one place
2. Modular directory (`__mocks__/obsidian/index.ts` + per-class files) — scales better
3. Start flat, split later — no premature abstraction, natural migration path

**Decision:** Option 3. Start with a single `__mocks__/obsidian.ts`. Refactor to modular structure if/when the file exceeds ~150 lines during phases 2–5.

### Test File Layout

**Options considered:**

1. Co-located `*.test.ts` files next to source
2. Separate `test/` or `__tests__/` directory

**Decision:** Co-located. More modern convention, easier to find tests for a given module, no mirrored directory structure to maintain.

### Coverage

**Options considered:**

1. `v8` provider — fast, uses V8's native coverage instrumentation
2. `istanbul` provider — more established, slightly slower
3. Skip coverage for now

**Decision:** `v8` via `@vitest/coverage-v8`. Minimal setup cost and ready to use once tests exist.

---

## Acceptance Criteria

- [ ] `pnpm test` runs vitest and exits cleanly (even with zero test files)
- [ ] `pnpm test:watch` starts vitest in watch mode
- [ ] `pnpm test:coverage` generates a v8 coverage report
- [ ] Importing from `obsidian` in test files resolves to the manual mock
- [ ] Lefthook pre-commit runs tests when plugin source files change
- [ ] Test files (`*.test.ts`) are excluded from the production esbuild bundle
- [ ] No new runtime dependencies — all test deps are devDependencies

---

## Suggested Files to Create/Modify

```
plugin/vitest.config.ts        # vitest config with obsidian alias and coverage settings
plugin/src/__mocks__/obsidian.ts  # manual mock stubs for obsidian module
plugin/package.json            # add test scripts and devDependencies (vitest, @vitest/coverage-v8)
lefthook.yml                   # add test hook to pre-commit
```

---

## Research References

- [Challenges when Testing Plugins](https://www.moritzjung.dev/obsidian-collection/plugin-dev/testing/challengeswhentestingplugins/) — Moritz Jung's Obsidian Collection
- [obsidian-git vitest PR #745](https://github.com/Vinzent03/obsidian-git/pull/745) — manual mock via vitest alias pattern
- [Obsimian](https://github.com/motif-software/obsimian) — simulation framework (evaluated, not chosen)
- [wdio-obsidian-service](https://github.com/jesse-r-s-hines/wdio-obsidian-service) — E2E testing (flagged for future)
- [What to Test](https://www.moritzjung.dev/obsidian-collection/plugin-dev/testing/whattotest/) — community guidance on testability patterns
