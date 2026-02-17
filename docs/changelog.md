# Changelog

## 2026-02-13: Obsidian MCP Server

MCP server exposing 15 tools for Claude Code to interact with Obsidian via the Local REST API plugin. Supports vault file operations, search (including Dataview DQL), command execution, active file awareness, navigation, and periodic notes.

**Design:** docs/design-plans/2026-02-13-1254-obsidian-mcp-server.md
**Plan:** docs/implementation-plans/2026-02-13-1332-obsidian-mcp-server.md
**Key files:** index.js, src/api-client.js, src/tools/vault.js, src/tools/search.js, src/tools/metadata.js, src/tools/commands.js, src/tools/active-file.js, src/tools/navigation.js, src/tools/periodic.js

## 2026-02-14: TypeScript Refactor

Converted the entire codebase from JavaScript to TypeScript with `strict: true` type checking. Added `tsc` build step, ESLint with `@typescript-eslint/recommended`, Prettier, and Lefthook pre-commit hooks. Zero behavioral changes — all 15 tools work identically.

**Design:** docs/design-plans/2026-02-14-1042-typescript-refactor.md
**Plan:** docs/implementation-plans/2026-02-14-1353-typescript-refactor.md
**Key files:** tsconfig.json, eslint.config.js, .prettierrc, lefthook.yml, src/index.ts, src/api-client.ts, src/tools/\*.ts

## 2026-02-15: QA Fixes (Post-TypeScript Refactor)

Addressed all 12 in-scope issues from the post-TypeScript refactor QA review. Removed non-null assertions, added runtime validation guards in metadata tools, hardened the API client with generic `ApiResponse<T>` and safe JSON parsing, fixed ESLint scoping to `src/**/*.ts`, and cleaned up minor issues across periodic and commands tools.

**Design:** docs/design-plans/2026-02-15-0902-qa-fixes.md
**Plan:** docs/implementation-plans/2026-02-15-0905-qa-fixes.md
**Key files:** src/api-client.ts, src/index.ts, src/tools/metadata.ts, src/tools/periodic.ts, src/tools/commands.ts, eslint.config.js

## 2026-02-15: API Client Type Refinements

Made `request()` and `patch()` generic (`<T>`) so callers specify expected response types at the call site, eliminating `as` type assertions in tool code. Unexported `ApiResponse` and `ObsidianClientConfig` types since they're internal to the API client module.

**Key files:** src/api-client.ts, src/tools/metadata.ts

## 2026-02-15: Upgrade Dependencies

Upgraded Node engine to 24, pnpm to 10.29.3, and Zod from v3 to v4 (zero code changes). Removed redundant `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` direct devDependencies. Created `.nvmrc` pinned to Node 24.

**Design:** docs/design-plans/2026-02-15-1452-upgrade-dependencies.md
**Plan:** docs/implementation-plans/2026-02-15-1556-upgrade-dependencies.md
**Key files:** .nvmrc, package.json, pnpm-lock.yaml, docs/notes/eslint-peer-conflicts.md

## 2026-02-17: Actionable Error Messages

Improved error messages in the API client to include actionable guidance for common failure scenarios. Added specific messages for EACCES, ETIMEDOUT, and ENOTFOUND system errors and HTTP 401, 403, and 404 responses. Refactored error handling to use switch statements.

**Design:** docs/design-plans/2026-02-17-0849-actionable-error-messages.md
**Plan:** docs/implementation-plans/2026-02-17-0910-actionable-error-messages.md
**Key files:** src/api-client.ts

## 2026-02-17: Error Handling QA Updates

QA improvements to actionable error messages: extracted error handling into a dedicated `src/errors.ts` module, added missing ECONNRESET and 5xx error cases, included `baseUrl` in network error messages, and preserved server-provided messages in HTTP error responses.

**Design:** docs/design-plans/2026-02-17-0953-error-handling-qa.md
**Plan:** docs/implementation-plans/2026-02-17-1016-error-handling-qa.md
**Key files:** src/errors.ts, src/api-client.ts
