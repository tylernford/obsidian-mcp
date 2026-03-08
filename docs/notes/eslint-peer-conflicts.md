# ESLint Peer Dependency Conflicts

**Date:** 2026-02-14
**Context:** Task 4 of TypeScript refactor — adding ESLint and Prettier

---

## What happened

Running `pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser` installed ESLint 10 (latest), but `@typescript-eslint` v8 only supports ESLint `^8.57.0 || ^9.0.0`.

This caused unmet peer dependency warnings for:

- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/type-utils`
- `@typescript-eslint/utils`

A second conflict appeared when adding `@eslint/js` — the latest (v10) requires ESLint `^10.0.0`.

## Resolution

Pinned both packages to their v9 lines:

```sh
pnpm add -D eslint@9 @eslint/js@9
```

## Flat config approach

The design spec planned to use the separate packages (`@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`), but ESLint 9 flat config works best with the unified `typescript-eslint` package:

```js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
```

The unified package re-exports the plugin and parser internally — the separate `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` packages remain installed as transitive dependencies but don't need to be listed as direct devDependencies.

**Update (2026-02-15):** Removed `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` from direct devDependencies. The unified `typescript-eslint` package provides them transitively, so listing them separately was redundant.

## Remaining: ESLint 10 upgrade

Still blocked. `typescript-eslint@8` only supports `eslint ^8.57.0 || ^9.0.0`. Once `typescript-eslint` ships ESLint 10 support, ESLint and `@eslint/js` can be upgraded from v9 to v10.
