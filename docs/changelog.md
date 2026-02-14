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
