# Medium Tool Porting

**Created:** 2026-03-16
**Implementation Plan:** TBD
**Parent Spec:** [Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)

---

## Overview

**What:** Port 5 "medium" tools from the legacy HTTP-based MCP server to direct Obsidian API calls inside the plugin: `search` (simple + dataview), `periodic_read`, `tags_manage`, and `frontmatter_manage`.

**Why:** These tools currently route through the Local REST API plugin via HTTP. Porting them to direct API calls eliminates the REST API plugin dependency, reduces latency, and enables access to richer Obsidian APIs. This is session 4 of the plugin architecture decomposition.

**Type:** Refactor

---

## Requirements

### Must Have

- [ ] `search` tool works with `type: "simple"` using `prepareSimpleSearch()` from Obsidian API
- [ ] `search` tool works with `type: "dataview"` using Dataview plugin API (`tryQuery()`)
- [ ] Simple search iterates all markdown files via `getMarkdownFiles()` + `cachedRead()`
- [ ] Simple search includes filename matching (prepend basename before searching)
- [ ] Simple search returns response format matching legacy: `[{ filename, score, matches: [{ match: { start, end, source }, context }] }]`
- [ ] Dataview search returns transformed format matching legacy: `[{ filename, result: { field: value } }]`
- [ ] Dataview search validates TABLE type and rejects TABLE WITHOUT ID
- [ ] Dataview missing → clear error: "Dataview plugin is not installed or enabled"
- [ ] `periodic_read` resolves current period note via `obsidian-daily-notes-interface` package
- [ ] Periodic Notes plugin missing → clear error: "Periodic notes for {period} is not enabled"
- [ ] Periodic note doesn't exist → clear error: "No {period} note exists for the current period"
- [ ] `periodic_read` supports `format: "markdown"` (raw content) and `format: "json"` (content + frontmatter + tags + stat)
- [ ] `tags_manage` uses `processFrontMatter()` for add/remove operations
- [ ] Tags stored without `#` prefix in frontmatter (fixes legacy bug)
- [ ] Tags input and output use no `#` prefix; `#` stripped defensively from input
- [ ] `frontmatter_manage` read uses `metadataCache.getFileCache()`, excludes internal `position` key
- [ ] `frontmatter_manage` set uses `processFrontMatter()` with `JSON.parse()` fallback to raw string
- [ ] All user-provided paths normalized via `normalizePath()` before API calls
- [ ] All tools follow established registration pattern: `registerXTools(server: McpServer, app: App): void`
- [ ] All tools return `{ content: [{ type: "text", text }], isError?: boolean }` response format
- [ ] Tests for all 5 tools following existing vitest + jsdom patterns
- [ ] Mock additions for `processFrontMatter` on `FileManager`
- [ ] Tools wired into `main.ts` via `createMcpServer()`

### Nice to Have

- [ ] Dataview interface typed beyond minimal needs (e.g., result type discrimination)

### Out of Scope

- `periodic_update` (deferred to Hard session — requires heading/block/frontmatter content targeting)
- New tool parameters (e.g., search scope/path filter)
- Core Daily Notes fallback (require Periodic Notes plugin)
- `obsidian-dataview` as a package dependency (access via `app.plugins.getPlugin()` instead)

---

## Design Decisions

### 1. Simple search mirrors Local REST API behavior

**Options considered:**

1. Search file content only — simpler but misses filename matches
2. Mirror REST API behavior — prepend filename, search combined text, categorize matches as "filename" or "content"

**Decision:** Option 2. The legacy MCP tool returns whatever the REST API produces, so the response format must match for backward compatibility. The REST API prepends `file.basename + "\n\n"` to content, runs the search, then adjusts positions and filters boundary-spanning matches.

### 2. Dataview access via `app.plugins.getPlugin()`, not package import

**Options considered:**

1. Add `obsidian-dataview` as a dependency, use `import { getAPI } from "obsidian-dataview"`
2. Access via `app.plugins.getPlugin("dataview")` with a local typed interface

**Decision:** Option 2. Avoids a hard dependency on a community plugin package. Consistent with how we'd access any optional plugin. The local interface is minimal:

```typescript
interface DataviewQueryResult {
  successful: boolean;
  type: string;
  value: {
    headers: string[];
    values: unknown[][];
  };
}

interface DataviewApi {
  tryQuery(dql: string): Promise<DataviewQueryResult>;
  settings: { tableIdColumnName: string };
}

interface DataviewPlugin {
  api: DataviewApi;
}
```

### 3. Periodic Notes access via `obsidian-daily-notes-interface` package

**Options considered:**

1. Access Periodic Notes plugin directly via `app.plugins.getPlugin("periodic-notes")` and reimplement path resolution
2. Use `obsidian-daily-notes-interface` package (same as Local REST API plugin)

**Decision:** Option 2. The package provides clean helpers (`getDailyNote()`, `getAllDailyNotes()`, `appHasDailyNotesPluginLoaded()`, etc.) that handle settings lookup and date-based path resolution. Reimplementing this logic would be brittle and depend on the plugin's internal settings format.

A local accessor map routes period strings to the right functions:

```typescript
interface PeriodicNoteAccessor {
  isLoaded: () => boolean;
  getAll: () => Record<string, TFile>;
  get: (date: Moment, allNotes: Record<string, TFile>) => TFile | null;
}
```

### 4. Tags without `#` prefix (breaking change from legacy)

**Options considered:**

1. Keep `#` prefix in input/output (match legacy)
2. Remove `#` prefix in input/output (match YAML storage)

**Decision:** Option 2. The legacy tool wrote `#`-prefixed tags into frontmatter via the REST API's PATCH endpoint, which was a bug — Obsidian stores tags without `#` in YAML. Since `processFrontMatter()` works with raw YAML values, the correct behavior is no `#`. The Zod schema description is updated to say "No '#' prefix." Input is defensively stripped of `#` in case it's provided.

### 5. Frontmatter value parsing with JSON.parse fallback

**Decision:** When `frontmatter_manage` receives a `value` string for the `set` action, try `JSON.parse(value)` first, fall back to the raw string. This allows setting complex values (arrays, objects, numbers) via JSON strings while keeping simple string values natural. `processFrontMatter()` expects native JS values, not stringified JSON.

### 6. Frontmatter read excludes `position` key

**Decision:** When reading frontmatter via `metadataCache.getFileCache()`, the returned `FrontMatterCache` includes an internal `position` property from Obsidian's cache. This is metadata about the YAML block's location in the file, not user data. Strip it before returning.

---

## Acceptance Criteria

- [ ] `search` with `type: "simple"` returns matches across vault markdown files with context snippets
- [ ] `search` with `type: "simple"` matches against both filename and content
- [ ] `search` with `type: "dataview"` executes TABLE DQL queries and returns `[{ filename, result }]`
- [ ] `search` with `type: "dataview"` returns clear error when Dataview plugin is not installed
- [ ] `search` with `type: "dataview"` rejects non-TABLE queries and TABLE WITHOUT ID queries
- [ ] `periodic_read` returns current period note content in markdown or json format
- [ ] `periodic_read` returns clear error when Periodic Notes plugin is not enabled for the requested period
- [ ] `periodic_read` returns clear error when the current period's note doesn't exist
- [ ] `tags_manage` with `action: "list"` returns tags array without `#` prefix
- [ ] `tags_manage` with `action: "add"` adds tags to frontmatter without `#` prefix
- [ ] `tags_manage` with `action: "remove"` removes tags from frontmatter
- [ ] `tags_manage` defensively strips `#` from input tags
- [ ] `frontmatter_manage` with `action: "read"` returns frontmatter object without internal `position` key
- [ ] `frontmatter_manage` with `action: "set"` sets a field using `processFrontMatter()`
- [ ] `frontmatter_manage` with `action: "set"` parses JSON string values into native types
- [ ] All 5 tools register correctly and appear in MCP tool list
- [ ] All paths normalized via `normalizePath()` before vault API calls
- [ ] Unit tests cover happy paths and error cases for all tools

---

## Files to Create/Modify

```
plugin/src/tools/search.ts      # New — search tool (simple + dataview)
plugin/src/tools/search.test.ts  # New — search tool tests
plugin/src/tools/periodic.ts     # New — periodic_read tool
plugin/src/tools/periodic.test.ts # New — periodic_read tests
plugin/src/tools/metadata.ts     # New — tags_manage + frontmatter_manage tools
plugin/src/tools/metadata.test.ts # New — metadata tool tests
plugin/src/main.ts               # Modify — wire up new register functions
plugin/src/__mocks__/obsidian.ts  # Modify — add processFrontMatter to FileManager
plugin/package.json              # Modify — add obsidian-daily-notes-interface dependency
```

---

## References

- [Parent Spec: Plugin Architecture from Scaffold](./2026-03-12-1651-plugin-architecture-from-scaffold.md)
- [Obsidian API `prepareSimpleSearch`](../reference/obsidianmd/obsidian-api/obsidian.d.ts) — line 5088
- [Obsidian API `processFrontMatter`](../reference/obsidianmd/obsidian-api/obsidian.d.ts) — line 2830
- [Local REST API simple search implementation](../reference/obsidian-local-rest-api/src/requestHandler.ts) — lines 1134-1221
- [Local REST API dataview implementation](../reference/obsidian-local-rest-api/src/requestHandler.ts) — lines 1234-1321
- [Local REST API periodic notes implementation](../reference/obsidian-local-rest-api/src/requestHandler.ts) — lines 773-932
- [obsidian-typings `Plugins` interface](plugin/node_modules/obsidian-typings/dist/cjs/types.d.cts) — line 36254
