# Backlog

Ideas, enhancements, and future work for obsidian-mcp.

---

## Convert to Obsidian Plugin

**Source:** Comparison with [obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp) (2026-02-13)

**Idea:** Rewrite the MCP server as an Obsidian plugin instead of a standalone Node.js process that talks to the Local REST API plugin over HTTP. This would eliminate the dependency on the Local REST API plugin and give us direct access to Obsidian's `app` API.

**Current architecture:**

```
Claude Code <--stdio--> MCP Server <--HTTP--> Local REST API plugin <--> Obsidian
```

**Proposed architecture:**

```
Claude Code <--stdio/ws--> Obsidian Plugin <--> Obsidian
```

**Benefits:**

- Remove Local REST API plugin dependency (one plugin instead of two)
- No HTTP middleman — direct `app` API access
- No auth/API key management needed
- Simpler stack for end users

**Trade-offs:**

- Must maintain an Obsidian plugin (TypeScript, esbuild, Obsidian plugin API)
- More friction to develop and test vs. standalone Node.js
- Structured update logic (insert at heading/block/frontmatter) currently handled server-side by the REST API would need to be reimplemented locally

**Effort estimate: ~15-20 hours**

| Category                                                      | Hours | Notes                                                                                                                                    |
| ------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Trivial swaps (commands, navigation, vault CRUD)              | 2-3   | Direct `app.vault` / `app.commands` equivalents                                                                                          |
| Medium (search, metadata, periodic notes, plugin scaffolding) | 4-6   | Dataview and Periodic Notes plugin integration needed                                                                                    |
| Hard (vault_update, active_file_update, periodic_update)      | 6-8   | Must reimplement heading/block/frontmatter content targeting locally. periodic_update deferred from medium — needs same targeting logic. |
| Testing and edge cases                                        | 3-4   |                                                                                                                                          |

**What carries over as-is:** Tool definitions, parameter schemas (Zod), response formatting, error response patterns.

**What gets rewritten:** Transport layer (delete api-client.js entirely), entry point (plugin class instead of stdio server), structured update logic.

**Decision:** Keep current architecture for now. Revisit if the two-plugin dependency becomes a friction point.

---

## Path Traversal Validation

**Source:** Comparison with obsidian-claude-code-mcp (2026-02-13)

**Idea:** Add path validation to reject `..` and `~` in file paths before sending to the REST API. Their implementation uses a simple `normalizePath()` check. We should verify whether the REST API already handles this, and add validation if not.

---

## Actionable Error Messages

**Source:** Comparison with obsidian-claude-code-mcp (2026-02-13)

**Idea:** Improve error messages to include actionable guidance. For example, when Obsidian isn't running, suggest starting it. When auth fails, point to the REST API plugin settings. Their project detects specific error types (`EADDRINUSE`, `EACCES`) and provides targeted help text.

---

## Research: jacksteamdev/obsidian-mcp-tools

**Source:** Comparison research (2026-02-13)

**Idea:** A third project worth reviewing. Uses the same Local REST API backend as ours but adds semantic search (via Smart Connections plugin) and Templater integration. Currently seeking new maintainers. Worth checking for ideas around semantic search and template execution.

---

## Workflow Design

**Source:** Design doc follow-up (2026-02-13)

**Idea:** Design how to best use the MCP tools day-to-day. Now that all 15 tools are available, figure out common workflows — e.g., daily note routines, search-then-edit patterns, Dataview query conventions, command execution use cases. Capture these as repeatable patterns.

---

## Refactor to StreamableHTTPSessionManager

**Source:** Stateless mode research (2026-03-18)

**Idea:** Replace our manual HTTP routing and transport management in `server.ts` with the SDK's higher-level `StreamableHTTPSessionManager`. Currently we use `StreamableHTTPServerTransport` directly and handle session routing, method dispatch, and transport lifecycle ourselves. `StreamableHTTPSessionManager` encapsulates all of this — you pass it a config and call `session_manager.handle_request()`. FastMCP uses this approach.

**Benefits:**

- Less custom code to maintain
- SDK handles edge cases in routing/lifecycle
- Easier to toggle between stateful and stateless modes

**Trade-offs:**

- Larger diff for no immediate behavioral change
- Less visibility into request handling

**Decision:** Not worth doing alongside the stateless mode conversion. Revisit if `server.ts` routing logic grows more complex.

---

## Tool Handler Integration Tests

**Source:** Stateless HTTP mode build (2026-03-18)

**Idea:** Add a test that registers a tool on the `McpServer`, sends a `tools/list` and `tools/call` request, and verifies the response. Currently the test suite covers auth, routing, stateless POST behavior, and lifecycle — but never exercises an actual tool round-trip. This gap predates the stateless conversion.

---

## CLAUDE.md MCP Conventions

**Source:** Design doc follow-up (2026-02-13)

**Idea:** Add MCP tool usage conventions to CLAUDE.md once workflows are established. This would guide Claude Code on when to prefer MCP tools over direct file access (e.g., always use `search` instead of grepping the vault, use `vault_update` for targeted edits instead of rewriting files).
