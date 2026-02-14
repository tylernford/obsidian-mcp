# Codebase Review: Post-TypeScript Refactor

## Overall Assessment

The codebase is clean, well-structured, and the TypeScript migration was done properly. Typecheck and lint both pass with zero errors. That said, there are several issues and improvement opportunities across correctness, type safety, and robustness.

---

## Critical Issues

### 1. Non-null assertion on `process.env.OBSIDIAN_API_KEY!` — `src/index.ts:13`

The `!` operator silences TypeScript but doesn't prevent a runtime crash. If the env var is missing, `apiKey` will be `undefined`, which the constructor check (`if (!apiKey)`) catches — but the type system is being lied to. This should use an explicit check or let the constructor handle the `undefined` case properly.

```ts
// Current — masks the undefined from the type system
apiKey: process.env.OBSIDIAN_API_KEY!,

// Better — let the constructor validate
apiKey: process.env.OBSIDIAN_API_KEY as string,
// Or even better — widen the constructor type:
// apiKey: string | undefined → validate inside
```

### 2. Unguarded `tags!` non-null assertion — `src/tools/metadata.ts:55`

When `action` is `"add"` or `"remove"`, the code uses `tags!` without validating that `tags` was actually provided. Since Zod marks `tags` as `.optional()`, a caller can send `{ action: "add" }` with no tags and hit a runtime error iterating `undefined`. The same issue exists at line 60.

```ts
// Should validate before using
if (!tags || tags.length === 0) {
  return {
    content: [{ type: "text", text: "tags required for add/remove" }],
    isError: true,
  };
}
```

### 3. Unguarded `key!` / `value!` non-null assertions — `src/tools/metadata.ts:138-139`

Same pattern in `frontmatter_manage`: when `action` is `"set"`, `key` and `value` are asserted non-null but Zod allows them to be omitted.

---

## Moderate Issues

### 4. `JSON.parse` can throw without a catch — `src/api-client.ts:107`

If the server returns a `Content-Type: application/json` header but the body is malformed, `JSON.parse(text)` will throw an unhandled exception that propagates to the caller. Should be wrapped in a try/catch.

### 5. ESLint config applies TS rules globally, not just to `.ts` files — `eslint.config.js:7-9`

The `files: ["src/**/*.ts"]` block is a standalone config object with no rules — it doesn't scope the TypeScript rules above it. The `tseslint.configs.recommended` rules will also apply to any JS files (like `eslint.config.js` itself). This works today since you only lint `src/`, but the config doesn't express the intent correctly. Should be:

```js
export default tseslint.config(
  { ignores: ["dist/"] },
  {
    files: ["src/**/*.ts"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  },
);
```

### 6. `periodic_update` succeeds silently after 404 retry — `src/tools/periodic.ts:93-128`

After the create-then-retry flow, if the initial PATCH succeeded (wasn't 404), the success message at line 131 is returned. But if the 404 branch runs and the retry succeeds, execution falls through to line 131 as well. This works, but the logic is fragile — the retry success path doesn't `return` explicitly, relying on fall-through past the outer `if (!result.ok)`. If someone adds code between lines 128-130, they'd break the flow.

### 7. `ApiResponse` uses `unknown` for data — `src/api-client.ts:22`

`data: unknown` is safe but forces `as` casts everywhere downstream (e.g., `readResult.data as { tags?: string[] }`). Consider making `ApiResponse` generic (`ApiResponse<T>`) or at minimum documenting the expected shapes.

---

## Minor Issues / Suggestions

### 8. `http://` hardcoded in base URL — `src/api-client.ts:40`

The Local REST API plugin supports HTTPS. Hardcoding `http://` means there's no way to connect over HTTPS without modifying the code.

### 9. No top-level error handling — `src/index.ts`

The top-level `await server.connect(transport)` has no error handler. If the MCP connection fails or the server errors, the process will crash with an unhandled rejection. Consider wrapping in try/catch or adding a `process.on("unhandledRejection")` handler.

### 10. `content-length === "0"` check may be overly broad — `src/api-client.ts:97`

A `content-length: 0` response with a non-204 error status (like 400) would be treated as a success with `data: null`, bypassing the error parsing below.

### 11. Redundant `encodeURIComponent` in commands.ts vs `encodePath` elsewhere — `src/tools/commands.ts:42`

`commands_execute` uses `encodeURIComponent(commandId)` directly, while all other tools use `client.encodePath()`. This is actually correct (command IDs aren't paths), but the inconsistency could confuse future contributors. A comment explaining the distinction would help.

### 12. Interfaces not exported — `src/api-client.ts:1-23`

`ObsidianClientConfig`, `RequestOptions`, `PatchOptions`, and `ApiResponse` are all private to the module. If any consumer needs to type these (e.g., in tests), they'd have to redeclare them. Consider exporting `ApiResponse` at minimum.

### 13. No `as const` on the `periodEnum` — `src/tools/periodic.ts:5`

Works fine, but reusing the period values array would require re-declaring them. Minor.

---

## What's Done Well

- **Strict mode enabled** — good TypeScript discipline
- **Zod schemas with `.describe()`** — excellent for MCP tool discoverability
- **Discriminated union for `ApiResponse`** — clean `ok: true | false` pattern
- **`encodePath` segment-level encoding** — correctly handles paths with special characters
- **Consistent error response shape** across all tools
- **Minimal dependencies** — only MCP SDK + Zod at runtime
- **Pre-commit pipeline** (prettier → typecheck → lint) is solid
- **Clean separation** — `api-client.ts` is the only file that calls `fetch`

---

## Summary: Priority Ranking

| #   | Issue                                    | Severity | Effort |
| --- | ---------------------------------------- | -------- | ------ |
| 1   | Non-null assertion on env var            | Critical | Low    |
| 2   | Unguarded `tags!` in metadata            | Critical | Low    |
| 3   | Unguarded `key!`/`value!` in frontmatter | Critical | Low    |
| 4   | `JSON.parse` unhandled throw             | Moderate | Low    |
| 5   | ESLint config scoping                    | Moderate | Low    |
| 6   | periodic_update fall-through logic       | Moderate | Low    |
| 7   | `ApiResponse` uses `unknown`             | Moderate | Medium |
| 8   | Hardcoded `http://`                      | Minor    | Low    |
| 9   | No top-level error handling              | Minor    | Low    |
| 10  | `content-length: 0` bypasses error check | Minor    | Low    |

Items 1-3 are the most important — they use TypeScript's non-null assertion operator (`!`) to tell the compiler "trust me, this value exists" when the type says it might be `undefined`. The compiler stops checking, but nothing actually validates the value at runtime. The result is code that compiles without errors but can still crash on `undefined` — exactly the class of bug that strict TypeScript is meant to catch. Fixing these means replacing the `!` assertions with explicit runtime checks that return proper error responses when required values are missing.
