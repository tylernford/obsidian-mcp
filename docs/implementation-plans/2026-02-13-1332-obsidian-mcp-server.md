# Implementation Plan: Obsidian MCP Server

**Design Doc:** docs/design-plans/2026-02-13-1254-obsidian-mcp-server.md
**Created:** 2026-02-13

---

## Summary

Build a Node.js MCP server that wraps Obsidian's Local REST API (30 HTTP endpoints on localhost:27123) into 15 MCP tools for Claude Code. The server uses stdio transport, authenticates via `OBSIDIAN_API_KEY` environment variable, and handles Obsidian-offline errors gracefully.

---

## Codebase Verification

*Confirmed assumptions from design doc against actual codebase and API spec.*

- [x] Repo is greenfield — only docs scaffolding exists. No source files, no package.json. Verified.
- [x] All 14 REST API endpoints referenced in design doc exist and match the OpenAPI spec at `obsidian-local-rest-api/docs/openapi.yaml`. Verified.
- [x] Auth is Bearer token in Authorization header (`scheme: "bearer"`, `type: "http"`). Verified.
- [x] HTTP mode available on port 27123 (HTTPS on 27124). Design doc correctly targets HTTP. Verified.
- [x] MCP SDK `@modelcontextprotocol/sdk` v1.26.0 supports `server.tool()` API with Zod schemas and `StdioServerTransport`. Verified.
- [x] PATCH endpoints use custom headers (`Operation`, `Target-Type`, `Target`) not body fields. Verified.
- [x] GET endpoints support `Accept: application/vnd.olrapi.note+json` for JSON response with parsed frontmatter/tags. Verified.
- [x] Search uses Content-Type header to distinguish DQL (`application/vnd.olrapi.dataview.dql+txt`) from JsonLogic. Simple search uses query params. Verified.

**Patterns to leverage:**
- REST API's Accept header controls response format — we can request JSON with parsed frontmatter by default for richer tool responses
- PATCH header-based targeting is consistent across `/vault/{filename}`, `/active/`, and `/periodic/{period}/` — API client can share one patch helper

**Discrepancies found:**
- None. Design doc matches the actual API spec.

---

## Tasks

### Task 1: Initialize project and create API client

**Description:** Set up the Node.js project with ES module support and install dependencies (`@modelcontextprotocol/sdk`, `zod`). Create the HTTP client that wraps the Local REST API with Bearer token auth, configurable base URL, and graceful error handling for connection failures (Obsidian offline).

**Files:**
- `package.json` — create
- `src/api-client.js` — create

**Code example:** API client shape:
```js
// src/api-client.js
export class ObsidianClient {
  constructor({ apiKey, host, port }) { ... }

  // Core request method — all tools use this
  async request(method, path, { body, headers, queryParams } = {}) { ... }

  // Shared PATCH helper (used by vault_update, active_file_update, periodic_update)
  async patch(path, { operation, targetType, target, content, createIfMissing }) { ... }
}
```

Key implementation details:
- Auth: `Authorization: Bearer ${apiKey}` header on every request
- Base URL: `http://${host}:${port}` (defaults: `localhost`, `27123`)
- Error handling: catch `fetch` connection errors → return clear "Obsidian is not running" message
- Parse JSON error responses (API returns `{errorCode, message}`)
- `patch()` helper maps params to REST API headers:
  - `operation` → `Operation` header (`append` | `prepend` | `replace`)
  - `targetType` → `Target-Type` header (`heading` | `block` | `frontmatter`)
  - `target` → `Target` header (URL-encoded if non-ASCII)
  - `createIfMissing` → `Create-Target-If-Missing` header
  - `content` → request body with `Content-Type: text/markdown`

**Done when:** `npm install` succeeds. API client module exports `ObsidianClient` class with `request()` and `patch()` methods. No runtime errors on import.

**Commit:** "Add project setup and REST API client"

---

### Task 2: Create MCP server entry point with vault_list and vault_read

**Description:** Create the MCP server with stdio transport and implement the first two vault tools. This is the pattern-setting task — it establishes how tools are structured, registered, and how they return responses. `vault_list` and `vault_read` are read-only GET operations that prove the server starts, connects to the REST API, and returns data.

**Files:**
- `index.js` — create (server setup, tool imports, stdio transport)
- `src/tools/vault.js` — create (2 tools initially)

**Code example:** Entry point and tool registration pattern:
```js
// index.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ObsidianClient } from "./src/api-client.js";
import { registerVaultTools } from "./src/tools/vault.js";

const client = new ObsidianClient({
  apiKey: process.env.OBSIDIAN_API_KEY,
  host: process.env.OBSIDIAN_API_HOST,
  port: process.env.OBSIDIAN_API_PORT,
});

const server = new McpServer({ name: "obsidian", version: "1.0.0" });
registerVaultTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
```

```js
// src/tools/vault.js
export function registerVaultTools(server, client) {
  server.tool("vault_list", ...);
  server.tool("vault_read", ...);
}
```

**Tool input schemas:**

`vault_list`:
```js
{
  path: z.string().optional()
    .describe("Directory path relative to vault root. Omit to list root.")
}
```
- REST: `GET /vault/` (root) or `GET /vault/{path}/` (subdirectory)
- Response: `{files: ["note.md", "subfolder/"]}` — directories end with `/`

`vault_read`:
```js
{
  filename: z.string()
    .describe("Path to file relative to vault root (e.g. 'folder/note.md')"),
  format: z.enum(["markdown", "json"]).default("json")
    .describe("'json' returns parsed frontmatter, tags, and file stats. 'markdown' returns raw content.")
}
```
- REST: `GET /vault/{filename}` with `Accept` header:
  - `json` → `Accept: application/vnd.olrapi.note+json` → returns `{content, frontmatter, tags, stat, path}`
  - `markdown` → `Accept: text/markdown` → returns raw markdown string

**Done when:** `node index.js` launches without error. Server registers 2 vault tools. Can be added to Claude Code via `claude mcp add` and responds to tool calls.

**Commit:** "Add MCP server entry point with vault_list and vault_read"

---

### Task 3: Add vault_create, vault_update, and vault_delete

**Description:** Add the write operations to the vault tools. This exercises PUT, PATCH, and DELETE methods and proves the API client's `patch()` helper works correctly with the header-based targeting.

**Files:**
- `src/tools/vault.js` — modify (add 3 tools)

**Tool input schemas:**

`vault_create`:
```js
{
  filename: z.string()
    .describe("Path for the new note relative to vault root (e.g. 'folder/note.md')"),
  content: z.string()
    .describe("Markdown content for the new note")
}
```
- REST: `PUT /vault/{filename}` with `Content-Type: text/markdown`, body is content
- Returns 204 on success. Overwrites if file exists.

`vault_update`:
```js
{
  filename: z.string()
    .describe("Path to file relative to vault root"),
  operation: z.enum(["append", "prepend", "replace"])
    .describe("How to apply the update relative to the target"),
  targetType: z.enum(["heading", "block", "frontmatter"])
    .describe("Type of target to update"),
  target: z.string()
    .describe("Target identifier. Headings: use '::' delimiter for nesting (e.g. 'Heading 1::Subheading'). Blocks: block reference ID (e.g. '2d9b4a'). Frontmatter: field name (e.g. 'tags')."),
  content: z.string()
    .describe("Content to insert or replace with"),
  createIfMissing: z.boolean().optional().default(false)
    .describe("If true, create the target if it doesn't exist (useful for new frontmatter fields)")
}
```
- REST: `PATCH /vault/{filename}` with headers `Operation`, `Target-Type`, `Target`, optionally `Create-Target-If-Missing`
- Body: content as `text/markdown`

`vault_delete`:
```js
{
  filename: z.string()
    .describe("Path to file relative to vault root")
}
```
- REST: `DELETE /vault/{filename}`
- Returns 204 on success. 404 if file doesn't exist.

**Done when:** 5 total tools registered. Can create a test note, update it via heading/frontmatter targeting, and delete it.

**Commit:** "Add vault_create, vault_update, and vault_delete tools"

---

### Task 4: Add search and metadata tools

**Description:** Implement the search tool (supporting both Dataview DQL queries and simple text search via a `type` parameter) and the two metadata tools (`tags_manage`, `frontmatter_manage`).

**Files:**
- `src/tools/search.js` — create
- `src/tools/metadata.js` — create
- `index.js` — modify (import and register new tools)

**Tool input schemas:**

`search`:
```js
{
  type: z.enum(["simple", "dataview"])
    .describe("'simple' for full-text search, 'dataview' for Dataview DQL queries"),
  query: z.string()
    .describe("For 'simple': text to search for. For 'dataview': a TABLE-type DQL query (e.g. 'TABLE file.name FROM #tag')"),
  contextLength: z.number().optional().default(100)
    .describe("(simple only) Characters of context to return around each match")
}
```
- Simple: `POST /search/simple/?query={query}&contextLength={contextLength}` (query in URL params, no body)
  - Returns: `[{filename, score, matches: [{match: {start, end}, context}]}]`
- DQL: `POST /search/` with `Content-Type: application/vnd.olrapi.dataview.dql+txt`, body is the query string
  - Returns: `[{filename, result}]`

`tags_manage`:
```js
{
  filename: z.string()
    .describe("Path to file relative to vault root"),
  action: z.enum(["list", "add", "remove"])
    .describe("'list' returns current tags. 'add'/'remove' modify the tags."),
  tags: z.array(z.string()).optional()
    .describe("Tags to add or remove (required for 'add' and 'remove'). Include '#' prefix.")
}
```
- `list`: `GET /vault/{filename}` with `Accept: application/vnd.olrapi.note+json`, return the `tags` array from response
- `add`/`remove`: Read current tags via GET, compute new tag list, write via `PATCH /vault/{filename}` with `Target-Type: frontmatter`, `Target: tags`, `Operation: replace`, body is JSON array

`frontmatter_manage`:
```js
{
  filename: z.string()
    .describe("Path to file relative to vault root"),
  action: z.enum(["read", "set"])
    .describe("'read' returns all frontmatter fields. 'set' updates a specific field."),
  key: z.string().optional()
    .describe("(set only) Frontmatter field name to update"),
  value: z.string().optional()
    .describe("(set only) Value to set. For complex values (arrays, objects), pass a JSON string.")
}
```
- `read`: `GET /vault/{filename}` with `Accept: application/vnd.olrapi.note+json`, return the `frontmatter` object
- `set`: `PATCH /vault/{filename}` with `Target-Type: frontmatter`, `Target: {key}`, `Operation: replace`, `Create-Target-If-Missing: true`, body is value (use `Content-Type: application/json` for structured values)

**Done when:** 8 total tools registered. Search returns results for both DQL and simple queries. Metadata tools read/write frontmatter and tags.

**Commit:** "Add search and metadata tools"

---

### Task 5: Add commands and active file tools

**Description:** Implement command listing/execution and active file read/update tools.

**Files:**
- `src/tools/commands.js` — create
- `src/tools/active-file.js` — create
- `index.js` — modify (import and register new tools)

**Tool input schemas:**

`commands_list`:
```js
{} // no input parameters
```
- REST: `GET /commands/`
- Returns: `{commands: [{id: "global-search:open", name: "Search: Search in all files"}, ...]}`

`commands_execute`:
```js
{
  commandId: z.string()
    .describe("Command ID to execute (e.g. 'global-search:open'). Use commands_list to find available IDs.")
}
```
- REST: `POST /commands/{commandId}/` — no body
- Returns 204 on success, 404 if command doesn't exist

`active_file_read`:
```js
{
  format: z.enum(["markdown", "json"]).default("json")
    .describe("'json' returns parsed frontmatter, tags, and stats. 'markdown' returns raw content.")
}
```
- REST: `GET /active/` with same `Accept` header logic as `vault_read`
- Returns 404 if no file is currently open

`active_file_update`:
```js
{
  operation: z.enum(["append", "prepend", "replace"])
    .describe("How to apply the update relative to the target"),
  targetType: z.enum(["heading", "block", "frontmatter"])
    .describe("Type of target to update"),
  target: z.string()
    .describe("Target identifier (same format as vault_update)"),
  content: z.string()
    .describe("Content to insert or replace with"),
  createIfMissing: z.boolean().optional().default(false)
    .describe("If true, create the target if it doesn't exist")
}
```
- REST: `PATCH /active/` with same PATCH headers as `vault_update`

**Done when:** 12 total tools registered. Can list commands, execute one, read the active file, and update it.

**Commit:** "Add commands and active file tools"

---

### Task 6: Add navigation and periodic note tools

**Description:** Implement file opening in the Obsidian UI and periodic note read/update tools.

**Files:**
- `src/tools/navigation.js` — create
- `src/tools/periodic.js` — create
- `index.js` — modify (import and register new tools)

**Tool input schemas:**

`file_open`:
```js
{
  filename: z.string()
    .describe("Path to file relative to vault root"),
  newLeaf: z.boolean().optional().default(false)
    .describe("If true, open in a new tab instead of replacing the current one")
}
```
- REST: `POST /open/{filename}?newLeaf={newLeaf}`
- Returns 200. Note: Obsidian creates the file if it doesn't exist.

`periodic_read`:
```js
{
  period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"])
    .describe("Which periodic note to read"),
  format: z.enum(["markdown", "json"]).default("json")
    .describe("'json' returns parsed frontmatter, tags, and stats. 'markdown' returns raw content.")
}
```
- REST: `GET /periodic/{period}/` with same `Accept` header logic as `vault_read`
- Returns 404 if the periodic note doesn't exist yet

`periodic_update`:
```js
{
  period: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"])
    .describe("Which periodic note to update"),
  operation: z.enum(["append", "prepend", "replace"])
    .describe("How to apply the update relative to the target"),
  targetType: z.enum(["heading", "block", "frontmatter"])
    .describe("Type of target to update"),
  target: z.string()
    .describe("Target identifier (same format as vault_update)"),
  content: z.string()
    .describe("Content to insert or replace with"),
  createIfMissing: z.boolean().optional().default(false)
    .describe("If true, create the target if it doesn't exist")
}
```
- REST: `PATCH /periodic/{period}/` with same PATCH headers as `vault_update`
- Note: If the periodic note doesn't exist yet, PATCH will fail. The tool should fall back to `POST /periodic/{period}/` to create it first (POST creates from template).

**Done when:** All 15 tools registered. `node index.js` starts cleanly with all tools.

**Commit:** "Add navigation and periodic note tools"

---

### Task 7: Add README and final verification

**Description:** Create README.md with prerequisites, installation steps, MCP registration command, environment variable reference, and tool listing. Verify the server starts and registers all 15 tools.

**Files:**
- `README.md` — create

**Done when:** README covers: prerequisites (Node.js 18+, Obsidian with Local REST API plugin), installation (`npm install`), configuration (`claude mcp add` command with env var), and lists all 15 tools with descriptions. `node index.js` starts with all 15 tools registered without errors.

**Commit:** "Add README with setup instructions"

---

## Acceptance Criteria

*Mapped from design doc. Each criterion is testable after the relevant task.*

- [x] **MCP server starts**: `node index.js` launches without error and registers all 15 tools (Tasks 2-6)
- [x] **Claude Code connects**: `claude mcp list` shows the obsidian server; `/mcp` in a session shows connected status (Task 2)
- [x] **File operations work**: Can list, read, create, update, and delete notes through MCP tools (Tasks 2-3)
- [x] **Search works**: Can run both simple text searches and Dataview DQL queries (Task 4)
- [x] **Commands work**: Can list all Obsidian commands and execute one (Task 5)
- [x] **Active file works**: Can read the currently open note without specifying a path (Task 5)
- [x] **Navigation works**: Can open a note in Obsidian's UI from Claude Code (Task 6)
- [x] **Periodic notes work**: Can read/write today's daily note by date reference (Task 6)
- [x] **Auth works**: Server uses `OBSIDIAN_API_KEY` env var; fails gracefully with clear error if missing (Task 1)
- [x] **Obsidian offline**: Server returns clear error messages when Obsidian isn't running — doesn't crash (Task 1)

---

## Notes

- **OpenAPI spec location**: Full API spec is at `../obsidian-local-rest-api/docs/openapi.yaml` for reference during build
- **PATCH header convention**: All PATCH endpoints (vault, active file, periodic) share identical header semantics (`Operation`, `Target-Type`, `Target`, `Target-Delimiter`, `Create-Target-If-Missing`, `Trim-Target-Whitespace`). The API client's `patch()` helper should be reused across all three tool modules.
- **Accept header convention**: GET endpoints for file content all support three Accept types. Default to `application/vnd.olrapi.note+json` for structured JSON responses.
- **Path encoding**: File paths go directly into the URL path (e.g., `/vault/folder/note.md`) — do NOT use `encodeURIComponent()` on the full path as it would encode `/` to `%2F`. Instead, split by `/`, encode each segment individually, and rejoin. The `Target` header value must be URL-encoded for non-ASCII characters.
- **ES modules**: package.json needs `"type": "module"` for the MCP SDK's import paths (e.g., `@modelcontextprotocol/sdk/server/mcp.js`).
- **No stdout logging**: stdio transport uses stdout for JSON-RPC. All debug/error logging must go to stderr.
