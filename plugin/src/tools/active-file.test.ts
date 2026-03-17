// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile, CachedMetadata } from "obsidian";
import { registerActiveFileTools } from "./active-file";

vi.mock("markdown-patch", async () => {
  const actual =
    await vi.importActual<typeof import("markdown-patch")>("markdown-patch");
  return {
    ...actual,
    applyPatch: vi.fn((doc: string) => `patched:${doc}`),
  };
});

import { applyPatch, PatchFailed, PatchFailureReason } from "markdown-patch";

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

function createApp(): App {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      getRoot: vi.fn(),
      read: vi.fn(async () => ""),
      create: vi.fn(),
      process: vi.fn(async (_file: TFile, fn: (data: string) => string) =>
        fn("original content"),
      ),
      trash: vi.fn(),
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
  } as unknown as App;
}

function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  return registeredTools[name]!.handler(args);
}

describe("active_file_read", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("returns raw content for markdown format", async () => {
    const file = createTFile("active-note.md");
    const app = createApp();
    vi.mocked(app.workspace.getActiveFile).mockReturnValue(file);
    vi.mocked(app.vault.read).mockResolvedValue("# Active note content");

    registerActiveFileTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("active_file_read", { format: "markdown" });

    expect(result.content[0]!.text).toBe("# Active note content");
    expect(result.isError).toBeUndefined();
  });

  it("returns json with content, frontmatter, tags, and stat", async () => {
    const file = createTFile("active-note.md", {
      ctime: 500,
      mtime: 600,
      size: 30,
    });
    const app = createApp();
    vi.mocked(app.workspace.getActiveFile).mockReturnValue(file);
    vi.mocked(app.vault.read).mockResolvedValue("some content");
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: {
        status: "draft",
        position: {
          start: { line: 0, col: 0, offset: 0 },
          end: { line: 1, col: 3, offset: 20 },
        },
      },
      tags: [
        {
          tag: "#draft",
          position: {
            start: { line: 2, col: 0, offset: 25 },
            end: { line: 2, col: 6, offset: 31 },
          },
        },
      ],
    } as unknown as CachedMetadata);

    registerActiveFileTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("active_file_read", { format: "json" });

    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed.content).toBe("some content");
    expect(parsed.frontmatter).toMatchObject({ status: "draft" });
    expect(parsed.tags).toEqual(["#draft"]);
    expect(parsed.stat).toEqual({ ctime: 500, mtime: 600, size: 30 });
  });

  it("returns error when no active file is open", async () => {
    const app = createApp();
    vi.mocked(app.workspace.getActiveFile).mockReturnValue(null);

    registerActiveFileTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("active_file_read", { format: "json" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("No active file");
  });
});

describe("active_file_update", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
    vi.mocked(applyPatch).mockImplementation((doc: string) => `patched:${doc}`);
  });

  it("applies patch to the active file", async () => {
    const file = createTFile("active-note.md");
    const app = createApp();
    vi.mocked(app.workspace.getActiveFile).mockReturnValue(file);

    registerActiveFileTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("active_file_update", {
      operation: "append",
      targetType: "heading",
      target: "Section",
      content: "new text",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("Updated active-note.md");
    expect(app.vault.process).toHaveBeenCalledWith(file, expect.any(Function));
    expect(applyPatch).toHaveBeenCalledWith(
      "original content",
      expect.objectContaining({
        operation: "append",
        targetType: "heading",
        target: ["Section"],
      }),
    );
  });

  it("returns error when no active file is open", async () => {
    const app = createApp();
    vi.mocked(app.workspace.getActiveFile).mockReturnValue(null);

    registerActiveFileTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("active_file_update", {
      operation: "append",
      targetType: "heading",
      target: "Section",
      content: "text",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("No active file");
  });

  it("returns error with reason when PatchFailed is thrown", async () => {
    const file = createTFile("active-note.md");
    const app = createApp();
    vi.mocked(app.workspace.getActiveFile).mockReturnValue(file);
    vi.mocked(applyPatch).mockImplementation(() => {
      throw new PatchFailed(
        PatchFailureReason.InvalidTarget,
        {} as never,
        null,
      );
    });

    registerActiveFileTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("active_file_update", {
      operation: "append",
      targetType: "heading",
      target: "Nonexistent",
      content: "text",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Patch failed");
    expect(result.content[0]!.text).toContain("invalid-target");
  });
});
