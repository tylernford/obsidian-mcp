/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
   -- Tests validate JSON.parse output via assertions; any-typed access is intentional. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prepareSimpleSearch, TFile } from "obsidian";
import { registerSearchTools } from "./search";

const prepareSimpleSearchMock = vi.mocked(prepareSimpleSearch);

// ---------------------------------------------------------------------------
// Capture the handler registered by registerSearchTools
// ---------------------------------------------------------------------------

type ToolHandler = (args: {
  query: string;
  type: "simple" | "dataview";
  contextLength: number;
}) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

let handler: ToolHandler;

const fakeMcpServer = {
  registerTool: vi.fn((_name: string, _schema: unknown, fn: ToolHandler) => {
    handler = fn;
  }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(path: string, content: string) {
  // Our mock TFile accepts a path arg; the real typedef doesn't declare one.
  const file = new (TFile as new (p: string) => TFile)(path);
  return { file, content };
}

function makeApp(files: ReturnType<typeof makeFile>[], dvPlugin?: unknown) {
  return {
    vault: {
      getMarkdownFiles: () => files.map((f) => f.file),
      cachedRead: vi.fn(async (file: TFile) => {
        const found = files.find((f) => f.file.path === file.path);
        return found?.content ?? "";
      }),
    },
    plugins: {
      getPlugin: (_id: string) => dvPlugin,
    },
  } as unknown as import("obsidian").App;
}

// ---------------------------------------------------------------------------
// Setup — register once, app swapped per test
// ---------------------------------------------------------------------------

let app: ReturnType<typeof makeApp>;

beforeEach(() => {
  vi.clearAllMocks();
  app = makeApp([]);
  registerSearchTools(fakeMcpServer as never, app);
});

// ---------------------------------------------------------------------------
// simpleSearch
// ---------------------------------------------------------------------------

describe("simpleSearch", () => {
  it("returns filename match when search hits the basename prefix", async () => {
    const f = makeFile("notes/hello-world.md", "body text");
    app = makeApp([f]);
    registerSearchTools(fakeMcpServer as never, app);

    // Match within the basename portion (indices 0–11)
    prepareSimpleSearchMock.mockReturnValue(() => ({
      score: -5,
      matches: [[0, 5] as [number, number]],
    }));

    const result = await handler({
      query: "hello",
      type: "simple",
      contextLength: 100,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].matches[0].match.source).toBe("filename");
    expect(parsed[0].matches[0].context).toBe("hello-world");
  });

  it("clamps filename match end to basename length", async () => {
    // A match [0, positionOffset] where end === positionOffset should be
    // clamped to basename.length
    const f = makeFile("notes/ab.md", "content");
    app = makeApp([f]);
    registerSearchTools(fakeMcpServer as never, app);

    // basename = "ab" (length 2), positionOffset = "ab\n\n".length = 4
    // match end at positionOffset boundary (4) → clamped to basename.length (2)
    prepareSimpleSearchMock.mockReturnValue(() => ({
      score: -1,
      matches: [[0, 4] as [number, number]],
    }));

    const result = await handler({
      query: "ab",
      type: "simple",
      contextLength: 100,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed[0].matches[0].match.end).toBe(2);
    expect(parsed[0].matches[0].match.source).toBe("filename");
  });

  it("returns content match with position adjusted by offset", async () => {
    const f = makeFile("notes/doc.md", "some interesting text here");
    app = makeApp([f]);
    registerSearchTools(fakeMcpServer as never, app);

    // positionOffset = "doc\n\n".length = 5
    // Match at combined[10..15] → content[5..10]
    prepareSimpleSearchMock.mockReturnValue(() => ({
      score: -3,
      matches: [[10, 15] as [number, number]],
    }));

    const result = await handler({
      query: "inter",
      type: "simple",
      contextLength: 100,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed[0].matches[0].match.source).toBe("content");
    expect(parsed[0].matches[0].match.start).toBe(5);
    expect(parsed[0].matches[0].match.end).toBe(10);
  });

  it("skips boundary-spanning matches", async () => {
    const f = makeFile("notes/doc.md", "content here");
    app = makeApp([f]);
    registerSearchTools(fakeMcpServer as never, app);

    // positionOffset = "doc\n\n".length = 5
    // Match starts in filename (3), ends in content (7) → skipped
    prepareSimpleSearchMock.mockReturnValue(() => ({
      score: -1,
      matches: [[3, 7] as [number, number]],
    }));

    const result = await handler({
      query: "x",
      type: "simple",
      contextLength: 100,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    // File had a search hit but all matches were boundary-spanning → filtered out
    expect(parsed).toHaveLength(0);
  });

  it("clamps context window to content boundaries", async () => {
    const content = "short";
    const f = makeFile("notes/f.md", content);
    app = makeApp([f]);
    registerSearchTools(fakeMcpServer as never, app);

    // positionOffset = "f\n\n".length = 3
    // Match at combined[3..8] → content[0..5] with contextLength=200
    // Context should clamp to [0, 5] (full content)
    prepareSimpleSearchMock.mockReturnValue(() => ({
      score: -1,
      matches: [[3, 8] as [number, number]],
    }));

    const result = await handler({
      query: "short",
      type: "simple",
      contextLength: 200,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed[0].matches[0].context).toBe("short");
  });

  it("sorts results by score ascending", async () => {
    const f1 = makeFile("notes/a.md", "text");
    const f2 = makeFile("notes/b.md", "text");
    app = makeApp([f1, f2]);
    registerSearchTools(fakeMcpServer as never, app);

    prepareSimpleSearchMock.mockReturnValue((text: string) => {
      // Give "b" a better (lower) score
      const score = text.startsWith("a") ? -1 : -10;
      return { score, matches: [[0, 1] as [number, number]] };
    });

    const result = await handler({
      query: "x",
      type: "simple",
      contextLength: 100,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed[0].filename).toBe("notes/b.md");
    expect(parsed[1].filename).toBe("notes/a.md");
  });

  it("uses custom contextLength for content context window", async () => {
    const content = "aaaaaBBBBBaaaaa";
    const f = makeFile("notes/f.md", content);
    app = makeApp([f]);
    registerSearchTools(fakeMcpServer as never, app);

    // positionOffset = "f\n\n".length = 3
    // Match at combined[8..13] → content[5..10] ("BBBBB")
    // With contextLength=2: context from [3..12] = "aaBBBBBaa"
    prepareSimpleSearchMock.mockReturnValue(() => ({
      score: -1,
      matches: [[8, 13] as [number, number]],
    }));

    const result = await handler({
      query: "B",
      type: "simple",
      contextLength: 2,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed[0].matches[0].context).toBe("aaBBBBBaa");
  });
});

// ---------------------------------------------------------------------------
// dataviewSearch
// ---------------------------------------------------------------------------

describe("dataviewSearch", () => {
  it("returns error when dataview plugin is not installed", async () => {
    app = makeApp([], null);
    registerSearchTools(fakeMcpServer as never, app);

    const result = await handler({
      query: "TABLE file.name FROM #tag",
      type: "dataview",
      contextLength: 100,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("not installed");
  });

  it("returns error when dataview query throws", async () => {
    const dvPlugin = {
      api: {
        tryQuery: vi.fn().mockRejectedValue(new Error("bad query syntax")),
        settings: { tableIdColumnName: "File" },
      },
    };
    app = makeApp([], dvPlugin);
    registerSearchTools(fakeMcpServer as never, app);

    const result = await handler({
      query: "TABLE bad",
      type: "dataview",
      contextLength: 100,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("bad query syntax");
  });

  it("rejects non-TABLE query types", async () => {
    const dvPlugin = {
      api: {
        tryQuery: vi
          .fn()
          .mockResolvedValue({ type: "list", headers: [], values: [] }),
        settings: { tableIdColumnName: "File" },
      },
    };
    app = makeApp([], dvPlugin);
    registerSearchTools(fakeMcpServer as never, app);

    const result = await handler({
      query: "LIST FROM #tag",
      type: "dataview",
      contextLength: 100,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Only TABLE");
  });

  it("rejects TABLE WITHOUT ID queries", async () => {
    const dvPlugin = {
      api: {
        tryQuery: vi.fn().mockResolvedValue({
          type: "table",
          headers: ["Name", "Date"],
          values: [],
        }),
        settings: { tableIdColumnName: "File" },
      },
    };
    app = makeApp([], dvPlugin);
    registerSearchTools(fakeMcpServer as never, app);

    const result = await handler({
      query: "TABLE WITHOUT ID file.name",
      type: "dataview",
      contextLength: 100,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("WITHOUT ID");
  });

  it("transforms successful TABLE result into filename + result objects", async () => {
    const dvPlugin = {
      api: {
        tryQuery: vi.fn().mockResolvedValue({
          type: "table",
          headers: ["File", "Status"],
          values: [
            [{ path: "notes/a.md" }, "done"],
            [{ path: "notes/b.md" }, "pending"],
          ],
        }),
        settings: { tableIdColumnName: "File" },
      },
    };
    app = makeApp([], dvPlugin);
    registerSearchTools(fakeMcpServer as never, app);

    const result = await handler({
      query: "TABLE status FROM #project",
      type: "dataview",
      contextLength: 100,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(result.isError).toBeUndefined();
    expect(parsed).toEqual([
      { filename: "notes/a.md", result: { Status: "done" } },
      { filename: "notes/b.md", result: { Status: "pending" } },
    ]);
  });

  it("handles multi-column results correctly", async () => {
    const dvPlugin = {
      api: {
        tryQuery: vi.fn().mockResolvedValue({
          type: "table",
          headers: ["File", "Priority", "Due", "Tags"],
          values: [[{ path: "tasks/1.md" }, "high", "2026-01-01", ["a", "b"]]],
        }),
        settings: { tableIdColumnName: "File" },
      },
    };
    app = makeApp([], dvPlugin);
    registerSearchTools(fakeMcpServer as never, app);

    const result = await handler({
      query: "TABLE priority, due, tags FROM #task",
      type: "dataview",
      contextLength: 100,
    });
    const parsed = JSON.parse(result.content[0]!.text);

    expect(parsed[0].result).toEqual({
      Priority: "high",
      Due: "2026-01-01",
      Tags: ["a", "b"],
    });
    // File column should be excluded from result
    expect(parsed[0].result).not.toHaveProperty("File");
  });
});
