# Testing Guidelines

## Architecture

Tests run in **vitest** with **jsdom** environment. The Obsidian API is unavailable outside the Obsidian app, so we use a manual mock at `plugin/src/__mocks__/obsidian.ts` that vitest resolves via the alias in `vitest.config.ts`.

### The Three Validation Layers

Our code passes through three separate validation stages, each catching different classes of problems:

| Layer             | Tool                       | What it checks                                             | What it misses                                  |
| ----------------- | -------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| **Type checking** | `tsc` + `obsidian-typings` | Correct usage of documented and undocumented Obsidian APIs | Whether the types match runtime behavior        |
| **Unit tests**    | vitest + obsidian mock     | Our logic (branching, error handling, response formatting) | Whether the mock accurately represents Obsidian |
| **Runtime**       | Obsidian app               | Everything actually works                                  | Nothing (this is ground truth)                  |

Each layer operates on different type information:

- **`tsc`** resolves `"obsidian"` to the real `obsidian.d.ts` from `node_modules/obsidian`, augmented by `obsidian-typings` (configured in `tsconfig.json` `types` array). This is how undocumented APIs like `app.commands` get type coverage during builds.
- **vitest** resolves `"obsidian"` to our manual mock at `plugin/src/__mocks__/obsidian.ts` (via the alias in `vitest.config.ts`). Tests run against these mock types.
- **Obsidian runtime** uses the real API. This is the only place where behavior is guaranteed to be correct.

### The Gap

The mock and `obsidian-typings` can diverge from reality independently. A test can pass (mock is happy) and the build can succeed (`obsidian-typings` is happy) while the actual Obsidian API behaves differently. This is inherent to mocking a closed-source host application.

**Mitigation:**

- Keep the mock minimal — only stub methods that tool code actually calls
- Match mock signatures to `obsidian-typings` definitions (these are community-maintained reverse-engineered types)
- When `obsidian-typings` updates a signature, `tsc` will flag the mismatch in tool code; update the mock to match
- Runtime testing in Obsidian is the final validation before release

---

## The Obsidian Mock

**Location:** `plugin/src/__mocks__/obsidian.ts`

The mock provides just enough of the Obsidian API for our code to compile and run in tests. It is not a full reimplementation.

### What the mock contains

| Category            | Contents                                                          | Purpose                                      |
| ------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| **Core classes**    | `Plugin`, `Notice`, `Modal`                                       | Plugin lifecycle tests                       |
| **File system**     | `TAbstractFile`, `TFile`, `TFolder`, `Vault` interface            | Vault tool tests                             |
| **Workspace**       | `Workspace` interface                                             | Active file and navigation tests             |
| **Metadata**        | `MetadataCache`, `CachedMetadata`                                 | vault_read json format tests                 |
| **Commands**        | `Command`, `Commands` interface                                   | Command tool tests                           |
| **File management** | `FileManager` interface                                           | vault_delete tests                           |
| **Plugin manifest** | `PluginManifest` interface                                        | Plugin lifecycle (used by `Plugin.manifest`) |
| **UI components**   | `Setting`, `TextComponent`, `ButtonComponent`, `PluginSettingTab` | Settings tab tests                           |
| **Utilities**       | `normalizePath()`, `SecretStorage`                                | Path handling, API key tests                 |

### Rules for expanding the mock

1. **Only add what you need.** If a new tool calls `app.vault.getMarkdownFiles()`, add it to the `Vault` interface in the mock. Don't pre-populate methods "just in case."
2. **Match the signature from `obsidian-typings`.** Check the [obsidian-typings repo](https://github.com/Fevol/obsidian-typings) for the method signature. Our mock doesn't need to implement the full behavior — just the type signature and a sensible default return value.
3. **Classes need real behavior, interfaces need stubs.** `TFile`, `TFolder`, and `Plugin` are classes that tests instantiate directly. Their properties must be populated correctly. Interfaces like `Vault` and `Workspace` are only used via `vi.fn()` mocks in tests.
4. **Keep `App` in sync.** When adding a new interface (like `FileManager`), add the property to the `App` interface too.

---

## The `obsidian-typings` Package

**Purpose:** Provides TypeScript type definitions for Obsidian's undocumented internal APIs.

**How it works:** Installed as a dev dependency and listed in `tsconfig.json` `types`. It augments the `obsidian` module via `declare module "obsidian"`, so types like `app.commands` resolve automatically on the `App` type during `tsc` — no casting required.

**When to update:** When Obsidian releases a new version and we need access to changed or new internal APIs. Check the [releases page](https://github.com/Fevol/obsidian-typings/releases) for version-matched branches.

**Important:** `obsidian-typings` does not affect vitest. Tests still resolve `"obsidian"` to the manual mock. The two are independent.

---

## Tool Test Pattern

All tool tests follow the same structure:

### 1. Mock McpServer to capture registrations

```typescript
interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

const registeredTools: Record<
  string,
  { config: Record<string, unknown>; handler: ToolHandler }
> = {};

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class MockMcpServer {
    registerTool(
      name: string,
      config: Record<string, unknown>,
      handler: ToolHandler,
    ): void {
      registeredTools[name] = { config, handler };
    }
  },
}));
```

The `ToolResult` and `ToolHandler` types keep the linter happy and provide type safety on test assertions.

### 2. Create a mock App with vi.fn() stubs

```typescript
function createApp(): App {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      getRoot: vi.fn(() => root),
      read: vi.fn(async () => ""),
      // ...
    },
    // ...
  } as unknown as App;
}
```

Use `as unknown as App` because the mock is intentionally partial — it only includes what tools call.

### 3. Call tools via a helper

```typescript
function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  return registeredTools[name]!.handler(args);
}
```

### 4. Clean up between tests

```typescript
beforeEach(() => {
  Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
});
```

### 5. Test both happy path and error cases

Every tool should have at minimum:

- A success test verifying the response content
- An error test for each documented error condition (file not found, command unknown, etc.)
- Verification that the correct Obsidian API methods were called with the right arguments

---

## ESLint Configuration for Tests

The eslint config (`plugin/eslint.config.mts`) has a test-specific override block:

```typescript
{
  files: ["src/**/*.test.ts"],
  languageOptions: {
    globals: {
      ...globals.node,
    },
  },
  rules: {
    "no-restricted-globals": "off",
    "@typescript-eslint/unbound-method": "off",
  },
}
```

**`globals.node`** — Test files run in Node.js via vitest, not inside Obsidian. This provides Node globals and is why `no-restricted-globals` can be turned off.

**`unbound-method: off`** — This is a known false positive with vitest/jest. When you write `expect(app.vault.create).toHaveBeenCalledWith(...)`, eslint thinks you're detaching a method from its object (losing `this` binding). But `app.vault.create` is a `vi.fn()` mock that doesn't use `this`. This is the standard approach across vitest projects.

---

## Mock Data and `obsidian-typings` Strictness

`obsidian-typings` augments Obsidian types with stricter definitions than the official API. For example, `FrontMatterCache` gains an `index__` index signature.

When creating mock data in tests that must satisfy these augmented types, use `as unknown as Type`:

```typescript
vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
  frontmatter: { title: "Test", position: { ... } },
  tags: [{ tag: "#foo", position: { ... } }],
} as unknown as CachedMetadata);
```

This is not a weakness — it's intentional. Test mock data is partial by design. The `as unknown as` cast acknowledges that we're providing just enough data for the test, not a complete `CachedMetadata` object.

---

## Known Gaps

- **`position` leak in frontmatter:** `vault_read` and `active_file_read` pass `cache.frontmatter` through to the response without stripping the `position` property. This is Obsidian internal metadata, not user frontmatter. Tracked in the implementation plan build log.
- **No integration tests:** All tests mock the Obsidian API. We have no automated way to test against a real Obsidian instance. Runtime testing is manual.
- **Mock drift:** The mock can fall behind both the real Obsidian API and `obsidian-typings`. When adding new tools, always verify mock signatures against `obsidian-typings`.
