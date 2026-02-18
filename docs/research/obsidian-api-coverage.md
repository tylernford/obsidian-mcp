# Obsidian API Coverage via Local REST API Plugin

Research into how much of the Obsidian API is exposed by the [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api), which this MCP server depends on.

## Architecture

```
Claude Code  <-->  MCP Server (this project)  <-->  Local REST API plugin  <-->  Obsidian API
```

The Local REST API plugin receives the Obsidian `App` instance (giving it access to `app.vault`, `app.workspace`, `app.metadataCache`, etc.) and exposes a subset of those APIs as HTTP endpoints on `localhost:27123`. This MCP server translates MCP tool calls into HTTP requests to those endpoints.

## What the Plugin Exposes

### Vault API (File Operations)

| Obsidian API                          | Plugin Endpoint        | Notes                                        |
| ------------------------------------- | ---------------------- | -------------------------------------------- |
| `vault.getFiles()`                    | `GET /vault/`          | Lists all files in the vault                 |
| `vault.getAbstractFileByPath()`       | Used internally        | Resolves paths to file objects               |
| `vault.read()` / `vault.cachedRead()` | `GET /vault/{path}`    | Read file content (text and binary)          |
| `vault.createFolder()`                | `PUT /vault/{path}`    | Creates folders as needed                    |
| `vault.adapter.write()`               | `PUT /vault/{path}`    | Write text or binary content                 |
| `vault.adapter.writeBinary()`         | `PUT /vault/{path}`    | Write binary content                         |
| `vault.adapter.remove()`              | `DELETE /vault/{path}` | **Hard deletes** — bypasses Obsidian's trash |
| `vault.adapter.exists()`              | Used internally        | Check file existence                         |
| `vault.adapter.stat()`                | `GET /vault/{path}`    | File stats (size, mtime, type)               |

### Metadata Cache API

| Obsidian API                   | Plugin Endpoint     | Notes                                   |
| ------------------------------ | ------------------- | --------------------------------------- |
| `metadataCache.getFileCache()` | `GET /vault/{path}` | Returns headings, tags, and frontmatter |

The `CachedMetadata` object actually contains much more (see [Not Exposed](#not-exposed-from-metadata-cache) below), but the plugin only surfaces headings, tags, and frontmatter.

### Commands API

| Obsidian API                        | Plugin Endpoint        | Notes                                    |
| ----------------------------------- | ---------------------- | ---------------------------------------- |
| `app.commands.commands`             | `GET /commands/`       | List all registered commands (ID + name) |
| `app.commands.executeCommandById()` | `POST /commands/{id}/` | Execute any command                      |

### Search

| Obsidian API            | Plugin Endpoint        | Notes                                            |
| ----------------------- | ---------------------- | ------------------------------------------------ |
| `prepareSimpleSearch()` | `POST /search/simple/` | Obsidian's built-in text search with scoring     |
| Dataview plugin API     | `POST /search/`        | DQL queries (requires Dataview community plugin) |
| JSON Logic              | `POST /search/`        | Query against file metadata/frontmatter          |

### Workspace API (Minimal)

| Obsidian API                | Plugin Endpoint     | Notes                     |
| --------------------------- | ------------------- | ------------------------- |
| `workspace.getActiveFile()` | `GET /active/`      | Get currently open file   |
| `workspace.openLinkText()`  | `POST /open/{path}` | Open a file in the editor |

### Periodic Notes (via Community Plugin)

| Obsidian API                     | Plugin Endpoint                                                      | Notes           |
| -------------------------------- | -------------------------------------------------------------------- | --------------- |
| `obsidian-daily-notes-interface` | `GET/PUT/POST/PATCH/DELETE /periodic/{period}/`                      | Current period  |
| `obsidian-daily-notes-interface` | `GET/PUT/POST/PATCH/DELETE /periodic/{period}/{year}/{month}/{day}/` | Arbitrary dates |

Supports daily, weekly, monthly, quarterly, and yearly periods. Requires the Periodic Notes community plugin or core Daily Notes plugin to be enabled.

### Content Patching

The plugin supports modifying specific parts of a note via `PATCH` requests with structured targets:

- **Heading target** — insert/replace content under a specific heading
- **Block target** — insert/replace content at a block reference
- **Frontmatter target** — set a specific frontmatter field

## What the Plugin Does NOT Expose

### File Rename/Move

**Obsidian API:** `vault.rename(file, newPath)`

The plugin has no rename or move endpoint. The only workaround is read -> create at new path -> delete old, but this **breaks all internal links** pointing to the original note. Obsidian's native `vault.rename()` automatically updates links across the vault.

### Backlinks and Outlinks (Link Graph)

**Obsidian API:** `metadataCache.resolvedLinks`, `metadataCache.unresolvedLinks`

The metadata cache maintains two pre-indexed maps:

- **`resolvedLinks`** — for every file, a map of files it links to (with counts). These are `[[wikilinks]]` or `[markdown](links)` that resolve to an existing file.
- **`unresolvedLinks`** — same structure, but for links that don't match any existing file.

**Outlinks** ("what does this note link to?") and **backlinks** ("what links to this note?") are both derivable from this data. None of it is exposed by the plugin.

We can technically parse outlinks from raw note content, but:

- We can't confirm whether a link resolves to an actual file (especially with duplicate names across folders)
- Getting backlinks for a note would require reading and parsing **every** note in the vault, vs. the pre-built index Obsidian already maintains

### Link Resolution

**Obsidian API:** `metadataCache.getFirstLinkpathDest(linkpath, sourcePath)`

Resolves a `[[wikilink]]` to its actual file path, handling shortest-path matching, folder context, and aliases. Not exposed.

### Not Exposed from Metadata Cache

The `CachedMetadata` object contains much more than what the plugin returns. Missing fields include:

| Field       | Description                                                                 |
| ----------- | --------------------------------------------------------------------------- |
| `links`     | All internal links with position info                                       |
| `embeds`    | All `![[embedded]]` content references                                      |
| `listItems` | All list items with hierarchy and checkbox state                            |
| `sections`  | All content sections (paragraphs, code blocks, etc.) with type and position |
| `blocks`    | Block reference IDs (`^block-id`)                                           |

### Trash (Safe Deletion)

**Obsidian API:** `vault.trash(file, system?)`

Moves files to Obsidian's `.trash` folder (or system trash, depending on user settings). The plugin's `DELETE` endpoint uses `vault.adapter.remove()` instead, which **permanently deletes** files with no recovery.

### Bookmarks

**Obsidian API:** Available via `app.internalPlugins`

Bookmarks is a **core plugin** (ships with Obsidian, enabled by default) but is architecturally a plugin, not part of the base API. Accessing it requires reaching into `app.internalPlugins`, which the REST API plugin doesn't do.

### Vault Configuration

No access to vault settings, appearance configuration, or plugin management.

## Gaps That Matter Most for This MCP Server

In priority order for an AI assistant workflow:

1. **File rename/move** — Can't safely reorganize notes without breaking links
2. **Backlinks** — Can't answer "what links to this note?" without reading every file
3. **Link resolution** — Can't verify if `[[wikilinks]]` resolve or find their targets
4. **Safe deletion** — Current delete is destructive; should use `vault.trash()` instead
5. **Richer metadata** — Access to lists, embeds, and sections would enable more structured note analysis

## References

- [Obsidian Local REST API — GitHub](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Obsidian Local REST API — Interactive Docs](https://coddingtonbear.github.io/obsidian-local-rest-api/)
- [Obsidian API TypeScript Definitions](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
