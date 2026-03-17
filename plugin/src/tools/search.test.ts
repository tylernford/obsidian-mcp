// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile, TFolder, prepareSimpleSearch } from "obsidian";
import { registerSearchTools } from "./search";

vi.mock("obsidian", async (importOriginal) => {
  const actual = await importOriginal<typeof import("obsidian")>();
  return {
    ...actual,
    prepareSimpleSearch: vi.fn(),
  };
});

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

describe("search — simple", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
    vi.mocked(prepareSimpleSearch).mockReset();
  });

  it("returns content matches with context", async () => {
    const file = createTFile("notes/hello.md");
    const app = createApp();
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([file]);
    vi.mocked(app.vault.cachedRead).mockResolvedValue(
      "Some text with the search term here.",
    );

    // basename "hello" is 5 chars, prefix is "hello\n\n" = 7 chars
    const offset = 7;
    vi.mocked(prepareSimpleSearch).mockReturnValue(() => ({
      score: -5,
      matches: [[offset + 19, offset + 30]], // "search term"
    }));

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "search term",
      type: "simple",
      contextLength: 10,
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      filename: string;
      score: number;
      matches: Array<{
        match: { start: number; end: number; source: string };
        context: string;
      }>;
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.filename).toBe("notes/hello.md");
    expect(parsed[0]!.matches[0]!.match.source).toBe("content");
    expect(parsed[0]!.matches[0]!.match.start).toBe(19);
    expect(parsed[0]!.matches[0]!.match.end).toBe(30);
    expect(parsed[0]!.matches[0]!.context).toContain("search term");
  });

  it("returns filename matches", async () => {
    const file = createTFile("my-query-note.md");
    const app = createApp();
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([file]);
    vi.mocked(app.vault.cachedRead).mockResolvedValue("body content");

    // Match in the filename portion (basename = "my-query-note", length 13)
    vi.mocked(prepareSimpleSearch).mockReturnValue(() => ({
      score: -3,
      matches: [[3, 8]], // "query" within basename
    }));

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "query",
      type: "simple",
    });

    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      matches: Array<{
        match: { source: string };
        context: string;
      }>;
    }>;
    expect(parsed[0]!.matches[0]!.match.source).toBe("filename");
    expect(parsed[0]!.matches[0]!.context).toBe("my-query-note");
  });

  it("skips boundary-spanning matches", async () => {
    const file = createTFile("test.md");
    const app = createApp();
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([file]);
    vi.mocked(app.vault.cachedRead).mockResolvedValue("content");

    // "test\n\n" prefix = 6 chars. Match spans boundary: starts at 4, ends at 8.
    vi.mocked(prepareSimpleSearch).mockReturnValue(() => ({
      score: -1,
      matches: [[4, 8]],
    }));

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "t\n\nco",
      type: "simple",
    });

    const parsed = JSON.parse(result.content[0]!.text) as unknown[];
    expect(parsed).toHaveLength(0);
  });

  it("returns empty array when no matches", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([file]);
    vi.mocked(app.vault.cachedRead).mockResolvedValue("nothing here");

    vi.mocked(prepareSimpleSearch).mockReturnValue(() => null);

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "missing",
      type: "simple",
    });

    const parsed = JSON.parse(result.content[0]!.text) as unknown[];
    expect(parsed).toHaveLength(0);
    expect(result.isError).toBeUndefined();
  });

  it("sorts results by score ascending", async () => {
    const file1 = createTFile("a.md");
    const file2 = createTFile("b.md");
    const app = createApp();
    vi.mocked(app.vault.getMarkdownFiles).mockReturnValue([file1, file2]);
    vi.mocked(app.vault.cachedRead).mockResolvedValue("match here");

    // "a" prefix = 3, "b" prefix = 3
    const offset = 3;
    let callCount = 0;
    vi.mocked(prepareSimpleSearch).mockReturnValue(() => {
      callCount++;
      return {
        score: callCount === 1 ? -2 : -10,
        matches: [[offset, offset + 5]],
      };
    });

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "match",
      type: "simple",
    });

    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      filename: string;
      score: number;
    }>;
    expect(parsed[0]!.score).toBeLessThanOrEqual(parsed[1]!.score);
  });
});

describe("search — dataview", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("executes TABLE query and returns results", async () => {
    const app = createApp();
    const mockApi = {
      tryQuery: vi.fn(async () => ({
        successful: true,
        type: "table",
        headers: ["File", "rating"],
        values: [
          [{ path: "note1.md" }, 5],
          [{ path: "note2.md" }, 3],
        ],
      })),
      settings: { tableIdColumnName: "File" },
    };
    vi.mocked(
      (app as unknown as { plugins: { getPlugin: ReturnType<typeof vi.fn> } })
        .plugins.getPlugin,
    ).mockReturnValue({ api: mockApi });

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "TABLE rating FROM #books",
      type: "dataview",
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      filename: string;
      result: Record<string, unknown>;
    }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.filename).toBe("note1.md");
    expect(parsed[0]!.result).toEqual({ rating: 5 });
  });

  it("returns error when dataview plugin is missing", async () => {
    const app = createApp();

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "TABLE rating",
      type: "dataview",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe(
      "Dataview plugin is not installed or enabled",
    );
  });

  it("rejects non-TABLE queries", async () => {
    const app = createApp();
    const mockApi = {
      tryQuery: vi.fn(async () => ({
        successful: true,
        type: "list",
        headers: [],
        values: [],
      })),
      settings: { tableIdColumnName: "File" },
    };
    vi.mocked(
      (app as unknown as { plugins: { getPlugin: ReturnType<typeof vi.fn> } })
        .plugins.getPlugin,
    ).mockReturnValue({ api: mockApi });

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "LIST FROM #books",
      type: "dataview",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe(
      "Only TABLE dataview queries are supported.",
    );
  });

  it("rejects TABLE WITHOUT ID queries", async () => {
    const app = createApp();
    const mockApi = {
      tryQuery: vi.fn(async () => ({
        successful: true,
        type: "table",
        headers: ["rating", "author"],
        values: [],
      })),
      settings: { tableIdColumnName: "File" },
    };
    vi.mocked(
      (app as unknown as { plugins: { getPlugin: ReturnType<typeof vi.fn> } })
        .plugins.getPlugin,
    ).mockReturnValue({ api: mockApi });

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "TABLE WITHOUT ID rating, author",
      type: "dataview",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe(
      "TABLE WITHOUT ID queries are not supported.",
    );
  });

  it("returns error when query fails", async () => {
    const app = createApp();
    const mockApi = {
      tryQuery: vi.fn(async () => ({
        successful: false,
        type: "",
        headers: [],
        values: [],
      })),
      settings: { tableIdColumnName: "File" },
    };
    vi.mocked(
      (app as unknown as { plugins: { getPlugin: ReturnType<typeof vi.fn> } })
        .plugins.getPlugin,
    ).mockReturnValue({ api: mockApi });

    registerSearchTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("search", {
      query: "TABLE invalid syntax !!",
      type: "dataview",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Dataview query failed");
  });
});
