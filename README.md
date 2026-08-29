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
docs/                Current architecture, testing guidance, design history, and changelog
  architecture.md   Canonical current-state technical architecture
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

### 1. Install from source for local development

This plugin is not published in the Obsidian Community Plugins registry, and this repository has no automated release workflow. The supported repository workflow is therefore a local source build symlinked into a vault:

```bash
git clone https://github.com/tylernford/obsidian-mcp.git
cd obsidian-mcp
pnpm install
cd plugin
pnpm install
pnpm build

# Symlink into your vault's plugins directory. The destination must NOT
# already exist as a directory — if it does, `ln` will place the link
# *inside* it and Obsidian won't find manifest.json. Remove it first if so.
ln -s "$(pwd)" "/path/to/vault/.obsidian/plugins/mcp-tools"
```

Verify with `ls -l /path/to/vault/.obsidian/plugins/mcp-tools` — it should show `mcp-tools -> .../obsidian-mcp/plugin`, not a regular directory.

After the build-plus-symlink flow, that local plugin directory contains the generated `main.js`, the required `manifest.json`, and this repository's empty `styles.css` placeholder. `styles.css` is an optional, conventional Obsidian plugin artifact; it is not universally required.

Then in Obsidian: **Settings > Community Plugins > MCP Tools** — enable the plugin.

### 2. Register with Claude Code

The plugin's settings tab shows connection snippets with the correct port and API key. Use either:

**Option A: `mcp.json`** (recommended)

Copy the `mcp.json` snippet from the settings tab into `~/.claude/mcp.json` (global) or `.claude/mcp.json` (project).

**Option B: `claude mcp add`**

Copy the `claude mcp add` command from the settings tab and run it in your terminal.

### 3. Verify

Start a new Claude Code session and run `/mcp` to confirm the obsidian server shows as connected.

### Configuration, restart, and recovery

The plugin settings tab provides:

- **API key** — auto-generated on first load, stored in Obsidian SecretStorage rather than `data.json`, and displayed read-only with copy and regenerate buttons
- **Port** — configurable (default: 28080), with confirmation before a change

Changing the port or regenerating the API key reconstructs and restarts the embedded server, dropping active MCP connections. Update the client URL after a port change or its `Authorization` header after a key change, then reconnect or start a new client session.

An initial bind failure is shown as an Obsidian Notice. During a settings-driven restart, a port conflict can leave the server unavailable on the selected port; there is no automatic rollback to the previous listener. To recover, choose an unused valid port in the plugin settings, apply the change/restart, update the MCP client URL and Bearer header, and verify the connection with `/mcp` in Claude Code.

## Security

The server binds only to `127.0.0.1`, which limits network exposure but does not protect it from untrusted processes on the same machine. The Bearer API key is the sole server-side authorization boundary: anyone who has it can invoke every registered tool, including vault writes/deletes, frontmatter changes, UI navigation, and arbitrary registered Obsidian commands. The key is visible in settings and can be copied to the clipboard, so treat both locations as sensitive.

Do not expose the endpoint through a proxy or network tunnel without adding appropriate transport and access controls. See the [architecture security and trust model](docs/architecture.md#security-and-trust-model) for the full boundary and the controls that are not currently implemented.

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

## Known limitations

The canonical known-issues list is the [live-validation log](testing/live-validation/log.md). As last confirmed on 2026-04-21, selected user-impacting observations include:

- `frontmatter_manage set` accepts an omitted `value` as a misleading successful no-op.
- `tags_manage` treats scalar `tags:` values as empty or drops them when adding a tag, and removing a nonexistent tag returns a misleading removal receipt.
- `file_open` with `newLeaf: true` may not shift focus, while a nonexistent path can create an empty file and report success.
- `search` accepts a negative `contextLength` and trims the match token rather than rejecting or normalizing it.
- Structured `vault_update` operations can be permissive or surprising, including malformed frontmatter values, multi-block replacements, duplicate array values, and relocated block markers.

These are concise snapshots, not a second issue ledger. Consult the canonical log for exact checklist references, evidence, and later confirmation or removal.

## Testing

The automated tests target modules with meaningful logic — branching, parsing, transformation. Thin wrappers around Obsidian APIs are excluded from dedicated automated suites and instead covered by live validation against a real Obsidian instance.

| Module         | Tests | What's covered                                                   |
| -------------- | ----- | ---------------------------------------------------------------- |
| `update-utils` | 12    | Heading/block/frontmatter targeting, JSON parse fallback, errors |
| `search`       | 13    | Offset math, match categorization, Dataview query transform      |
| `server`       | 10    | Auth (real HTTP), routing, request handling, lifecycle           |
| `metadata`     | 19    | Tag normalization/dedup, frontmatter read/set, edge cases        |

```bash
pnpm test              # Run all 54 automated tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With v8 coverage
```

The `search` and `metadata` handler-level tests call captured tool handlers directly. They test handler logic but bypass MCP JSON-RPC dispatch and the SDK's Zod input validation. The `server` HTTP integration tests use a real localhost listener and real MCP initialization, but do not exercise end-to-end `tools/list` or `tools/call` behavior.

Thin Obsidian wrappers are checked through the [live-validation protocol](testing/live-validation/README.md), which is structured and evidence-producing but manual and operator-mediated. The repository currently has no repository-owned CI workflow and no enforced coverage threshold.

See [docs/testing-guidelines.md](docs/testing-guidelines.md#coverage-boundaries-and-gaps) for the detailed validation boundaries, mock strategy, and module selection rationale.

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
