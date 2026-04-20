# Changelog

## 2026-04-19: Live Tool Validation

Added a manual live-validation protocol for exercising obsidian-mcp tools against a real Obsidian instance. Claude Code runs structured single-tool checklists against a test vault and produces immutable reports plus proposed diffs to a human-curated known-issues log. No code changes — documentation and process artifacts only.

**Design:** docs/design-specs/2026-04-19-2145-live-tool-validation.md
**Plan:** docs/implementation-plans/2026-04-19-2201-live-tool-validation.md
**Key files:** docs/live-validation/README.md, docs/live-validation/log.md, docs/live-validation/checklists/01-vault.md through 10-cross-cutting.md, docs/live-validation/reports/, docs/live-validation/log-diffs/

## 2026-04-06: Remove Legacy Server

Removed the `legacy/` directory containing the original standalone Node.js MCP server. The native Obsidian plugin now fully replaces it.

## 2026-04-06: Traditional Tests

Deleted all existing tests and the obsidian mock, then rebuilt a focused test suite with 54 tests across 4 modules (`update-utils`, `search`, `server`, `metadata`). The obsidian mock was rebuilt incrementally with only 3 exports. Server tests use a real HTTP server. Testing guidelines rewritten from scratch.

**Design:** docs/design-specs/2026-04-04-1723-traditional-tests.md
**Plan:** docs/implementation-plans/2026-04-04-2144-traditional-tests.md
**Key files:** plugin/src/tools/update-utils.test.ts, plugin/src/tools/search.test.ts, plugin/src/server.test.ts, plugin/src/tools/metadata.test.ts, plugin/src/**mocks**/obsidian.ts, docs/testing-guidelines.md

## 2026-03-18: Stateless HTTP Mode

Converted the MCP server from session-based to stateless HTTP mode. Each POST to `/mcp` now creates a fresh transport and McpServer per request — no session state is retained between requests. GET and DELETE return 405 with a JSON-RPC error body. Test suite rewritten for stateless behavior.

**Design:** docs/design-specs/2026-03-18-0905-stateless-http-mode.md
**Plan:** docs/implementation-plans/2026-03-18-0948-stateless-http-mode.md
**Key files:** plugin/src/server.ts, plugin/src/server.test.ts

## 2026-03-17: Stale Session Reconnect

Fixed the MCP server returning HTTP 400 instead of 404 for invalid/expired session IDs. The MCP spec requires 404 so compliant clients can auto-reinitialize. Split the GET/DELETE handler to distinguish missing session ID (400) from invalid session ID (404). Discovered and documented an upstream SDK gap where the TypeScript SDK does not implement the spec-required auto-reconnect behavior.

**Design:** docs/design-specs/2026-03-17-1642-stale-session-reconnect.md
**Plan:** docs/implementation-plans/2026-03-17-1701-stale-session-reconnect.md
**Key files:** plugin/src/server.ts, plugin/src/server.test.ts, docs/research/mcp-sdk-404-reconnect-gap.md

## 2026-03-17: Fix vault_create Error Reporting

Fixed `vault_create` swallowing exceptions and always reporting "File already exists" regardless of the actual error. The catch block now extracts the real error message from the thrown exception, so failures like missing parent directories correctly report the underlying cause.

**Key files:** plugin/src/tools/vault.ts

## 2026-03-17: Structured Updates

Implemented the final 3 of 15 MCP tools — `vault_update`, `active_file_update`, and `periodic_update` — completing full feature parity with the legacy MCP server. These tools perform structured content targeting (heading hierarchy, block references, frontmatter fields) using the `markdown-patch` library with atomic writes via `Vault.process()`. Added a shared `update-utils.ts` helper to avoid duplicating patch instruction construction across tools.

**Design:** docs/design-specs/2026-03-17-1253-structured-updates.md
**Plan:** docs/implementation-plans/2026-03-17-1305-structured-updates.md
**Key files:** plugin/src/tools/update-utils.ts, plugin/src/tools/vault.ts, plugin/src/tools/active-file.ts, plugin/src/tools/periodic.ts, plugin/src/**mocks**/obsidian.ts

## 2026-03-17: Medium Tool Porting

Ported 5 medium-complexity MCP tools (`search` simple + dataview, `periodic_read`, `tags_manage`, `frontmatter_manage`) from legacy HTTP-based REST API calls to direct Obsidian API access. Added 29 unit tests across 3 test files covering happy paths and error cases. `periodic_update` was deferred from medium to hard tier — it requires the same structured content targeting as `vault_update` and `active_file_update`.

**Design:** docs/design-specs/2026-03-16-2125-medium-tool-porting.md
**Plan:** docs/implementation-plans/2026-03-16-2131-medium-tool-porting.md
**Key files:** plugin/src/tools/search.ts, plugin/src/tools/periodic.ts, plugin/src/tools/metadata.ts, plugin/src/main.ts, plugin/src/**mocks**/obsidian.ts

## 2026-03-16: Fix mcp.json Transport Type

Fixed the mcp.json snippet in the settings tab using `"type": "streamable-http"` — Claude Code expects `"type": "http"`. The server wasn't discovered until this was corrected.

**Key files:** plugin/src/settings.ts

## 2026-03-16: Trivial Tool Porting

Ported 8 MCP tools across 4 modules (vault, commands, active-file, navigation) from HTTP-based REST API calls to direct Obsidian `app` API access. Expanded the obsidian mock for tool-level unit testing and added 21 unit tests. Adopted `obsidian-typings` for type-safe undocumented API access.

**Design:** docs/design-specs/2026-03-15-2250-trivial-tool-porting.md
**Plan:** docs/implementation-plans/2026-03-15-2303-trivial-tool-porting.md
**Key files:** plugin/src/tools/vault.ts, plugin/src/tools/commands.ts, plugin/src/tools/active-file.ts, plugin/src/tools/navigation.ts, plugin/src/main.ts, plugin/src/**mocks**/obsidian.ts, docs/testing-guidelines.md

## 2026-03-15: HTTP Server & Auth

Added HTTP server with Streamable HTTP transport, Bearer token authentication, and stateful session management to the Obsidian plugin. Includes API key auto-generation via `SecretStorage`, a settings tab with copyable connection info (`mcp.json` snippet and `claude mcp add` command), and full plugin lifecycle wiring (start on load, clean shutdown on unload).

**Design:** docs/design-specs/2026-03-15-1453-http-server-and-auth.md
**Plan:** docs/implementation-plans/2026-03-15-1634-http-server-and-auth.md
**Key files:** plugin/src/server.ts, plugin/src/settings.ts, plugin/src/crypto.ts, plugin/src/main.ts, plugin/src/**mocks**/obsidian.ts

## 2026-03-15: Testing Infrastructure

Added vitest-based testing infrastructure to the plugin workspace with manual Obsidian API mocks, v8 coverage reporting, and lefthook pre-commit integration. Includes a smoke test validating the full pipeline.

**Design:** docs/design-specs/2026-03-13-1354-testing-infrastructure.md
**Plan:** docs/implementation-plans/2026-03-13-1402-testing-infrastructure.md
**Key files:** plugin/vitest.config.ts, plugin/src/**mocks**/obsidian.ts, plugin/src/main.test.ts, plugin/package.json, lefthook.yml, .gitignore

## 2026-03-13: Scaffold & Build Config

Moved existing MCP server source to `legacy/`, created a `plugin/` workspace with full Obsidian plugin build toolchain (esbuild, TypeScript, ESLint with obsidianmd plugin), and a minimal `MCPToolsPlugin` entry point that loads and unloads cleanly in Obsidian.

**Design:** docs/design-specs/2026-03-12-2030-scaffold-and-build-config.md
**Plan:** docs/implementation-plans/2026-03-12-2127-scaffold-and-build-config.md
**Key files:** plugin/package.json, plugin/tsconfig.json, plugin/esbuild.config.mjs, plugin/eslint.config.mts, plugin/manifest.json, plugin/src/main.ts, pnpm-workspace.yaml, lefthook.yml

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

## 2026-03-08: Fix Lefthook Hooks in GitHub Desktop

Added `lefthook.rc` to load nvm before hook execution, fixing pre-commit hooks failing in GUI Git clients (e.g., GitHub Desktop) that don't source shell profiles. Updated `lefthook.yml` to reference the rc file.

**Key files:** lefthook.rc, lefthook.yml
