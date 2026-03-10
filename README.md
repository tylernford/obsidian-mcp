# Obsidian MCP Server

MCP server that wraps Obsidian's [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) into 15 tools for Claude Code.

[Roadmap](#roadmap): convert to a proper Obsidian plugin for direct API access.

```
Claude Code <--stdio--> MCP Server <--HTTP--> Local REST API plugin <--> Obsidian
```

## Prerequisites

- **Node.js** 24+
- **pnpm** (`npm install -g pnpm` or see [pnpm.io](https://pnpm.io/installation))
- **Obsidian** with the following community plugins installed and enabled:
  - [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) (required)
  - [Dataview](https://github.com/blacksmithgu/obsidian-dataview) (required for DQL queries via the `search` tool)
  - [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) (required for the `periodic_read` and `periodic_update` tools)

## Setup

### 1. Configure the Local REST API plugin

1. In Obsidian, go to **Settings > Community Plugins > Local REST API** (gear icon)
2. Enable **"Enable Non-encrypted (HTTP) Server"**. The MCP server connects over HTTP on localhost
3. Note the **API key** shown in the plugin settings. You'll need it in step 3

### 2. Clone and install

```bash
git clone https://github.com/tylernford/obsidian-mcp.git
cd obsidian-mcp
pnpm install
pnpm build
```

### 3. Register with Claude Code

**Option A: `~/.mcp.json`** (recommended: available in all projects)

Create or edit `~/.mcp.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp/dist/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "<key-from-step-1>"
      }
    }
  }
}
```

Replace `/absolute/path/to/obsidian-mcp/dist/index.js` with the actual path and paste your API key.

**Option B: `claude mcp add`**

```bash
claude mcp add \
  --transport stdio \
  --scope user \
  --env OBSIDIAN_API_KEY=<key-from-step-1> \
  obsidian \
  -- node /absolute/path/to/obsidian-mcp/dist/index.js
```

### 4. Verify

Start a new Claude Code session and run `/mcp` to confirm the obsidian server shows as connected.

### Environment Variables

| Variable            | Required | Default     | Description                                                           |
| ------------------- | -------- | ----------- | --------------------------------------------------------------------- |
| `OBSIDIAN_API_KEY`  | Yes      | —           | Bearer token from Local REST API plugin settings                      |
| `OBSIDIAN_API_HOST` | No       | `localhost` | REST API host — only change if you modified the plugin's bind address |
| `OBSIDIAN_API_PORT` | No       | `27123`     | REST API port — only change if you modified the plugin's HTTP port    |

## Usage Examples

Once the server is connected, you can use natural language in Claude Code:

| Prompt                                   | Tool            |
| ---------------------------------------- | --------------- |
| "List everything in my Projects folder"  | `vault_list`    |
| "Read my weekly note"                    | `periodic_read` |
| "Create a new note called Meeting Notes" | `vault_create`  |
| "Search my vault for anything about MCP" | `search`        |
| "Tag this note with #review"             | `tags_manage`   |
| "Open my daily note in Obsidian"         | `file_open`     |

## Tools

### Core File Operations

| Tool           | Description                                                      |
| -------------- | ---------------------------------------------------------------- |
| `vault_list`   | List files and directories at a given path                       |
| `vault_read`   | Read a note's content (markdown or JSON with parsed frontmatter) |
| `vault_create` | Create a new note                                                |
| `vault_update` | Update a note at a heading, block, or frontmatter field          |
| `vault_delete` | Delete a note                                                    |

### Search and Metadata

| Tool                 | Description                            |
| -------------------- | -------------------------------------- |
| `search`             | Full-text search or Dataview DQL query |
| `tags_manage`        | List, add, or remove tags on a note    |
| `frontmatter_manage` | Read or update YAML frontmatter fields |

### Commands

| Tool               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `commands_list`    | List all registered Obsidian commands (core + plugins) |
| `commands_execute` | Execute a command by ID                                |

### Active File

| Tool                 | Description                    |
| -------------------- | ------------------------------ |
| `active_file_read`   | Read the currently open note   |
| `active_file_update` | Update the currently open note |

### Navigation

| Tool        | Description                    |
| ----------- | ------------------------------ |
| `file_open` | Open a note in the Obsidian UI |

### Periodic Notes

| Tool              | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `periodic_read`   | Read a periodic note (daily, weekly, monthly, quarterly, yearly) |
| `periodic_update` | Update a periodic note (creates from template if needed)         |

## Built With

- [TypeScript](https://www.typescriptlang.org/)
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) (`@modelcontextprotocol/sdk`)
- [Zod](https://zod.dev/) (schema validation)
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) (linting/formatting)
- [Lefthook](https://github.com/evilmartians/lefthook) (git hooks)
- [pnpm](https://pnpm.io/) (package manager)

# Roadmap

### Plugin migration

- Direct access to Obsidian's API instead of HTTP calls through the Local REST API plugin
- Single plugin instead of two (removes the Local REST API dependency)
- No HTTP or API key overhead
### Tool redesign

- Every tool is strictly read or write with no mixed operations (split `tags_manage`, `frontmatter_manage`)
- `vault_create` accepts frontmatter as a validated object, not embedded in raw markdown
- Remove `commands_execute`. If a capability matters, it gets a dedicated tool with named parameters
- Write operations return human-readable receipts that echo what changed

See [docs/backlog.md](docs/backlog.md) for the full backlog.
