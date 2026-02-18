# Local REST API Companion Plugin

Research into building a companion Obsidian plugin that extends the [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) with additional endpoints, giving this MCP server access to Obsidian API features the REST API plugin doesn't currently expose.

## How the Extension API Works

The Local REST API plugin provides a public API that lets other Obsidian plugins register custom HTTP endpoints on its server. The interface is minimal:

```typescript
import { getAPI } from "obsidian-local-rest-api";

class MyPlugin extends Plugin {
  onload() {
    const restApi = getAPI(this.app, this.manifest);

    restApi
      .addRoute("/my-endpoint")
      .get((req, res) => {
        /* handle GET */
      })
      .post((req, res) => {
        /* handle POST */
      });
  }

  onunload() {
    // Routes are automatically cleaned up
  }
}
```

- `addRoute(path)` returns a standard Express.js `IRoute`
- Routes are automatically authenticated with the same API key
- Routes are mounted on the existing REST API server (no additional ports)
- `unregister()` removes all routes registered by the plugin

### Source References

- Extension API implementation: [`obsidian-local-rest-api/src/api.ts`](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/main/src/api.ts) (28 lines)
- Type definitions: [`obsidian-local-rest-api/main.d.ts`](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/main/main.d.ts)
- Official sample plugin: [obsidian-local-rest-api-sample-api-extension](https://github.com/coddingtonbear/obsidian-local-rest-api-sample-api-extension)
- Wiki: [Adding your own API Routes via an Extension](https://github.com/coddingtonbear/obsidian-local-rest-api/wiki/Adding-your-own-API-Routes-via-an-Extension)

## Stability Assessment

### Extension API

- Introduced in **v2.5**, unchanged through current **v3.4.3**
- Two methods total: `addRoute()` and `unregister()`
- No breaking changes in 2+ years
- No deprecation warnings or planned changes
- Standard Express.js routing patterns — well-understood, low-risk

### Local REST API Plugin Health

- Latest release: **v3.4.3** (February 7, 2026) — 5 releases in 2026
- 1,746 stars, 204 forks, ~239k downloads
- 1 open issue, 2 open PRs — extremely clean tracker
- Active sole maintainer who ships regularly and merges community PRs
- MIT licensed

### Risks

| Risk                                    | Severity | Mitigation                                                          |
| --------------------------------------- | -------- | ------------------------------------------------------------------- |
| Bus factor of 1 (single maintainer)     | Medium   | MIT license, 204 forks, stable API unlikely to need changes         |
| Users must install an additional plugin | Low      | Clear setup docs; already requiring Local REST API                  |
| Extension API could change in v4.0      | Low      | Only the v2 PATCH format is deprecated; extension API is unaffected |
| Express.js routing could be swapped out | Low      | No indication of this; would break all extensions                   |

### Endorsement from the Project

From `CONTRIBUTING.md`:

> "If you're looking to add new functionality that doesn't currently exist in the API, you may want to consider building an API extension instead of modifying the core project. API extensions are not subject to any gatekeeping by the core project and can be developed and released independently."

## Proposed Endpoints

Endpoints the companion plugin would add, mapped to the Obsidian API gaps identified in [obsidian-api-coverage.md](./obsidian-api-coverage.md):

### File Rename/Move

```
POST /ext/rename
Body: { "path": "old/path.md", "newPath": "new/path.md" }
```

Obsidian API: `vault.rename(file, newPath)` — automatically updates all internal links across the vault.

### Backlinks

```
GET /ext/backlinks/{filename}
Response: { "backlinks": [{ "source": "other-note.md", "count": 3 }] }
```

Obsidian API: `metadataCache.resolvedLinks` — pre-indexed map of all links. Traverse the reverse direction to find backlinks for a given file.

### Outlinks

```
GET /ext/outlinks/{filename}
Response: {
  "resolved": [{ "target": "some-note.md", "count": 2 }],
  "unresolved": [{ "target": "nonexistent-note", "count": 1 }]
}
```

Obsidian API: `metadataCache.resolvedLinks[filepath]` and `metadataCache.unresolvedLinks[filepath]`.

### Link Resolution

```
POST /ext/resolve-link
Body: { "linkpath": "Some Note", "sourcePath": "folder/current.md" }
Response: { "resolved": "folder/Some Note.md" }
```

Obsidian API: `metadataCache.getFirstLinkpathDest(linkpath, sourcePath)` — resolves `[[wikilinks]]` to actual file paths, handling shortest-path matching and folder context.

### Safe Delete (Trash)

```
DELETE /ext/trash/{filename}
Query: ?system=true (optional, use system trash instead of .trash)
```

Obsidian API: `vault.trash(file, system?)` — moves to Obsidian's `.trash` folder or system trash, respecting user settings. Contrast with the current `DELETE /vault/` which hard-deletes via `adapter.remove()`.

### Rich Metadata

```
GET /ext/metadata/{filename}
Response: {
  "links": [...],
  "embeds": [...],
  "listItems": [...],
  "sections": [...],
  "blocks": [...]
}
```

Obsidian API: `metadataCache.getFileCache(file)` — the full `CachedMetadata` object. The existing REST API only returns `headings`, `tags`, and `frontmatter`. This would expose the remaining fields:

- `links` — all internal links with position info
- `embeds` — all `![[embedded]]` content references
- `listItems` — list items with hierarchy and checkbox state
- `sections` — content sections (paragraphs, code blocks, etc.) with type and position
- `blocks` — block reference IDs (`^block-id`)

## Impact on This MCP Server

The companion plugin approach requires minimal changes to this MCP server:

1. **New endpoints to call** — add tool handlers that hit `/ext/*` routes
2. **No architectural changes** — same HTTP client, same auth, same pattern
3. **Graceful degradation** — if the companion plugin isn't installed, the core tools still work; the extended tools return clear error messages
4. **Setup documentation** — add companion plugin to the installation requirements

## Alternatives Considered

| Approach                             | Pros                                                                                  | Cons                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Companion plugin** (this proposal) | Full API access, minimal MCP server changes, explicitly supported by REST API project | Extra plugin for users to install                                                                     |
| **Contribute upstream**              | No extra plugin needed                                                                | Dependent on maintainer review; may not accept all features                                           |
| **Workarounds in MCP server**        | No plugin work needed                                                                 | Lossy (can't resolve links), slow (backlinks require reading all files), destructive (no safe delete) |
| **Full Obsidian plugin rewrite**     | Maximum control                                                                       | Entirely different project; lose standalone MCP server architecture                                   |

## Open Questions

- Should the companion plugin be published to the Obsidian community plugin registry, or distributed as a manual install?
- Should we prefix extension routes with `/ext/` or something else to avoid collisions?
- Are there additional Obsidian API features worth exposing beyond the six listed above?
- Should we contribute a PR upstream for any of these (e.g. rename and trash seem universally useful) in parallel?

## References

- [Obsidian API TypeScript Definitions](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
- [Local REST API — GitHub](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Sample Extension Plugin](https://github.com/coddingtonbear/obsidian-local-rest-api-sample-api-extension)
- [Extension Wiki](https://github.com/coddingtonbear/obsidian-local-rest-api/wiki/Adding-your-own-API-Routes-via-an-Extension)
- [API Coverage Research](./obsidian-api-coverage.md)
