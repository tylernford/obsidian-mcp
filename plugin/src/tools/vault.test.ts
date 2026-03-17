// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile, TFolder, TAbstractFile, CachedMetadata } from "obsidian";
import { registerVaultTools } from "./vault";

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

function createTFolder(name: string, children: TAbstractFile[]): TFolder {
  const folder = new TFolder();
  folder.path = name;
  folder.name = name;
  folder.children = children;
  return folder;
}

function createApp(overrides: Partial<App> = {}): App {
  const root = createTFolder("", []);
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      getRoot: vi.fn(() => root),
      read: vi.fn(async () => ""),
      create: vi.fn(async () => createTFile("new.md")),
      process: vi.fn(async (_file: TFile, fn: (data: string) => string) =>
        fn("original content"),
      ),
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
    ...overrides,
  } as unknown as App;
}

function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  return registeredTools[name]!.handler(args);
}

describe("vault_list", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("lists root contents when path is omitted", async () => {
    const noteFile = createTFile("note.md");
    const subfolder = createTFolder("subfolder", []);
    const root = createTFolder("", [noteFile, subfolder]);
    const app = createApp();
    vi.mocked(app.vault.getRoot).mockReturnValue(root);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_list", {});

    const parsed = JSON.parse(result.content[0]!.text) as { files: string[] };
    expect(parsed.files).toEqual(["note.md", "subfolder/"]);
    expect(result.isError).toBeUndefined();
  });

  it("lists subfolder contents", async () => {
    const child = createTFile("docs/readme.md");
    const folder = createTFolder("docs", [child]);
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(folder);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_list", { path: "docs" });

    const parsed = JSON.parse(result.content[0]!.text) as { files: string[] };
    expect(parsed.files).toEqual(["readme.md"]);
  });

  it("returns error for non-existent path", async () => {
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_list", { path: "nonexistent" });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Directory not found");
  });

  it("appends trailing / for directories and sorts", async () => {
    const fileB = createTFile("folder/b.md");
    const fileA = createTFile("folder/a.md");
    const sub = createTFolder("z-sub", []);
    const folder = createTFolder("folder", [fileB, fileA, sub]);
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(folder);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_list", { path: "folder" });

    const parsed = JSON.parse(result.content[0]!.text) as { files: string[] };
    expect(parsed.files).toEqual(["a.md", "b.md", "z-sub/"]);
  });
});

describe("vault_read", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("returns raw content for markdown format", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.vault.read).mockResolvedValue("# Hello world");

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_read", {
      filename: "note.md",
      format: "markdown",
    });

    expect(result.content[0]!.text).toBe("# Hello world");
  });

  it("returns json with content, frontmatter, tags, and stat", async () => {
    const file = createTFile("note.md", {
      ctime: 1000,
      mtime: 2000,
      size: 50,
    });
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.vault.read).mockResolvedValue("content here");
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: {
        title: "Test",
        position: {
          start: { line: 0, col: 0, offset: 0 },
          end: { line: 1, col: 3, offset: 20 },
        },
      },
      tags: [
        {
          tag: "#foo",
          position: {
            start: { line: 2, col: 0, offset: 25 },
            end: { line: 2, col: 4, offset: 29 },
          },
        },
      ],
    } as unknown as CachedMetadata);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_read", {
      filename: "note.md",
      format: "json",
    });

    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed.content).toBe("content here");
    // frontmatter includes position metadata from Obsidian's CachedMetadata
    expect(parsed.frontmatter).toMatchObject({ title: "Test" });
    expect(parsed.tags).toEqual(["#foo"]);
    expect(parsed.stat).toEqual({ ctime: 1000, mtime: 2000, size: 50 });
  });

  it("returns empty frontmatter/tags when cache is null", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.vault.read).mockResolvedValue("content");
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue(null);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_read", {
      filename: "note.md",
      format: "json",
    });

    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed.frontmatter).toEqual({});
    expect(parsed.tags).toEqual([]);
  });

  it("returns error for non-existent file", async () => {
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_read", {
      filename: "missing.md",
      format: "json",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File not found");
  });
});

describe("vault_create", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("creates a file and returns success message", async () => {
    const app = createApp();

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_create", {
      filename: "new-note.md",
      content: "# New Note",
    });

    expect(result.content[0]!.text).toBe("Created new-note.md");
    expect(result.isError).toBeUndefined();
    expect(app.vault.create).toHaveBeenCalledWith("new-note.md", "# New Note");
  });

  it("returns error when file already exists", async () => {
    const app = createApp();
    vi.mocked(app.vault.create).mockRejectedValue(
      new Error("File already exists"),
    );

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_create", {
      filename: "existing.md",
      content: "content",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File already exists");
  });
});

describe("vault_delete", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("trashes a file and returns success message", async () => {
    const file = createTFile("to-delete.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_delete", {
      filename: "to-delete.md",
    });

    expect(result.content[0]!.text).toBe("Deleted to-delete.md");
    expect(result.isError).toBeUndefined();
    expect(app.fileManager.trashFile).toHaveBeenCalledWith(file);
  });

  it("returns error for non-existent file", async () => {
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_delete", {
      filename: "missing.md",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File not found");
  });
});

describe("vault_update", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
    vi.mocked(applyPatch).mockImplementation((doc: string) => `patched:${doc}`);
  });

  it("applies patch to a heading target", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_update", {
      filename: "note.md",
      operation: "append",
      targetType: "heading",
      target: "Section",
      content: "new text",
      createIfMissing: false,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("Updated note.md");
    expect(app.vault.process).toHaveBeenCalledWith(file, expect.any(Function));
    expect(applyPatch).toHaveBeenCalledWith(
      "original content",
      expect.objectContaining({
        operation: "append",
        targetType: "heading",
        target: ["Section"],
        content: "new text",
      }),
    );
  });

  it("splits nested heading path on ::", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    await callTool("vault_update", {
      filename: "note.md",
      operation: "append",
      targetType: "heading",
      target: "Parent::Child",
      content: "text",
    });

    expect(applyPatch).toHaveBeenCalledWith(
      "original content",
      expect.objectContaining({
        target: ["Parent", "Child"],
      }),
    );
  });

  it("applies patch to a block target", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_update", {
      filename: "note.md",
      operation: "prepend",
      targetType: "block",
      target: "abc123",
      content: "before block",
    });

    expect(result.isError).toBeUndefined();
    expect(applyPatch).toHaveBeenCalledWith(
      "original content",
      expect.objectContaining({
        operation: "prepend",
        targetType: "block",
        target: "abc123",
      }),
    );
  });

  it("applies patch to a frontmatter target", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_update", {
      filename: "note.md",
      operation: "replace",
      targetType: "frontmatter",
      target: "title",
      content: '"New Title"',
    });

    expect(result.isError).toBeUndefined();
    expect(applyPatch).toHaveBeenCalledWith(
      "original content",
      expect.objectContaining({
        operation: "replace",
        targetType: "frontmatter",
        target: "title",
        content: "New Title",
      }),
    );
  });

  it("passes createIfMissing through to instruction", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    await callTool("vault_update", {
      filename: "note.md",
      operation: "append",
      targetType: "heading",
      target: "New Section",
      content: "text",
      createIfMissing: true,
    });

    expect(applyPatch).toHaveBeenCalledWith(
      "original content",
      expect.objectContaining({
        createTargetIfMissing: true,
      }),
    );
  });

  it("returns error when file not found", async () => {
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(null);

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_update", {
      filename: "missing.md",
      operation: "append",
      targetType: "heading",
      target: "Section",
      content: "text",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("File not found");
  });

  it("returns error with reason when PatchFailed is thrown", async () => {
    const file = createTFile("note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(applyPatch).mockImplementation(() => {
      throw new PatchFailed(
        PatchFailureReason.InvalidTarget,
        {} as never,
        null,
      );
    });

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("vault_update", {
      filename: "note.md",
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

describe("path normalization", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("normalizes paths before vault API calls", async () => {
    const file = createTFile("folder/note.md");
    const app = createApp();
    vi.mocked(app.vault.getAbstractFileByPath).mockReturnValue(file);
    vi.mocked(app.vault.read).mockResolvedValue("content");

    registerVaultTools(new McpServer({ name: "t", version: "1" }), app);
    await callTool("vault_read", {
      filename: "/folder//note.md",
      format: "markdown",
    });

    expect(app.vault.getAbstractFileByPath).toHaveBeenCalledWith(
      "folder/note.md",
    );
  });
});
