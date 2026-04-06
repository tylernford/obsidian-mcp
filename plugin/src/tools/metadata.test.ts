/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
   -- Tests validate JSON.parse output via assertions; any-typed access is intentional. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TFile } from "obsidian";
import { registerMetadataTools } from "./metadata";

// ---------------------------------------------------------------------------
// Capture handlers registered by registerMetadataTools
// ---------------------------------------------------------------------------

type TagsHandler = (args: {
  filename: string;
  action: "list" | "add" | "remove";
  tags?: string[];
}) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

type FrontmatterHandler = (args: {
  filename: string;
  action: "read" | "set";
  key?: string;
  value?: string;
}) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(path: string) {
  return new (TFile as new (p: string) => TFile)(path);
}

function makeApp(opts: {
  file?: TFile;
  frontmatter?: Record<string, unknown>;
  processFrontMatter?: (
    file: TFile,
    fn: (fm: Record<string, unknown>) => void,
  ) => Promise<void>;
}) {
  const { file, frontmatter } = opts;
  const processFrontMatter =
    opts.processFrontMatter ??
    vi.fn(async (_f: TFile, fn: (fm: Record<string, unknown>) => void) => {
      fn(frontmatter ?? {});
    });

  return {
    vault: {
      getAbstractFileByPath: vi.fn((path: string) =>
        file && file.path === path ? file : undefined,
      ),
    },
    metadataCache: {
      getFileCache: vi.fn((f: TFile) =>
        file && f.path === file.path && frontmatter ? { frontmatter } : null,
      ),
    },
    fileManager: { processFrontMatter },
  } as unknown as import("obsidian").App;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: ReturnType<typeof makeApp>;

beforeEach(() => {
  vi.clearAllMocks();
});

// Register once — app is swapped per test via the closure reference
registerMetadataTools(
  fakeMcpServer as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
  // Proxy so each test can reassign `app`
  new Proxy({} as import("obsidian").App, {
    get: (_target, prop) =>
      (app as unknown as Record<string | symbol, unknown>)[prop],
  }),
);

// ===========================================================================
// tags_manage
// ===========================================================================

describe("tags_manage", () => {
  // --- list ---

  it("lists tags stripping # prefix", async () => {
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: { tags: ["#foo", "#bar"] } });

    const result = await tagsHandler({
      filename: "note.md",
      action: "list",
    });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.tags).toEqual(["foo", "bar"]);
    expect(result.isError).toBeUndefined();
  });

  it("returns empty array when tags is not an array", async () => {
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: { tags: "not-an-array" } });

    const result = await tagsHandler({
      filename: "note.md",
      action: "list",
    });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.tags).toEqual([]);
  });

  // --- add ---

  it("add deduplicates tags already present", async () => {
    const fm: Record<string, unknown> = { tags: ["existing"] };
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    const result = await tagsHandler({
      filename: "note.md",
      action: "add",
      tags: ["existing", "new-tag"],
    });

    expect(fm.tags).toEqual(["existing", "new-tag"]);
    expect(result.content[0]!.text).toContain("added");
  });

  it("add strips # prefix from input tags", async () => {
    const fm: Record<string, unknown> = { tags: [] };
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    await tagsHandler({
      filename: "note.md",
      action: "add",
      tags: ["#prefixed"],
    });

    expect(fm.tags).toEqual(["prefixed"]);
  });

  // --- remove ---

  it("remove filters out specified tags", async () => {
    const fm: Record<string, unknown> = { tags: ["keep", "drop"] };
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    await tagsHandler({
      filename: "note.md",
      action: "remove",
      tags: ["drop"],
    });

    expect(fm.tags).toEqual(["keep"]);
  });

  it("remove with missing tag is a no-op", async () => {
    const fm: Record<string, unknown> = { tags: ["keep"] };
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    const result = await tagsHandler({
      filename: "note.md",
      action: "remove",
      tags: ["nonexistent"],
    });

    expect(fm.tags).toEqual(["keep"]);
    expect(result.content[0]!.text).toContain("removed");
  });

  it("remove strips # prefix from input tags", async () => {
    const fm: Record<string, unknown> = { tags: ["prefixed", "keep"] };
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    await tagsHandler({
      filename: "note.md",
      action: "remove",
      tags: ["#prefixed"],
    });

    expect(fm.tags).toEqual(["keep"]);
  });

  // --- error cases ---

  it("returns error when tags is an empty array", async () => {
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: {} });

    const result = await tagsHandler({
      filename: "note.md",
      action: "add",
      tags: [],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("required");
  });

  it("returns error when tags param missing for add/remove", async () => {
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: {} });

    const result = await tagsHandler({
      filename: "note.md",
      action: "add",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("required");
  });

  it("looks up file through normalizePath", async () => {
    const file = makeFile("foo/bar.md");
    app = makeApp({ file, frontmatter: { tags: ["t"] } });

    const result = await tagsHandler({
      filename: "/foo//bar.md",
      action: "list",
    });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.tags).toEqual(["t"]);
    expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith("foo/bar.md");
  });

  it("returns error when file not found", async () => {
    app = makeApp({});

    const result = await tagsHandler({
      filename: "missing.md",
      action: "list",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File not found");
  });
});

// ===========================================================================
// frontmatter_manage
// ===========================================================================

describe("frontmatter_manage", () => {
  // --- read ---

  it("read returns frontmatter as JSON", async () => {
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: { title: "Hello", draft: true } });

    const result = await frontmatterHandler({
      filename: "note.md",
      action: "read",
    });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.title).toBe("Hello");
    expect(parsed.draft).toBe(true);
  });

  it("read strips position field", async () => {
    const file = makeFile("note.md");
    app = makeApp({
      file,
      frontmatter: {
        title: "Hello",
        position: { start: { line: 0 }, end: { line: 3 } },
      },
    });

    const result = await frontmatterHandler({
      filename: "note.md",
      action: "read",
    });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.position).toBeUndefined();
    expect(parsed.title).toBe("Hello");
  });

  it("read returns empty object when no cache", async () => {
    const file = makeFile("note.md");
    app = makeApp({ file }); // no frontmatter → getFileCache returns null

    const result = await frontmatterHandler({
      filename: "note.md",
      action: "read",
    });

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed).toEqual({});
  });

  // --- set ---

  it("set parses JSON string into native value", async () => {
    const fm: Record<string, unknown> = {};
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    await frontmatterHandler({
      filename: "note.md",
      action: "set",
      key: "count",
      value: "42",
    });

    expect(fm.count).toBe(42);
  });

  it("set keeps non-JSON string as-is", async () => {
    const fm: Record<string, unknown> = {};
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    await frontmatterHandler({
      filename: "note.md",
      action: "set",
      key: "title",
      value: "plain text",
    });

    expect(fm.title).toBe("plain text");
  });

  it("set without value deletes the key", async () => {
    const fm: Record<string, unknown> = { existing: "val" };
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: fm });

    await frontmatterHandler({
      filename: "note.md",
      action: "set",
      key: "existing",
      // value omitted → undefined
    });

    expect(fm.existing).toBeUndefined();
  });

  // --- error cases ---

  it("returns error when key missing for set action", async () => {
    const file = makeFile("note.md");
    app = makeApp({ file, frontmatter: {} });

    const result = await frontmatterHandler({
      filename: "note.md",
      action: "set",
      value: "something",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Key is required");
  });

  it("returns error when file not found", async () => {
    app = makeApp({});

    const result = await frontmatterHandler({
      filename: "missing.md",
      action: "read",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File not found");
  });
});
