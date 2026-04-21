# MCP Tools for Obsidian

Obsidian plugin that runs an MCP server directly inside Obsidian, giving AI assistants native access to the Obsidian API — no HTTP bridge or third-party plugins required.

```
Claude Code <--HTTP--> Obsidian Plugin (MCP Server) <--> Obsidian API
```

> **Status:** Functional. All 15 MCP tools are implemented with direct Obsidian API access, stateless HTTP transport, and Bearer token auth. Not yet published to the community plugin registry.

## Project Structure

```
plugin/              Obsidian plugin
  src/main.ts        Plugin entry point, lifecycle wiring
  src/server.ts      HTTP server with auth (stateless mode)
  src/settings.ts    Settings tab with connection info
  src/crypto.ts      API key generation
  src/tools/         MCP tool modules (vault, commands, active-file, navigation, search, periodic, metadata)
docs/                Design specs, implementation plans, changelog
```

## Development

```bash
# Install root tooling (lefthook, prettier)
pnpm install

# Install plugin dependencies
cd plugin
pnpm install

# Build the plugin
pnpm build

# Start dev mode (esbuild watch)
pnpm dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Prerequisites

- **Obsidian** 1.12.0+
- **pnpm** (`npm install -g pnpm` or see [pnpm.io](https://pnpm.io/installation))
- Optional community plugins for extended functionality:
  - [Dataview](https://github.com/blacksmithgu/obsidian-dataview) (for DQL queries via the `search` tool)
  - [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) (for the `periodic_read` and `periodic_update` tools)

## Setup

### 1. Install the plugin

Clone the repo, build, and symlink into your vault:

```bash
git clone https://github.com/tylernford/obsidian-mcp.git
cd obsidian-mcp
pnpm install
cd plugin
pnpm install
pnpm build

# Symlink into your vault's plugins directory
ln -s "$(pwd)" "/path/to/vault/.obsidian/plugins/mcp-tools"
```

Then in Obsidian: **Settings > Community Plugins > MCP Tools** — enable the plugin.

### 2. Register with Claude Code

The plugin's settings tab shows connection snippets with the correct port and API key. Use either:

**Option A: `mcp.json`** (recommended)

Copy the `mcp.json` snippet from the settings tab into `~/.claude/mcp.json` (global) or `.claude/mcp.json` (project).

**Option B: `claude mcp add`**

Copy the `claude mcp add` command from the settings tab and run it in your terminal.

### 3. Verify

Start a new Claude Code session and run `/mcp` to confirm the obsidian server shows as connected.

### Configuration

The plugin settings tab provides:

- **API key** — auto-generated on first load, displayed read-only with copy and regenerate buttons
- **Port** — configurable (default: 28080), requires confirmation and server restart on change

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

## Testing

Tests target modules with meaningful logic — branching, parsing, transformation. Thin wrappers around Obsidian APIs are excluded; they're validated at runtime against a real Obsidian instance.

| Module         | Tests | What's covered                                                   |
| -------------- | ----- | ---------------------------------------------------------------- |
| `update-utils` | 12    | Heading/block/frontmatter targeting, JSON parse fallback, errors |
| `search`       | 13    | Offset math, match categorization, Dataview query transform      |
| `server`       | 10    | Auth (real HTTP), routing, request handling, lifecycle           |
| `metadata`     | 19    | Tag normalization/dedup, frontmatter read/set, edge cases        |

```bash
pnpm test              # Run all 54 tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With v8 coverage
```

See [docs/testing-guidelines.md](docs/testing-guidelines.md) for the full testing philosophy, mock strategy, and module selection rationale.

Thin wrappers and integration behavior are validated manually against a real Obsidian instance using the checklists in [testing/live-validation/](testing/live-validation/README.md).

## Built With

- TypeScript
- MCP SDK (`@modelcontextprotocol/sdk`)
- Zod (schema validation)
- ESLint + Prettier (linting/formatting)
- Lefthook (git hooks)
- pnpm (package manager)

## Roadmap

### Tool redesign

- Every tool is strictly read or write with no mixed operations (split `tags_manage`, `frontmatter_manage`)
- `vault_create` accepts frontmatter as a validated object, not embedded in raw markdown
- Remove `commands_execute`. If a capability matters, it gets a dedicated tool with named parameters
- Write operations return human-readable receipts that echo what changed

### Infrastructure

- Refactor `server.ts` to use SDK's `StreamableHTTPSessionManager`
- Fix inconsistent 405 error format (JSON-RPC vs generic shape)
- Add `frontmatter_manage` set action value validation
- Tool handler integration tests (end-to-end MCP round-trip)

### Validation

- Agent user testing — evaluate tools from a consumer perspective

See [docs/backlog.md](docs/backlog.md).
