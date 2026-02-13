# Design: Obsidian MCP Server

## Overview

### What
Build a custom MCP (Model Context Protocol) server that gives Claude Code full access to the Obsidian API via the Local REST API plugin. This replaces the current approach of reading/writing vault files directly on disk with structured, API-driven access to Obsidian's internals — including search, command execution, active file awareness, and plugin interaction.

### Why
Claude Code currently interacts with the vault by grepping and globbing files on disk. This ignores Obsidian's indexed search, graph structure, metadata cache, and plugin ecosystem. With API access, Claude Code can:
- Run Dataview DQL queries instead of manually parsing frontmatter
- Execute plugin commands (Spaced Repetition, Dataview, any future plugins)
- Know what note the user currently has open
- Open notes in the Obsidian UI after creating them
- Access periodic notes by date reference

### Architecture
Two components:

1. **Local REST API plugin** (existing, installed in Obsidian) — Exposes 30 HTTP endpoints on `localhost:27123`
2. **Custom MCP server** (new, separate repo) — Node.js stdio server that wraps the REST API into MCP tools for Claude Code

```
Claude Code <--stdio--> MCP Server <--HTTP--> Local REST API plugin <--> Obsidian
```

---

## Requirements

### Must Have
- [ ] MCP server exposes all 15 tools defined below
- [ ] Server authenticates with the REST API via `OBSIDIAN_API_KEY` environment variable
- [ ] Server communicates over stdio transport (compatible with `claude mcp add`)
- [ ] Server connects to REST API on HTTP `localhost:27123` (not HTTPS)
- [ ] Graceful error handling when Obsidian is not running
- [ ] Project lives in its own Git repository

### Nice to Have
- [ ] Support configurable host/port (not just localhost:27123)
- [ ] Structured JSON responses with parsed frontmatter where applicable
- [ ] Document-map response support for structural info (headings, blocks)

### Out of Scope
- Plugin installation/configuration (user handles this in Obsidian)
- Workflow design (follow-up design session after we've used the tools)
- Research into obsidian-claude-code-mcp and Nexus for ideas (follow-up task)
- Publishing to npm (can do later if desired)
- HTTPS/self-signed certificate support (unnecessary for localhost)

---

## Design Decisions

### 1. Local REST API as the backend
**Decision**: Use the Local REST API plugin (coddingtonbear/obsidian-local-rest-api) rather than building an Obsidian plugin or accessing files directly.

**Rationale**: Most mature option in the ecosystem (1.7k GitHub stars, 30 endpoints, OpenAPI spec, actively maintained through Feb 2025). Supports Dataview DQL queries through its search endpoint. Extensible — other plugins can register additional routes. Well-documented with interactive Swagger UI.

**Trade-off**: Requires Obsidian to be running. Acceptable because Obsidian is always open during Claude Code sessions.

### 2. Custom MCP server instead of existing bridge
**Decision**: Build our own MCP server rather than using an existing one (cyanheads, MarkusPfundstein, etc.).

**Rationale**: No existing MCP bridge exposes command execution, active file access, or periodic notes — the capabilities that motivated this project. cyanheads covers 7 of the 30 endpoints. Building our own gives us full coverage and the ability to add tools as needed.

**Trade-off**: More upfront work. Mitigated by the fact that wrapping REST endpoints into MCP tools is mechanical work, and cyanheads provides a reference implementation.

### 3. HTTP on port 27123 (not HTTPS)
**Decision**: Connect to the REST API over HTTP, not HTTPS.

**Rationale**: The REST API binds to localhost only. HTTPS with a self-signed cert adds complexity (certificate trust, TLS configuration) with no security benefit for local traffic.

### 4. stdio transport
**Decision**: Use stdio transport for the MCP server (not HTTP or SSE).

**Rationale**: Claude Code spawns the server as a child process. No port management, no startup coordination. Standard approach for local MCP servers.

### 5. API key via environment variable
**Decision**: Pass the REST API key as `OBSIDIAN_API_KEY` environment variable in the `claude mcp add` command.

**Rationale**: Keeps the key out of committed code. Set once during configuration, never exposed in the repo.

### 6. Separate repository
**Decision**: MCP server lives in its own Git repo, not inside the Obsidian vault.

**Rationale**: Separation of concerns — the vault is a knowledge base, not a code project. Independent version control. Could be shared or published later.

---

## Tool Definitions

### Core File Operations

| Tool | REST Endpoint | Description |
|---|---|---|
| `vault_list` | `GET /vault/{path}/` | List files and directories at a given path |
| `vault_read` | `GET /vault/{filename}` | Read a note's content (supports markdown and JSON with parsed frontmatter) |
| `vault_create` | `PUT /vault/{filename}` | Create a new note |
| `vault_update` | `PATCH /vault/{filename}` | Update a note — insert at heading, block reference, or frontmatter field |
| `vault_delete` | `DELETE /vault/{filename}` | Delete a note |

### Search and Metadata

| Tool | REST Endpoint | Description |
|---|---|---|
| `search` | `POST /search/` and `POST /search/simple/` | Full-text search or Dataview DQL query |
| `tags_manage` | Composite (read via vault_read, write via vault_update) | Add, remove, or rename tags on a note |
| `frontmatter_manage` | `PATCH /vault/{filename}` (frontmatter target) | Read or update specific YAML frontmatter fields |

### Commands and Plugin Interaction

| Tool | REST Endpoint | Description |
|---|---|---|
| `commands_list` | `GET /commands/` | List all registered Obsidian commands (core + plugins) |
| `commands_execute` | `POST /commands/{commandId}/` | Execute a command by ID |

### Active File

| Tool | REST Endpoint | Description |
|---|---|---|
| `active_file_read` | `GET /active/` | Read the currently open note |
| `active_file_update` | `PATCH /active/` | Update the currently open note (same patch semantics as vault_update) |

### Navigation

| Tool | REST Endpoint | Description |
|---|---|---|
| `file_open` | `POST /open/{filename}` | Open a note in the Obsidian UI |

### Periodic Notes

| Tool | REST Endpoint | Description |
|---|---|---|
| `periodic_read` | `GET /periodic/{period}/` | Read a periodic note (daily, weekly, monthly, quarterly, yearly) |
| `periodic_update` | `PATCH /periodic/{period}/` | Write to a periodic note (creates from template if it doesn't exist) |

---

## Configuration

### Claude Code MCP registration
```bash
claude mcp add \
  --transport stdio \
  --scope user \
  --env OBSIDIAN_API_KEY=<key-from-plugin-settings> \
  obsidian \
  -- node /path/to/obsidian-mcp/index.js
```

### Environment variables
| Variable | Required | Default | Description |
|---|---|---|---|
| `OBSIDIAN_API_KEY` | Yes | — | Bearer token from Local REST API plugin settings |
| `OBSIDIAN_API_HOST` | No | `http://localhost` | REST API host |
| `OBSIDIAN_API_PORT` | No | `27123` | REST API port |

---

## Tech Stack
- **Runtime**: Node.js
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **HTTP client**: Native `fetch` (Node 18+)
- **Dependencies**: Minimal — SDK + nothing else if possible

---

## Files to Create

All in a new repository (e.g., `obsidian-mcp`):

```
obsidian-mcp/
  package.json
  index.js              # Entry point, MCP server setup
  src/
    api-client.js       # HTTP client for Local REST API
    tools/
      vault.js          # vault_list, vault_read, vault_create, vault_update, vault_delete
      search.js         # search
      metadata.js       # tags_manage, frontmatter_manage
      commands.js       # commands_list, commands_execute
      active-file.js    # active_file_read, active_file_update
      navigation.js     # file_open
      periodic.js       # periodic_read, periodic_update
  README.md
```

---

## Acceptance Criteria

1. **MCP server starts**: `node index.js` launches without error and registers all 15 tools
2. **Claude Code connects**: `claude mcp list` shows the obsidian server; `/mcp` in a session shows connected status
3. **File operations work**: Can list, read, create, update, and delete notes through MCP tools
4. **Search works**: Can run both simple text searches and Dataview DQL queries
5. **Commands work**: Can list all Obsidian commands and execute one (e.g., trigger a Dataview refresh)
6. **Active file works**: Can read the currently open note without specifying a path
7. **Navigation works**: Can open a note in Obsidian's UI from Claude Code
8. **Periodic notes work**: Can read/write today's daily note by date reference
9. **Auth works**: Server uses `OBSIDIAN_API_KEY` env var; fails gracefully with clear error if missing
10. **Obsidian offline**: Server returns clear error messages when Obsidian isn't running (doesn't crash)

---

## Setup Steps (for implementation phase)

1. Create new Git repository for the MCP server
2. Initialize Node.js project with minimal dependencies
3. Implement REST API client (`api-client.js`)
4. Implement tools in order: vault ops → search → commands → active file → navigation → periodic
5. Test each tool against running Obsidian instance with Local REST API plugin
6. Register with Claude Code via `claude mcp add`
7. Verify all acceptance criteria in a live session

---

## Follow-Up Work (separate design sessions)

- **Workflow design**: How to best use these new capabilities day-to-day
- **Research**: Investigate obsidian-claude-code-mcp and Nexus for ideas worth borrowing
- **CLAUDE.md updates**: Add MCP tool usage conventions once workflows are established
