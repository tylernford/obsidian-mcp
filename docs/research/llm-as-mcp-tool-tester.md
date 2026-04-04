# LLM-as-User-Tester for MCP Tools

**Core idea:** Use Claude not to test code, but to test the _user experience_ of MCP tools — are descriptions accurate, do errors help, do tools compose well, are there gaps? Claude is a real user of these tools, not a simulated one.

## Existing MCP Testing Landscape

Three layers exist today; the fourth (user experience) is the gap.

| Layer               | Tool                      | Question                                           |
| ------------------- | ------------------------- | -------------------------------------------------- |
| Protocol            | MCP Validator (Janix-ai)  | Does this server speak MCP correctly?              |
| Schema              | Specmatic MCP Auto-Test   | Does the implementation match the declared schema? |
| Behavior            | MCP Inspector (Anthropic) | What does this tool actually return?               |
| **User experience** | **Nothing yet**           | **Does this tool make sense to use?**              |

### MCP Inspector

- Maintained by Anthropic. Browser UI (port 6274) + CLI mode.
- React app + proxy server (port 6277) bridging browser to MCP transport.
- Shows raw responses but does NOT validate them. Debugging tool, not test framework.
- Run with: `npx @modelcontextprotocol/inspector <command>`
- CLI mode is scriptable, composable with `jq`.

### Specmatic MCP Auto-Test

- Schema drift detector. Fetches tool schemas, auto-generates test permutations, validates responses against declared output schemas.
- Key finding: Postman, Hugging Face, and GitHub MCP servers had fields declared optional that were actually required at runtime.
- Deterministic, repeatable, CI/CD-friendly. But purely mechanical.

### MCP Validator (Janix-ai)

- Protocol compliance testing. Validates initialization, capability negotiation, error response formats, session management, OAuth 2.1, batch requests, multi-version backward compat.
- Generates structured compliance reports.

## Prior Art: Adjacent Research

### Closest to this idea

- **mcp-tef** (MCP Tool Evaluation Framework) — Tests whether LLMs pick the right tool based on descriptions. Precision/recall/F1 for tool selection. Approaches from model side, not tool side.
- **"From Docs to Descriptions: Smell-Aware Evaluation of MCP Server Descriptions"** (arxiv) — 18 "smell categories" for bad tool descriptions across accuracy, functionality, completeness, conciseness. Essentially a linting framework for descriptions.
- **ToolScan** (2024) — Characterizes 7 error patterns in tool-use. Argues many are tool design issues, not model failures. Strongest academic validation of the premise.
- **ComplexFuncBench** (2025) — Found production API descriptions from major companies were "incomplete and even incorrect." Had to manually fix them to build benchmark.
- **"54 Patterns for Building Better MCP Tools"** (Arcade) — Pattern language for LLM-friendly tool design. Prescriptive, not evaluative.

### Tool-use benchmarks (test the MODEL, not the tools)

- **ToolBench** — 16,464 real-world REST APIs, 126k instruction-solution pairs. ICLR'24.
- **BFCL** (Berkeley Function Calling Leaderboard) — 1,000+ curated functions, AST-based evaluation. Does NOT evaluate tool description quality.
- **MCP-Bench** (Accenture) — 250 structured tools across 28 MCP servers. Tests tool retrieval, multi-hop planning, cross-tool coordination.
- **ToolTalk** (Microsoft) — Multi-turn conversational tool-use evaluation.
- **ToolSandbox** (Apple) — Stateful, conversational evaluation with user simulator.

### API usability research (traditional, pre-LLM)

- **Cognitive Dimensions Framework** — 12 dimensions for API usability, 83% effectiveness at identifying issues. Extended for security APIs.
- **API Walkthrough Method** — Lab-based evaluation where participants walk through code line-by-line.
- **DevEx metrics** — TTFHW (Time to First Hello World), TTFC, failed call percentage, SPACE framework.

### Agentic QA platforms (test apps, not tools)

- Mabl, SmartBear BearQ (March 2026), Momentic, Spur — autonomous QA agents for web/mobile/API testing. Self-healing, self-discovering. Different problem (testing applications, not testing the tools an LLM uses).

## What's Novel

Existing research treats tool quality as a **confounding variable to control for**, not the thing being measured:

- ToolScan noticed tool design causes errors → framed as benchmark observation
- ComplexFuncBench found bad descriptions → fixed them as prerequisite to real work
- mcp-tef measures tool selection accuracy → blames the model, not the tool

**Nobody has flipped the lens:** use LLM behavior as the signal for tool quality. The LLM isn't the subject — it's the instrument.

## What Claude-as-User-Tester Would Evaluate

- **Description accuracy** — Does the tool do what its description says?
- **Parameter intuitiveness** — Do names/schemas match a user's mental model?
- **Error helpfulness** — Do errors tell you what to fix?
- **Missing tools** — Are there workflow gaps where a tool should exist?
- **Composition** — Do tools chain together naturally (search → read → update)?
- **Consistency** — Do similar tools across servers behave consistently?

## Open Questions

- **Sandbox vs production** — Destructive tools (vault_delete) need safe testing environments.
- **Repeatability** — Claude's exploratory session is ephemeral. Need structured output format.
- **Scope of "user"** — Claude reads JSON schemas, not docs. Can't see UI reactions. This is "API consumer experience" testing specifically.
- **Permissions UX** — Claude Code prompts for permission on each tool call. How does this affect testing flow?
- **Cross-server comparison** — Same "kind" of tool across servers may diverge. Claude could surface this.

## Key Sources

- MCP Inspector: https://github.com/modelcontextprotocol/inspector
- Specmatic: https://specmatic.io/demonstration/testing-mcp-servers-how-specmatic-mcp-auto-test-catches-schema-drift-and-automates-regression/
- MCP Validator: https://github.com/Janix-ai/mcp-validator
- mcp-tef: https://dev.to/stacklok/introducing-mcp-tef-testing-your-mcp-tool-descriptions-before-they-cause-problems-fan
- ToolScan: https://arxiv.org/abs/2411.13547
- ComplexFuncBench: https://arxiv.org/abs/2501.10132
- Smell-Aware Evaluation: https://arxiv.org/html/2602.18914
- 54 MCP Tool Patterns: https://www.arcade.dev/blog/mcp-tool-patterns
- REST APIs as LLM Tools framework: https://arxiv.org/abs/2504.15546
