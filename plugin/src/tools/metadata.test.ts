// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile, TFolder, CachedMetadata } from "obsidian";
import { registerMetadataTools } from "./metadata";

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

function createTFile(
  path: string,
  stat = { ctime: 1000, mtime: 2000, size: 100 },
): TFile {
  const file = new TFile();
  file.path = path;
  file.name = path.split("/").pop()!;
  file.basename = file.name.replace(/\.[^.]+$/, "");
  file.extension = file.name.split(".").pop()!;
  file.stat = stat;
  return file;
}

function createApp(overrides: Partial<App> = {}): App {
  const root = new TFolder();
  root.path = "";
  root.name = "";
  root.children = [];
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      getRoot: vi.fn(() => root),
      read: vi.fn(async () => ""),
      cachedRead: vi.fn(async () => ""),
      getMarkdownFiles: vi.fn(() => []),
      create: vi.fn(async () => createTFile("new.md")),
      trash: vi.fn(async () => {}),
    },
    workspace: {
      getActiveFile: vi.fn(() => null),
      openLinkText: vi.fn(async () => {}),
    },
    metadataCache: {
      getFileCache: vi.fn(() => null),
    },
    fileManager: {
      trashFile: vi.fn(async () => {}),
      processFrontMatter: vi.fn(async () => {}),
    },
    commands: {
      commands: {},
      executeCommandById: vi.fn(() => true),
    },
    secretStorage: {
      getSecret: vi.fn(() => null),
      setSecret: vi.fn(),
      listSecrets: vi.fn(() => []),
    },
    plugins: {
      getPlugin: vi.fn(() => null),
    },
    ...overrides,
  } as unknown as App;
}

function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  return registeredTools[name]!.handler(args);
}

describe("tags_manage", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("lists tags without # prefix", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: { tags: ["journal", "daily"] },
    } as unknown as CachedMetadata);

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("tags_manage", {
      filename: "note.md",
      action: "list",
    });

    const parsed = JSON.parse(result.content[0]!.text) as {
      tags: string[];
    };
    expect(parsed.tags).toEqual(["journal", "daily"]);
    expect(result.isError).toBeUndefined();
  });

  it("strips # prefix when listing tags", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: { tags: ["#prefixed", "clean"] },
    } as unknown as CachedMetadata);

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("tags_manage", {
      filename: "note.md",
      action: "list",
    });

    const parsed = JSON.parse(result.content[0]!.text) as {
      tags: string[];
    };
    expect(parsed.tags).toEqual(["prefixed", "clean"]);
  });

  it("returns empty tags when no frontmatter", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("tags_manage", {
      filename: "note.md",
      action: "list",
    });

    const parsed = JSON.parse(result.content[0]!.text) as {
      tags: string[];
    };
    expect(parsed.tags).toEqual([]);
  });

  it("adds tags via processFrontMatter", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
      async (_file, fn) => {
        const fm: Record<string, unknown> = { tags: ["existing"] };
        fn(fm);
        expect(fm.tags).toEqual(["existing", "new-tag"]);
      },
    );

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("tags_manage", {
      filename: "note.md",
      action: "add",
      tags: ["new-tag"],
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("added");
    expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
  });

  it("strips # from input tags on add", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
      async (_file, fn) => {
        const fm: Record<string, unknown> = { tags: [] };
        fn(fm);
        expect(fm.tags).toEqual(["stripped"]);
      },
    );

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    await callTool("tags_manage", {
      filename: "note.md",
      action: "add",
      tags: ["#stripped"],
    });

    expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
  });

  it("removes tags via processFrontMatter", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
      async (_file, fn) => {
        const fm: Record<string, unknown> = { tags: ["keep", "remove-me"] };
        fn(fm);
        expect(fm.tags).toEqual(["keep"]);
      },
    );

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("tags_manage", {
      filename: "note.md",
      action: "remove",
      tags: ["remove-me"],
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("removed");
  });

  it("does not duplicate existing tags on add", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
      async (_file, fn) => {
        const fm: Record<string, unknown> = { tags: ["already"] };
        fn(fm);
        expect(fm.tags).toEqual(["already"]);
      },
    );

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    await callTool("tags_manage", {
      filename: "note.md",
      action: "add",
      tags: ["already"],
    });
  });

  it("returns error for non-existent file", async () => {
    const app = createApp();
    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("tags_manage", {
      filename: "missing.md",
      action: "list",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File not found");
  });
});

describe("frontmatter_manage", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("reads frontmatter without position key", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: {
        title: "My Note",
        rating: 5,
        position: { start: { line: 0 }, end: { line: 2 } },
      },
    } as unknown as CachedMetadata);

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("frontmatter_manage", {
      filename: "note.md",
      action: "read",
    });

    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed).toEqual({ title: "My Note", rating: 5 });
    expect(parsed).not.toHaveProperty("position");
  });

  it("sets a string value via processFrontMatter", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
      async (_file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        expect(fm.status).toBe("draft");
      },
    );

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("frontmatter_manage", {
      filename: "note.md",
      action: "set",
      key: "status",
      value: "draft",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("Set status in note.md");
  });

  it("parses JSON string values into native types", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
      async (_file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        expect(fm.aliases).toEqual(["one", "two"]);
      },
    );

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    await callTool("frontmatter_manage", {
      filename: "note.md",
      action: "set",
      key: "aliases",
      value: '["one", "two"]',
    });

    expect(app.fileManager.processFrontMatter).toHaveBeenCalled();
  });

  it("keeps raw string when JSON.parse fails", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.fileManager.processFrontMatter).mockImplementation(
      async (_file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        expect(fm.description).toBe("just a plain string");
      },
    );

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    await callTool("frontmatter_manage", {
      filename: "note.md",
      action: "set",
      key: "description",
      value: "just a plain string",
    });
  });

  it("returns error for non-existent file", async () => {
    const app = createApp();
    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("frontmatter_manage", {
      filename: "missing.md",
      action: "read",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File not found");
  });

  it("returns error when key is missing for set action", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerMetadataTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("frontmatter_manage", {
      filename: "note.md",
      action: "set",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Key is required");
  });
});
