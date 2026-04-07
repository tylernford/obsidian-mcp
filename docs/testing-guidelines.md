# Testing Guidelines

## Testing Philosophy

Every test must catch something that would otherwise go undetected. This means:

- **No mirror tests** — tests that re-implement production logic to verify it produces the same output provide no safety net. If the code changes, the test changes identically, and regressions pass through both.
- **Focus on edges** — boundary conditions, failure modes, and off-by-one errors are where bugs live. Happy paths are covered only to verify the overall shape of a result.
- **Test our logic, not libraries** — we don't test that `JSON.parse` works or that `String.split` splits. We test that _our_ use of them handles the cases we care about (malformed input, empty strings, fallback behavior).

---

## The Three Validation Layers

Our code passes through three separate validation stages, each catching different classes of problems:

| Layer             | Tool                                          | What it checks                                             | What it misses                                  |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| **Type checking** | `pnpm typecheck` (`tsc` + `obsidian-typings`) | Correct usage of documented and undocumented Obsidian APIs | Whether the types match runtime behavior        |
| **Unit tests**    | vitest + obsidian mock                        | Our logic (branching, error handling, response formatting) | Whether the mock accurately represents Obsidian |
| **Runtime**       | Obsidian app                                  | Everything actually works                                  | Nothing (this is ground truth)                  |

Each layer operates on different type information:

- **`tsc`** resolves `"obsidian"` to the real `obsidian.d.ts` from `node_modules/obsidian`, augmented by `obsidian-typings` (configured in `tsconfig.json` `types` array). This is how undocumented APIs like `app.commands` get type coverage during builds.
- **vitest** resolves `"obsidian"` to our manual mock at `plugin/src/__mocks__/obsidian.ts` (via the alias in `vitest.config.ts`). Tests run against these mock types.
- **Obsidian runtime** uses the real API. This is the only place where behavior is guaranteed to be correct.

The mock and `obsidian-typings` can diverge from reality independently. A test can pass (mock is happy) and the build can succeed (`obsidian-typings` is happy) while the actual Obsidian API behaves differently. This is inherent to mocking a closed-source host application. Runtime testing in Obsidian is the final validation before release.

---

## Modules Under Test

### Why These Four

Each module was evaluated against two criteria: (1) does it contain meaningful logic (branching, parsing, transformation)? and (2) what is the risk if it breaks?

| Module            | Lines | Logic density                                                         | Risk                     | Test type   |
| ----------------- | ----- | --------------------------------------------------------------------- | ------------------------ | ----------- |
| `update-utils.ts` | 84    | High — JSON parse with fallback, `::` splitting, error type matching  | Content corruption       | Unit        |
| `search.ts`       | 217   | High — position offset math, match categorization, Dataview transform | Wrong search results     | Unit        |
| `server.ts`       | 119   | Medium — auth, routing with format distinction, lifecycle             | Auth bypass, broken API  | Integration |
| `metadata.ts`     | 185   | Medium — tag normalization, dedup, JSON parse, position stripping     | Data loss in frontmatter | Unit        |

### Why Not the Others

| Module           | Lines | Reason for exclusion                                             |
| ---------------- | ----- | ---------------------------------------------------------------- |
| `crypto.ts`      | 5     | Single line — `randomBytes(32).toString("hex")`                  |
| `settings.ts`    | 203   | UI rendering with trivial port validation                        |
| `commands.ts`    | 61    | Thin wrapper — maps command registry, calls `executeCommandById` |
| `navigation.ts`  | 29    | Single `openLinkText` call                                       |
| `main.ts`        | 105   | Lifecycle glue — delegation and wiring                           |
| `active-file.ts` | 96    | Guards + delegation to `update-utils`                            |
| `periodic.ts`    | 210   | Guards + delegation to `update-utils`                            |
| `vault.ts`       | 227   | Guards + delegation to `update-utils`                            |

These modules are thin wrappers around Obsidian APIs or delegation to modules we do test. Traditional tests for them would either mirror production logic or test Obsidian behavior — both banned by our philosophy. They are validated by runtime testing against a real Obsidian instance.

---

## Mock Strategy

### Guiding Principle

Mock minimally. Obsidian's internals are unpublished — any mock is "what we think Obsidian does based on type signatures and observed behavior." The more behavior we bake in, the more we're guessing and the more likely the mock drifts from reality.

### Mock Boundary

| Dependency             | Approach                                                                                                                                               | Reasoning                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Obsidian               | Minimal stubs in `__mocks__/obsidian.ts` + per-test `vi.fn()`                                                                                          | Can't run in tests, side effects, behavioral mock would be fragile guesswork           |
| `markdown-patch`       | Mock `applyPatch` only; real `PatchFailed`/`ContentType`/`PatchFailureReason` via `importOriginal` pass-through; test `buildPatchInstruction` directly | Pure function testable in isolation; real error classes needed for `instanceof` checks |
| `McpServer` (tools)    | Fake object with `registerTool` spy to capture handlers                                                                                                | Testing our handler logic, not the MCP SDK's registration machinery                    |
| `McpServer` (server)   | Real instance via `createMcpServer` factory — not mocked                                                                                               | Server tests are integration tests; the real MCP transport is part of the test         |
| HTTP (for `server.ts`) | Real integration — start server, use `fetch`                                                                                                           | The module is the integration point; localhost is fast and deterministic               |

### The Obsidian Mock

**Location:** `plugin/src/__mocks__/obsidian.ts`

The mock contains exactly three exports:

| Export                | Type                | Needed by                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TFile`               | Real class          | `update-utils`, `metadata` (source); `search` (tests only) | Must be a real class. `instanceof TFile` checks are in every file-resolving handler — if the mock exports anything other than a class, those checks silently return `false`. This column lists only modules under test; other modules (`active-file`, `vault`, `periodic`) also import `TFile` but are validated at runtime. `search.ts` doesn't import `TFile`, but `search.test.ts` needs it to create mock file objects. |
| `normalizePath`       | Real implementation | `metadata`                                                 | Pure string normalizer (~5 lines). Strips and collapses slashes.                                                                                                                                                                                                                                                                                                                                                            |
| `prepareSimpleSearch` | `vi.fn()` stub      | `search`                                                   | Tests wire up return values via `vi.mocked(prepareSimpleSearch)`.                                                                                                                                                                                                                                                                                                                                                           |

Everything else (App interfaces, Vault stubs, Workspace, UI components) is provided per-test via `vi.fn()` mocks.

### Rules for Expanding the Mock

1. **Only add what you need.** If a new test file needs an Obsidian export, add it. Don't pre-populate.
2. **Match the signature from `obsidian-typings`.** Check the [obsidian-typings repo](https://github.com/Fevol/obsidian-typings) for type signatures.
3. **`TFile` must remain a real class.** It is instantiated directly in tests and checked via `instanceof` in production code.
4. **Keep it small.** The mock should be trivially auditable — if it grows beyond ~40 lines, something is wrong.

### Callback Mock Pattern

Obsidian APIs like `processFrontMatter` accept a callback that mutates an object in-place. Mocks for these must invoke the callback with a controlled object, not just record that the method was called:

```typescript
const frontmatter: Record<string, unknown> = { tags: ["existing"] };
mockProcessFrontMatter.mockImplementation((_file, cb) => cb(frontmatter));
// ... call the handler ...
expect(frontmatter.tags).toEqual(["existing", "newtag"]);
```

This pattern is used in `tags_manage` add/remove tests and `frontmatter_manage` set tests.

---

## Tool Test Pattern

Tool tests (search, metadata) follow a consistent structure:

### 1. Capture handlers via a fake McpServer

Create a plain object with a `registerTool` spy that captures handler references. For single-tool modules, capture into a variable directly. For multi-tool modules, route by name:

```typescript
// Single tool (search.ts) — one handler variable
let handler: ToolHandler;

const fakeMcpServer = {
  registerTool: vi.fn((_name: string, _schema: unknown, fn: ToolHandler) => {
    handler = fn;
  }),
};
```

```typescript
// Multiple tools (metadata.ts) — route by name
let tagsHandler: TagsHandler;
let frontmatterHandler: FrontmatterHandler;

const fakeMcpServer = {
  registerTool: vi.fn(
    (_name: string, _schema: unknown, fn: TagsHandler | FrontmatterHandler) => {
      if (_name === "tags_manage") tagsHandler = fn as TagsHandler;
      else if (_name === "frontmatter_manage")
        frontmatterHandler = fn as FrontmatterHandler;
    },
  ),
};
```

### 2. Create a mock App with `makeApp`

```typescript
function makeApp(): App {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      // ... only what tools call
    },
  } as unknown as App;
}
```

Use `as unknown as App` because the mock is intentionally partial.

### Registration strategies

There are two approaches for wiring up the app with tool registration:

- **Re-register per test** (`search.test.ts`) — call the register function in `beforeEach`, passing the current `app`. Simple, but re-registers handlers every test.
- **Register once with Proxy** (`metadata.test.ts`) — register once at module scope, passing a `Proxy` that delegates property access to a mutable `app` variable. Tests swap `app` freely without re-registering:

```typescript
registerMetadataTools(
  fakeMcpServer as unknown as McpServer,
  new Proxy({} as App, {
    get: (_target, prop) =>
      (app as unknown as Record<string | symbol, unknown>)[prop],
  }),
);
```

Either approach works. The Proxy pattern is more efficient when the module registers multiple tools.

### 3. Call handlers directly

Call the captured handler variables directly — no indirection needed:

```typescript
const result = await handler({
  query: "hello",
  type: "simple",
  contextLength: 100,
});
```

### 4. Clean up between tests

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

## Integration Test Pattern: `server.ts`

`server.ts` is tested with a real HTTP server, not mocks. The module _is_ the integration point — its value is in how auth, routing, and the MCP transport interact over HTTP.

### Setup

- Start a real `HttpServer` on port `0` (OS-assigned random port) per test via `makeServer()` in `beforeEach`
- `afterEach` calls `stop()` to prevent hanging processes
- The `createMcpServer` factory creates a real `McpServer` — one test wraps it with `vi.fn()` to assert it was called, but the underlying function is not replaced

### What gets tested

- **Auth:** Missing header, wrong token, valid token — verified via status codes
- **Routing:** POST `/mcp` proceeds, GET `/mcp` returns 405 with JSON-RPC error, other methods (e.g. PUT) return 405 with plain error, unknown paths return 404
- **Request handling:** Malformed JSON returns 400, valid MCP requests flow through the transport
- **Lifecycle:** Start/stop cycle, stopping with no active server

### Why integration over unit

The individual methods (`authenticate`, `handleRequest`) are small and tightly coupled. Testing them in isolation would require mocking `http.IncomingMessage` and `http.ServerResponse` — more complex than just hitting localhost with `fetch`. Localhost HTTP is fast and deterministic.

---

## `obsidian-typings`

**Purpose:** TypeScript type definitions for Obsidian's undocumented internal APIs.

Installed as a dev dependency and listed in `tsconfig.json` `types`. It augments the `obsidian` module via `declare module "obsidian"`, so types like `app.commands` resolve automatically during `tsc`.

**Important:** `obsidian-typings` does not affect vitest. Tests resolve `"obsidian"` to the manual mock. The two are independent.

When creating mock data in tests that must satisfy augmented types, use `as unknown as Type`:

```typescript
vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
  frontmatter: { title: "Test", position: { ... } },
} as unknown as CachedMetadata);
```

This is intentional — test mock data is partial by design.

---

## ESLint Configuration for Tests

The eslint config (`plugin/eslint.config.mts`) has a test-specific override:

```typescript
{
  files: ["src/**/*.test.ts"],
  languageOptions: { globals: { ...globals.node } },
  rules: {
    "no-restricted-globals": "off",
    "@typescript-eslint/unbound-method": "off",
  },
}
```

- **`globals.node`** — Test files run in Node.js via vitest, not inside Obsidian.
- **`unbound-method: off`** — Standard vitest workaround. `expect(app.vault.create).toHaveBeenCalledWith(...)` looks like an unbound method to eslint, but `app.vault.create` is a `vi.fn()` mock.
