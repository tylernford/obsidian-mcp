# Trivial Tool Porting

**Created:** 2026-03-15
**Implementation Plan:** [Trivial Tool Porting](../implementation-plans/2026-03-15-2303-trivial-tool-porting.md)
**Parent Spec:** [Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)

---

## Overview

**What:** Port the 8 MCP tools that have direct Obsidian API equivalents into the plugin, replacing HTTP-to-REST-API calls with direct `app` API access.

**Why:** These tools form the core file operations and command interface. They have straightforward API mappings and no complex reimplementation work, making them the natural first batch to port after the server infrastructure is in place.

**Type:** Refactor

---

## Requirements

### Must Have

- [ ] 8 tools registered on the `McpServer` with identical names, descriptions, and Zod parameter schemas as legacy
- [ ] Response format unchanged: `{ content: [{ type: "text", text }], isError? }`
- [ ] All user-provided paths normalized via `normalizePath()` before any `app.vault.*` call
- [ ] `vault_delete` uses `vault.trash(file, true)` (safe delete, not hard delete)
- [ ] `vault_read` supports both `markdown` and `json` formats, assembling json from `metadataCache`
- [ ] `vault_list` returns `{ files: [...] }` matching REST API shape (trailing `/` for directories)
- [ ] Tools wired into `main.ts` via `createMcpServer()`
- [ ] Unit tests for each tool module
- [ ] Obsidian mock expanded to support tool testing

### Nice to Have

- [ ] N/A

### Out of Scope

- `vault_update` (structured updates — session 5)
- `active_file_update` (structured updates — session 5)
- New tools or features
- Changes to server, auth, or settings

---

## Tools

### vault.ts — 4 tools

#### `vault_list`

|              | Legacy                              | Plugin                                            |
| ------------ | ----------------------------------- | ------------------------------------------------- |
| **API**      | `GET /vault/{path}/`                | `app.vault.getAbstractFileByPath()` + `.children` |
| **Params**   | `path?: string`                     | Same                                              |
| **Response** | `{ files: ["note.md", "folder/"] }` | Same shape — trailing `/` for dirs, sorted        |

- Empty/omitted path → `app.vault.getRoot()` for vault root listing
- Path resolves to non-existent or non-folder → error response

#### `vault_read`

|                         | Legacy                                                                | Plugin                                                          |
| ----------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| **API**                 | `GET /vault/{filename}`                                               | `app.vault.read(file)` + `app.metadataCache.getFileCache(file)` |
| **Params**              | `filename: string`, `format: "markdown" \| "json"` (default `"json"`) | Same                                                            |
| **Response (markdown)** | Raw file content string                                               | Same                                                            |
| **Response (json)**     | `{ content, frontmatter, tags, stat }`                                | Assembled from `metadataCache`                                  |

- `format: "json"` assembles response from `vault.read()` for content and `metadataCache.getFileCache()` for frontmatter, tags, and file stat
- Non-existent file → error response

#### `vault_create`

|              | Legacy                                | Plugin                            |
| ------------ | ------------------------------------- | --------------------------------- |
| **API**      | `PUT /vault/{filename}`               | `app.vault.create(path, content)` |
| **Params**   | `filename: string`, `content: string` | Same                              |
| **Response** | `"Created {filename}"`                | Same                              |

- Obsidian's `create()` throws if file exists → catch and return error response
- Parent folders created automatically by Obsidian

#### `vault_delete`

|              | Legacy                     | Plugin                        |
| ------------ | -------------------------- | ----------------------------- |
| **API**      | `DELETE /vault/{filename}` | `app.vault.trash(file, true)` |
| **Params**   | `filename: string`         | Same                          |
| **Response** | `"Deleted {filename}"`     | Same                          |

- Uses `vault.trash(file, true)` — moves to system trash instead of hard delete (deliberate improvement over legacy `adapter.remove()`)
- Non-existent file → error response

### commands.ts — 2 tools

#### `commands_list`

|              | Legacy                       | Plugin                           |
| ------------ | ---------------------------- | -------------------------------- |
| **API**      | `GET /commands/`             | `(app as any).commands.commands` |
| **Params**   | None                         | Same                             |
| **Response** | JSON array of `{ id, name }` | Same                             |

- `app.commands` is undocumented — access via `(app as any).commands.commands`
- Returns object keyed by command ID; map to array for response

#### `commands_execute`

|              | Legacy                            | Plugin                                         |
| ------------ | --------------------------------- | ---------------------------------------------- |
| **API**      | `POST /commands/{id}/`            | `(app as any).commands.executeCommandById(id)` |
| **Params**   | `commandId: string`               | Same                                           |
| **Response** | `"Executed command: {commandId}"` | Same                                           |

- `executeCommandById()` returns boolean — `false` means command not found → error response

### active-file.ts — 1 tool

#### `active_file_read`

|              | Legacy                                            | Plugin                                           |
| ------------ | ------------------------------------------------- | ------------------------------------------------ |
| **API**      | `GET /active/`                                    | `app.workspace.getActiveFile()` + `vault.read()` |
| **Params**   | `format: "markdown" \| "json"` (default `"json"`) | Same                                             |
| **Response** | Same as `vault_read` for the active file          | Same                                             |

- `getActiveFile()` returns `TFile | null` — `null` means no active file → error response
- Format handling identical to `vault_read`

### navigation.ts — 1 tool

#### `file_open`

|              | Legacy                                                    | Plugin                                          |
| ------------ | --------------------------------------------------------- | ----------------------------------------------- |
| **API**      | `POST /open/{filename}`                                   | `app.workspace.openLinkText(path, "", newLeaf)` |
| **Params**   | `filename: string`, `newLeaf?: boolean` (default `false`) | Same                                            |
| **Response** | `"Opened {filename}"`                                     | Same                                            |

---

## Design Decisions

### 1. Function signature: `registerXTools(server, app)`

**Options considered:**

1. `(server: McpServer, app: App)` — tools get the App object directly
2. `(server: McpServer, plugin: MCPToolsPlugin)` — tools get the plugin instance

**Decision:** Option 1. All tools (including medium and hard tools in future sessions) only need `app.vault`, `app.workspace`, `app.metadataCache`, and `app.plugins`. No tool needs plugin-level state. Passing `app` keeps tools decoupled from the plugin class.

### 2. `vault_delete` uses safe delete

**Options considered:**

1. `vault.adapter.remove()` — hard delete, matches legacy behavior
2. `vault.trash(file, true)` — moves to system trash

**Decision:** Option 2. The legacy hard delete was a limitation of the REST API plugin, not a design choice. Safe delete is strictly better — files are recoverable. This is a deliberate improvement.

### 3. `vault_list` response matches REST API shape

**Decision:** Return `{ files: ["note.md", "folder/"] }` with trailing `/` for directories, sorted alphabetically. Matches the existing REST API format so tool consumers see no difference.

### 4. `vault_read` json format assembled from metadataCache

**Decision:** Support both `markdown` and `json` formats to match legacy behavior. The `json` format is assembled from `app.vault.read()` (content) + `app.metadataCache.getFileCache()` (frontmatter, tags) + `file.stat` (file stats). This replaces the REST API's `application/vnd.olrapi.note+json` content type.

---

## Acceptance Criteria

- [ ] `vault_list` returns files and folders at a given path, matching REST API shape
- [ ] `vault_list` with no path returns vault root contents
- [ ] `vault_list` with non-existent path returns error
- [ ] `vault_read` with `format: "markdown"` returns raw file content
- [ ] `vault_read` with `format: "json"` returns content, frontmatter, tags, and stat
- [ ] `vault_read` with non-existent file returns error
- [ ] `vault_create` creates a new file with given content
- [ ] `vault_create` with existing filename returns error
- [ ] `vault_delete` moves file to trash via `vault.trash()`
- [ ] `vault_delete` with non-existent file returns error
- [ ] `commands_list` returns all registered commands as `{ id, name }` array
- [ ] `commands_execute` executes a valid command and returns success
- [ ] `commands_execute` with unknown command returns error
- [ ] `active_file_read` returns active file content (both formats)
- [ ] `active_file_read` with no active file returns error
- [ ] `file_open` opens a file in Obsidian
- [ ] `file_open` with `newLeaf: true` opens in a new tab
- [ ] All paths normalized via `normalizePath()` before API calls
- [ ] All tools registered on `McpServer` via `createMcpServer()` in `main.ts`
- [ ] Unit tests pass for all 4 tool modules

---

## Suggested Files to Create/Modify

```
plugin/src/tools/vault.ts          # vault_list, vault_read, vault_create, vault_delete
plugin/src/tools/commands.ts       # commands_list, commands_execute
plugin/src/tools/active-file.ts    # active_file_read
plugin/src/tools/navigation.ts     # file_open
plugin/src/tools/vault.test.ts     # vault tool tests
plugin/src/tools/commands.test.ts  # command tool tests
plugin/src/tools/active-file.test.ts  # active file tool tests
plugin/src/tools/navigation.test.ts   # navigation tool tests
plugin/src/main.ts                 # wire register*Tools() into createMcpServer()
plugin/src/__mocks__/obsidian.ts   # expand with TFile, TFolder, Vault methods, Workspace, MetadataCache, normalizePath
```

---

## References

- [Parent Spec: Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)
- [Legacy Tool Implementations](../../legacy/src/tools/)
- [API Coverage Research](../research/obsidian-api-coverage.md)
- [Obsidian API TypeScript Definitions](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
