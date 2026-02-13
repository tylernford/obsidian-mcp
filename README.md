# Obsidian MCP Server

MCP server that wraps Obsidian's [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) into 15 tools for Claude Code.

```
Claude Code <--stdio--> MCP Server <--HTTP--> Local REST API plugin <--> Obsidian
```

## Prerequisites

- **Node.js** 18+
- **Obsidian** with the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin installed and enabled
- **API key** from the Local REST API plugin settings

## Installation

```bash
pnpm install
```

## Configuration

Register the server with Claude Code:

```bash
claude mcp add \
  --transport stdio \
  --scope user \
  --env OBSIDIAN_API_KEY=<key-from-plugin-settings> \
  obsidian \
  -- node /path/to/obsidian-mcp/index.js
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OBSIDIAN_API_KEY` | Yes | — | Bearer token from Local REST API plugin settings |
| `OBSIDIAN_API_HOST` | No | `localhost` | REST API host |
| `OBSIDIAN_API_PORT` | No | `27123` | REST API port |

## Tools

### Core File Operations

| Tool | Description |
|---|---|
| `vault_list` | List files and directories at a given path |
| `vault_read` | Read a note's content (markdown or JSON with parsed frontmatter) |
| `vault_create` | Create a new note |
| `vault_update` | Update a note at a heading, block, or frontmatter field |
| `vault_delete` | Delete a note |

### Search and Metadata

| Tool | Description |
|---|---|
| `search` | Full-text search or Dataview DQL query |
| `tags_manage` | List, add, or remove tags on a note |
| `frontmatter_manage` | Read or update YAML frontmatter fields |

### Commands

| Tool | Description |
|---|---|
| `commands_list` | List all registered Obsidian commands (core + plugins) |
| `commands_execute` | Execute a command by ID |

### Active File

| Tool | Description |
|---|---|
| `active_file_read` | Read the currently open note |
| `active_file_update` | Update the currently open note |

### Navigation

| Tool | Description |
|---|---|
| `file_open` | Open a note in the Obsidian UI |

### Periodic Notes

| Tool | Description |
|---|---|
| `periodic_read` | Read a periodic note (daily, weekly, monthly, quarterly, yearly) |
| `periodic_update` | Update a periodic note (creates from template if needed) |
