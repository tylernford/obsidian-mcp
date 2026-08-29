# Current Architecture

This document is the canonical description of the repository's current runtime architecture. Material under [`design-specs/`](design-specs/), [`implementation-plans/`](implementation-plans/), and older [`notes/`](notes/) is chronological design history and may describe superseded approaches.

## System context and process boundary

Obsidian Desktop loads the plugin and hosts both its lifecycle and its access to the live Obsidian API. Claude Code or another MCP client sends authenticated requests over loopback HTTP. The plugin calls Obsidian directly; the removed standalone server and Local REST API bridge are not part of the current architecture.

```text
Claude Code or another MCP client
  | HTTP POST /mcp on 127.0.0.1 + Bearer key
  v
HttpServer (plugin/src/server.ts)
  | creates for each POST
  v
McpServer + sessionless StreamableHTTPServerTransport
  | registers seven tool families / 15 tools
  v
Obsidian APIs ---- optional Dataview and Periodic Notes / Daily Notes integrations
```

The plugin is desktop-only, as declared by [`plugin/manifest.json`](../plugin/manifest.json), because it embeds a Node HTTP server.

## Lifecycle and configuration

[`MCPToolsPlugin.onload()`](../plugin/src/main.ts) performs the runtime setup:

1. It loads persisted settings and merges them with `DEFAULT_SETTINGS`.
2. It loads the API key from Obsidian SecretStorage or generates and stores a new key.
3. It constructs `HttpServer` with the configured port, host `127.0.0.1`, API key, and MCP-server factory.
4. It starts the listener and shows an Obsidian Notice if initial startup fails.
5. It registers the plugin settings tab.

The default port is `28080`, defined in [`plugin/src/settings.ts`](../plugin/src/settings.ts). Only the port is part of the settings saved through `data.json`; the API key is held under `mcp-api-key` in SecretStorage.

`onunload()` stops the listener. Regenerating the API key or applying a port change calls `restartServer()`, which stops the existing server, destroys tracked active sockets, constructs a new server, and starts it with the current configuration. These changes therefore drop active MCP connections. A failed restart has no transactional rollback to the prior listener.

## Request and transport flow

[`plugin/src/server.ts`](../plugin/src/server.ts) implements the HTTP boundary.

1. Every request is authenticated before routing. Authorization succeeds only when the header is exactly `Authorization: Bearer <configured-key>`.
2. Authenticated requests outside `/mcp` receive `404`.
3. `GET` and `DELETE` on `/mcp` receive an MCP-shaped `405`; other unsupported methods receive a generic JSON `405`.
4. A `POST /mcp` body is buffered and parsed as JSON.
5. The request creates a fresh `StreamableHTTPServerTransport` with no session ID, then a fresh `McpServer` through the plugin factory. The factory registers the complete tool catalog.
6. The MCP server connects to the transport, the transport handles the request, and the transport closes in `finally`.

This is stateless per-POST operation: there is no cross-request MCP session state and no server-initiated persistent channel. Each request also pays the MCP-server construction and tool-registration cost. The current broad error boundary maps JSON parse errors and other failures inside POST handling to the same generic `400 Invalid request body` response; this records existing behavior rather than defining a desired long-term error model.

## Tools and integration boundaries

The MCP surface consists of tools only. The plugin does not currently register MCP resources or prompts.

| Family         | Registrar                                              | Tools                                                                      |
| -------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Vault          | [`vault.ts`](../plugin/src/tools/vault.ts)             | `vault_list`, `vault_read`, `vault_create`, `vault_delete`, `vault_update` |
| Commands       | [`commands.ts`](../plugin/src/tools/commands.ts)       | `commands_list`, `commands_execute`                                        |
| Active file    | [`active-file.ts`](../plugin/src/tools/active-file.ts) | `active_file_read`, `active_file_update`                                   |
| Navigation     | [`navigation.ts`](../plugin/src/tools/navigation.ts)   | `file_open`                                                                |
| Search         | [`search.ts`](../plugin/src/tools/search.ts)           | `search`                                                                   |
| Periodic notes | [`periodic.ts`](../plugin/src/tools/periodic.ts)       | `periodic_read`, `periodic_update`                                         |
| Metadata       | [`metadata.ts`](../plugin/src/tools/metadata.ts)       | `tags_manage`, `frontmatter_manage`                                        |

That is seven registrar modules and 15 registered tools. Structured updates from vault, active-file, and periodic-note operations share [`update-utils.ts`](../plugin/src/tools/update-utils.ts), which builds instructions and delegates Markdown mutation to `markdown-patch`.

Two features cross optional integration boundaries:

- Dataview DQL search uses the Dataview plugin API when Dataview is installed and enabled.
- Periodic-note discovery and creation use `obsidian-daily-notes-interface`, backed by Periodic Notes or core Daily Notes configuration as applicable.

All other tool operations use the live Obsidian API directly.

## Security and trust model

Binding to `127.0.0.1` limits direct network exposure, but loopback is not a sandbox and does not protect the server from untrusted local processes. The exact Bearer API key is the sole server-side authorization boundary. Possession of the key grants access to every registered tool; there are no narrower scopes.

The key is displayed in the settings UI and may be copied to the system clipboard. Regenerating it invalidates existing client configuration, so clients must update their `Authorization` header and reconnect.

The tool catalog includes privileged capabilities:

- creating, updating, and deleting vault content;
- mutating frontmatter and tags;
- opening files and changing UI navigation state; and
- executing any command ID present in Obsidian's registered command catalog, including commands contributed by other plugins.

The current server has no per-tool authorization, command allowlist, MCP-originated write confirmation, rate limiting, request-size limit, request timeout, or audit log. It also does not add transport encryption to loopback HTTP. Do not expose the endpoint through a proxy or network tunnel without adding authentication, encrypted transport, network restrictions, and other controls appropriate to the new exposure.

## Validation boundaries

The validation model deliberately combines automated checks with runtime evidence:

- [`docs/testing-guidelines.md`](testing-guidelines.md) defines the automated unit and HTTP integration boundaries and their known gaps.
- [`testing/live-validation/README.md`](../testing/live-validation/README.md) defines the structured, operator-mediated process against a real Obsidian instance.
- [`testing/live-validation/log.md`](../testing/live-validation/log.md) is the canonical current known-issues ledger.

Automated tests do not currently provide an end-to-end production `tools/list`/`tools/call` path through every registered schema and handler, and live validation is not a repository-owned CI gate.

## Build and distribution boundary

[`plugin/esbuild.config.mjs`](../plugin/esbuild.config.mjs) bundles `plugin/src/main.ts` into generated `plugin/main.js`; that generated file is ignored by Git. The desktop manifest is maintained at [`plugin/manifest.json`](../plugin/manifest.json), and the repository includes an empty, optional conventional [`plugin/styles.css`](../plugin/styles.css) placeholder.

The documented setup is a source/development workflow: build locally, then symlink the `plugin/` directory into a vault. The repository is not currently published through Obsidian Community Plugins and contains no automated release workflow or distributable-release pipeline.
