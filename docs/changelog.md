# Changelog

## 2026-02-13: Obsidian MCP Server

MCP server exposing 15 tools for Claude Code to interact with Obsidian via the Local REST API plugin. Supports vault file operations, search (including Dataview DQL), command execution, active file awareness, navigation, and periodic notes.

**Design:** docs/design-plans/2026-02-13-1254-obsidian-mcp-server.md
**Plan:** docs/implementation-plans/2026-02-13-1332-obsidian-mcp-server.md
**Key files:** index.js, src/api-client.js, src/tools/vault.js, src/tools/search.js, src/tools/metadata.js, src/tools/commands.js, src/tools/active-file.js, src/tools/navigation.js, src/tools/periodic.js
