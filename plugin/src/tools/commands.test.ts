// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App } from "obsidian";
import { registerCommandTools } from "./commands";

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
      commands: {
        "editor:bold": { id: "editor:bold", name: "Toggle bold" },
        "global-search:open": { id: "global-search:open", name: "Search" },
      },
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

describe("commands_list", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("returns all registered commands as { id, name } array", async () => {
    const app = createApp();

    registerCommandTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("commands_list", {});

    const parsed = JSON.parse(result.content[0]!.text) as Array<{
      id: string;
      name: string;
    }>;
    expect(parsed).toEqual(
      expect.arrayContaining([
        { id: "editor:bold", name: "Toggle bold" },
        { id: "global-search:open", name: "Search" },
      ]),
    );
    expect(parsed).toHaveLength(2);
    expect(result.isError).toBeUndefined();
  });
});

describe("commands_execute", () => {
  beforeEach(() => {
    Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  });

  it("executes a valid command and returns success", async () => {
    const app = createApp();

    registerCommandTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("commands_execute", {
      commandId: "global-search:open",
    });

    expect(result.content[0]!.text).toBe(
      "Executed command: global-search:open",
    );
    expect(result.isError).toBeUndefined();
  });

  it("returns error for unknown command", async () => {
    const app = createApp();
    vi.mocked(
      (
        app as unknown as {
          commands: { executeCommandById: ReturnType<typeof vi.fn> };
        }
      ).commands.executeCommandById,
    ).mockReturnValue(false);

    registerCommandTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("commands_execute", {
      commandId: "nonexistent:command",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Command not found");
  });
});
