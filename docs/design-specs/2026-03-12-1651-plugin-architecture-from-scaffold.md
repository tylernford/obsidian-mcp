# Plugin Architecture from Scaffold

**Created:** 2026-03-12
**Implementation Plan:** N/A (decomposed into downstream design sessions)
**Parent Spec:** [Convert to Obsidian Plugin](./2026-03-12-1317-convert-to-obsidian-plugin.md)

---

## Overview

**What:** Define the target architecture for converting the standalone MCP server into a native Obsidian plugin, using the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) as a reference implementation for conventions and patterns.

**Why:** The parent spec establishes _what_ we're building and _why_. This spec grounds those decisions in Obsidian's official plugin patterns — file structure, build system, lifecycle, and conventions — providing a concrete architectural reference that downstream design sessions can decompose into implementable pieces.

**Type:** Refactor

---

## Architecture

### Current

```
Claude Code <--stdio--> MCP Server (Node.js) <--HTTP--> Local REST API plugin <--> Obsidian
```

### Target

```
Claude Code <--HTTP--> Obsidian Plugin (HTTP server + MCP) <--> Obsidian API
```

The plugin runs an HTTP server inside Obsidian's Electron process, serving MCP via the Streamable HTTP transport. Claude Code connects directly over HTTP.

---

## Target Plugin Structure

Based on the sample plugin scaffold, adapted for this project:

```
manifest.json              # Plugin metadata (isDesktopOnly: true)
package.json               # pnpm, deps, build/dev/lint scripts
tsconfig.json              # ES6 target, CJS output (per scaffold pattern)
esbuild.config.mjs         # Bundle src/main.ts → main.js
eslint.config.mts          # typescript-eslint + eslint-plugin-obsidianmd
version-bump.mjs           # Syncs versions across manifest/versions.json
versions.json              # Obsidian version compatibility map
styles.css                 # Empty (settings use Obsidian's Setting API)
src/
  main.ts                  # Plugin class — onload/onunload, server lifecycle
  settings.ts              # Settings tab — API key display/copy/regenerate, port
  server.ts                # HTTP server + Streamable HTTP transport + auth
  tools/
    vault.ts               # vault_list, vault_read, vault_create, vault_update, vault_delete
    search.ts              # search (simple + dataview)
    metadata.ts            # tags_manage, frontmatter_manage
    commands.ts            # commands_list, commands_execute
    active-file.ts         # active_file_read, active_file_update
    navigation.ts          # file_open
    periodic.ts            # periodic_read, periodic_update
```

### What Carries Over from Current Codebase

- Tool names, descriptions, and Zod parameter schemas
- Response formatting patterns (`{ content, isError? }`)
- Tool module organization (7 files, same groupings)

### What's New (from scaffold patterns)

- Plugin lifecycle (`extends Plugin`, `onload`/`onunload`)
- Settings tab (`extends PluginSettingTab`, Obsidian's `Setting` class)
- esbuild bundling (CJS, single `main.js`, externalize `obsidian`/`electron`/`@codemirror/*`)
- `manifest.json` + `versions.json` for Obsidian version compatibility
- `version-bump.mjs` for version synchronization

### What's Replaced

| Current                | Target                          | Reason                                       |
| ---------------------- | ------------------------------- | -------------------------------------------- |
| `src/index.ts`         | `src/main.ts`                   | Plugin entry point replaces server bootstrap |
| `src/api-client.ts`    | Direct `app` API calls in tools | No HTTP middleman                            |
| `src/errors.ts`        | Removed                         | No HTTP error mapping needed                 |
| `StdioServerTransport` | `StreamableHTTPServerTransport` | HTTP transport for direct client connections |
| `dist/` output (ESM)   | `main.js` at root (CJS)         | Obsidian loads plugins via `require()`       |

---

## Requirements

### Must Have

- [ ] Plugin loads/unloads cleanly following scaffold lifecycle patterns
- [ ] HTTP server starts on `onload()`, stops on `onunload()`
- [ ] Streamable HTTP transport serving MCP on configurable port
- [ ] API key auth — auto-generated on first load, persisted in `data.json`, displayed in settings with copy and regenerate
- [ ] All 15 existing MCP tools with identical names, Zod parameter schemas, and response formats
- [ ] Direct `app` API access replacing all HTTP-to-REST-API calls
- [ ] All user-provided vault paths normalized via `normalizePath()` before API calls
- [ ] esbuild bundling into single `main.js` (CJS, ES2018 target)
- [ ] `manifest.json` with required fields, `isDesktopOnly: true`
- [ ] pnpm as package manager
- [ ] ESLint with `typescript-eslint` + `eslint-plugin-obsidianmd`

### Nice to Have

- [ ] Configurable port in settings (with sensible default)

### Out of Scope

- New tools or features
- HTTPS support
- Community plugin registry publishing
- Stdio or WebSocket transports

---

## Design Decisions

### 1. Sample plugin as reference implementation (not copy-paste)

Replicate the scaffold's patterns and conventions tailored to this project rather than copying the sample plugin and gutting it. The sample plugin contains demo code (ribbon icons, modals, sample settings) that would need to be deleted, and our `package.json`, `tsconfig.json`, and build config need project-specific adjustments. Using it as a reference keeps diffs clean and produces purpose-built files.

### 2. Build system conventions (from scaffold)

Follow the scaffold's esbuild configuration pattern:

- Entry: `src/main.ts` → `main.js` (project root)
- Format: CJS (Obsidian uses `require()`)
- Target: ES2018
- Externals: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*`
- Bundled deps: Zod, MCP SDK (not externalized — they're our dependencies, not Obsidian's)
- Dev mode: watch + inline sourcemaps
- Production: minified, no sourcemaps
- Tree shaking enabled

### 3. Plugin lifecycle (from scaffold)

Follow the scaffold's `Plugin` subclass pattern:

- `onload()`: load settings → start HTTP server → add settings tab
- `onunload()`: stop HTTP server (cleanup registered via scaffold's `this.register*()` helpers where applicable)
- Settings via `this.loadData()` / `this.saveData()` → persisted in Obsidian's `data.json`

### 4. Settings tab (from scaffold)

Follow the scaffold's `PluginSettingTab` pattern using Obsidian's `Setting` class:

- API key: displayed read-only, copy button, regenerate button
- Port: text input with default value
- No custom CSS needed — `Setting` provides the UI

### 5. Auth via auto-generated API key

Random API key generated on first load, persisted in `data.json`. Validated on every HTTP request via `Authorization: Bearer <key>`. Requests without a valid token receive 401. This mirrors the Local REST API plugin's auth pattern.

### 6. Manifest conventions

- `id`: Cannot contain "obsidian" per submission requirements (e.g., `mcp-tools`)
- `isDesktopOnly: true` (Node.js `http` module required)
- `minAppVersion`: target current stable Obsidian

---

## Constraints

- **Node.js runtime**: Dictated by Obsidian's Electron version (currently Node 20.18.x with Electron 32). No `engines` field. All code must run on Node 20+.
- **Bundle format**: CJS required — Obsidian loads plugins via `require()`.
- **Single entry point**: esbuild produces one `main.js`. No dynamic imports, no separate chunks.
- **`isDesktopOnly: true`**: Required because the plugin uses Node.js `http` module.
- **Plugin ID**: Cannot contain "obsidian" per Obsidian submission requirements.
- **Undocumented APIs**: `commands.commands`, `commands.executeCommandById()`, Dataview plugin API, Periodic Notes plugin API are internal/third-party and could break across Obsidian versions.

---

## Tool Porting Reference

All 15 tools keep identical names, Zod schemas, and response formats. The change is how they access Obsidian — direct `app` API instead of HTTP through the REST API plugin.

### Trivial (direct API equivalents)

| Tool               | Current                    | New                                              |
| ------------------ | -------------------------- | ------------------------------------------------ |
| `vault_list`       | `GET /vault/{path}/`       | `app.vault.getAbstractFileByPath()` + children   |
| `vault_read`       | `GET /vault/{filename}`    | `app.vault.read(file)` / `cachedRead(file)`      |
| `vault_create`     | `PUT /vault/{filename}`    | `app.vault.create(path, content)`                |
| `vault_delete`     | `DELETE /vault/{filename}` | `app.vault.trash(file, true)`                    |
| `commands_list`    | `GET /commands/`           | `(app as any).commands.commands`                 |
| `commands_execute` | `POST /commands/{id}/`     | `(app as any).commands.executeCommandById(id)`   |
| `active_file_read` | `GET /active/`             | `app.workspace.getActiveFile()` + `vault.read()` |
| `file_open`        | `POST /open/{filename}`    | `app.workspace.openLinkText(path, "")`           |

### Medium (integration work needed)

| Tool                 | Notes                                          |
| -------------------- | ---------------------------------------------- |
| `search` (simple)    | `prepareSimpleSearch()` from Obsidian API      |
| `search` (dataview)  | Dataview plugin API (undocumented internal)    |
| `periodic_read`      | Periodic Notes plugin API for path resolution  |
| `periodic_update`    | Same path resolution + structured update       |
| `tags_manage`        | Parse frontmatter, modify tags, write back     |
| `frontmatter_manage` | `app.fileManager.processFrontMatter(file, fn)` |

### Hard (must reimplement)

| Tool                 | Notes                                                     |
| -------------------- | --------------------------------------------------------- |
| `vault_update`       | Heading/block/frontmatter targeting via `Vault.process()` |
| `active_file_update` | Same logic, file from `getActiveFile()`                   |

### Convention

All user-provided vault paths must be normalized via `normalizePath()` before any `app.vault.*` call.

---

## Acceptance Criteria

- [ ] Plugin loads in Obsidian without errors, unloads cleanly
- [ ] HTTP server starts on enable, stops on disable, no orphaned listeners
- [ ] API key auto-generated on first load, visible in settings, copyable, regenerable
- [ ] Claude Code connects via `claude mcp add --transport http`
- [ ] All 15 tools register with identical names and schemas
- [ ] File operations work (list, read, create, update, delete)
- [ ] Search works (simple text + Dataview DQL)
- [ ] Commands work (list + execute)
- [ ] Active file works (read + update)
- [ ] Navigation works (file_open)
- [ ] Periodic notes work (read + update)
- [ ] Structured updates work (heading, block, frontmatter targeting)
- [ ] Auth works (missing/invalid Bearer token → 401)
- [ ] Builds to single `main.js` via esbuild

---

## Suggested Decomposition

This spec is designed to be broken into downstream design sessions, each producing its own design spec and implementation plan. Suggested sessions in dependency order:

### 1. Scaffold & Build Config

Replicate the sample plugin's project structure: `package.json` (pnpm), `tsconfig.json`, `esbuild.config.mjs`, `manifest.json`, `versions.json`, `version-bump.mjs`, ESLint config, `styles.css`, empty `src/main.ts`. **Goal:** a loadable plugin that does nothing.

### 2. HTTP Server & Auth

`server.ts` and `settings.ts`. Stand up the HTTP server in `onload()`, tear down in `onunload()`, wire up Streamable HTTP transport, implement API key generation/validation/settings UI. **Goal:** plugin serves MCP with auth, no tools registered yet.

### 3. Trivial Tool Porting

Port the 8 tools with direct API equivalents (vault CRUD, commands, active file read, file open). **Goal:** basic file operations and commands work through the plugin.

### 4. Medium Tool Porting

Search (simple + dataview), periodic notes, tags, frontmatter. **Goal:** all tools except structured updates work.

### 5. Structured Updates

`vault_update` and `active_file_update`. Reimplement heading/block/frontmatter content targeting with `Vault.process()`. **Goal:** all 15 tools functional.

Sessions 1–2 are sequential. Sessions 3–5 could potentially parallelize once the server is running.

---

## References

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin) — scaffold reference (local: `obsidianmd/obsidian-sample-plugin/`)
- [Obsidian Developer Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) (local: `obsidianmd/obsidian-developer-docs/`)
- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) (local: `obsidianmd/obsidian-api/`)
- [Obsidian ESLint Plugin](https://github.com/obsidianmd/eslint-plugin) (local: `obsidianmd/eslint-plugin/`)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `StreamableHTTPServerTransport`
- [Parent Spec: Convert to Obsidian Plugin](./2026-03-12-1317-convert-to-obsidian-plugin.md)
