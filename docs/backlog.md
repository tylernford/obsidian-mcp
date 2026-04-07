# Backlog

Ideas, enhancements, and future work for obsidian-mcp.

---

## Research: jacksteamdev/obsidian-mcp-tools

**Source:** Comparison research (2026-02-13)

**Idea:** A third project worth reviewing. Uses the same Local REST API backend as ours but adds semantic search (via Smart Connections plugin) and Templater integration. Currently seeking new maintainers. Worth checking for ideas around semantic search and template execution.

---

## Workflow Design

**Source:** Design doc follow-up (2026-02-13)

**Idea:** Design how to best use the MCP tools day-to-day. Now that all 15 tools are available, figure out common workflows — e.g., daily note routines, search-then-edit patterns, Dataview query conventions, command execution use cases. Capture these as repeatable patterns.

## CLAUDE.md MCP Conventions

**Source:** Design doc follow-up (2026-02-13)

**Idea:** Add MCP tool usage conventions to CLAUDE.md once workflows are established. This would guide Claude Code on when to prefer MCP tools over direct file access (e.g., always use `search` instead of grepping the vault, use `vault_update` for targeted edits instead of rewriting files).

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

## `frontmatter_manage` Missing Value Validation

**Source:** Test spec review (2026-04-04)

**Idea:** The `frontmatter_manage` set action doesn't validate that `value` is provided. The Zod schema marks `value` as `.optional()` and the description says "Required for 'set' action," but nothing enforces it. When `value` is omitted, the key is silently set to `undefined`. Add a guard matching the existing `key` validation pattern — return an error like "Value is required for set action" when `value` is `undefined` and `action` is `"set"`.

---

## Inconsistent 405 Error Format in `server.ts`

**Source:** Server test review (2026-04-05)

**Idea:** When a client hits `/mcp` with the wrong HTTP method, they get two different error formats depending on which wrong method they used. GET/DELETE return a JSON-RPC shape (`{ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }`), while PUT and other methods return a generic shape (`{ error: "Method Not Allowed" }`). Pick one format for all 405s — probably the JSON-RPC shape since this is a JSON-RPC endpoint. See `server.ts` `handleRequest`, the split between the GET/DELETE branch and the fallback. If fixed, update the GET and PUT routing tests in `server.test.ts` to assert the same response shape.

---

## Live Tool Validation

**Source:** Testing refactor design spec (2026-04-06)

**Idea:** Define a structured protocol for verifying MCP tools work correctly against a real Obsidian instance. A Claude Code session connected to a test vault follows a checklist covering full CRUD lifecycle, targeting mechanics (headings, blocks, frontmatter), error handling, and cross-cutting concerns (metadata cache timing, large content). Produces session reports and a maintained structured log of known issues.

**Design spec:** `docs/design-specs/2026-04-03-1550-testing-refactor.md` (child spec #2)
**Research:** `docs/research/live-tool-validation.md`

---

## Agent User Testing

**Source:** Testing refactor design spec (2026-04-06)

**Idea:** Evaluate MCP tools from an agent consumer's perspective — not "does it work?" but "does it make sense to use?" A Claude Code session uses the tools to accomplish real tasks and assesses description accuracy, parameter intuitiveness, error helpfulness, missing tools, composition, and consistency. Exploratory rather than scripted. Produces session reports and feeds findings back into tool improvements.

**Design spec:** `docs/design-specs/2026-04-03-1550-testing-refactor.md` (child spec #3)
**Research:** `docs/research/llm-as-mcp-tool-tester.md`

---

## MCP Protocol Seam: Failure Mode Tests

**Source:** Backlog review (2026-04-06)

**Idea:** The server tests exercise HTTP → MCP `initialize`, and the tool tests call handlers directly (bypassing JSON-RPC and Zod validation entirely). Neither layer tests what happens at the seam between them. Three specific failure modes fall through this gap:

1. **Unknown tool name** — `tools/call` with a nonexistent tool should produce a proper JSON-RPC error response, not a 500 or hung connection.
2. **Schema validation failure** — `tools/call` with args that violate the tool's Zod schema (wrong type, missing required field) should return a validation error, not crash. This also catches schema definition bugs (e.g., `z.number()` where the handler expects a string) since current tests call handlers directly with correctly-typed args.
3. **Handler exception** — When a tool handler throws (as opposed to returning `{ isError: true }`), the client should receive a usable JSON-RPC error. No test currently verifies whether the SDK catches this or the connection dies.

A happy-path round-trip test (register tool, call it, assert response) would not be valuable — it mirrors the SDK's own behavior with no edge case coverage.
