// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App } from "obsidian";
import { registerNavigationTools } from "./navigation";

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

function createApp(): App {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      getRoot: vi.fn(),
      read: vi.fn(async () => ""),
      create: vi.fn(),
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

describe("file_open", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("opens a file and returns success message", async () => {
    const app = createApp();

    registerNavigationTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("file_open", {
      filename: "notes/todo.md",
      newLeaf: false,
    });

    expect(result.content[0]!.text).toBe("Opened notes/todo.md");
    expect(result.isError).toBeUndefined();
    expect(app.workspace.openLinkText).toHaveBeenCalledWith(
      "notes/todo.md",
      "",
      false,
    );
  });

  it("opens a file in a new tab when newLeaf is true", async () => {
    const app = createApp();

    registerNavigationTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("file_open", {
      filename: "notes/todo.md",
      newLeaf: true,
    });

    expect(result.content[0]!.text).toBe("Opened notes/todo.md");
    expect(app.workspace.openLinkText).toHaveBeenCalledWith(
      "notes/todo.md",
      "",
      true,
    );
  });
});
