// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Notice, Plugin, SecretStorage } from "obsidian";
import MCPToolsPlugin from "./main";
import { DEFAULT_SETTINGS } from "./settings";

// Mock the server module — we don't want to start real HTTP servers in tests
vi.mock("./server", () => ({
  HttpServer: class MockHttpServer {
    async start(): Promise<void> {}
    async stop(): Promise<void> {}
  },
}));

// Mock the MCP SDK
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: class MockMcpServer {},
}));

// Mock obsidian-daily-notes-interface — imported transitively via periodic.ts
vi.mock("obsidian-daily-notes-interface", () => ({
  appHasDailyNotesPluginLoaded: () => false,
  appHasWeeklyNotesPluginLoaded: () => false,
  appHasMonthlyNotesPluginLoaded: () => false,
  appHasQuarterlyNotesPluginLoaded: () => false,
  appHasYearlyNotesPluginLoaded: () => false,
  getDailyNote: () => null,
  getWeeklyNote: () => null,
  getMonthlyNote: () => null,
  getQuarterlyNote: () => null,
  getYearlyNote: () => null,
  getAllDailyNotes: () => ({}),
  getAllWeeklyNotes: () => ({}),
  getAllMonthlyNotes: () => ({}),
  getAllQuarterlyNotes: () => ({}),
  getAllYearlyNotes: () => ({}),
  createDailyNote: () => Promise.resolve(null),
  createWeeklyNote: () => Promise.resolve(null),
  createMonthlyNote: () => Promise.resolve(null),
  createQuarterlyNote: () => Promise.resolve(null),
  createYearlyNote: () => Promise.resolve(null),
}));

function createPlugin(): MCPToolsPlugin {
  // Mock Plugin constructor takes no args; cast to bypass TS signature check
  const PluginClass = MCPToolsPlugin as unknown as new () => MCPToolsPlugin;
  const plugin = new PluginClass();
  plugin.app = {
    vault: { getAbstractFileByPath: () => null },
    secretStorage: new SecretStorage(),
  } as unknown as MCPToolsPlugin["app"];
  plugin.manifest = {
    id: "mcp-tools",
    name: "MCP Tools",
    version: "1.0.0",
    author: "Test",
    minAppVersion: "1.0.0",
    description: "Test plugin",
  };
  return plugin;
}

describe("testing infrastructure", () => {
  it("resolves obsidian imports to the manual mock", () => {
    expect(Plugin).toBeDefined();
    expect(Notice).toBeDefined();
  });

  it("can instantiate mocked obsidian classes", () => {
    const notice = new Notice("Test message");
    expect(notice).toBeInstanceOf(Notice);
  });

  it("MCPToolsPlugin extends the mocked Plugin class", () => {
    expect(MCPToolsPlugin.prototype).toBeInstanceOf(Plugin);
  });
});

describe("MCPToolsPlugin", () => {
  let plugin: MCPToolsPlugin;

  beforeEach(() => {
    plugin = createPlugin();
  });

  it("generates an API key on first load", async () => {
    await plugin.onload();
    const key = plugin.getApiKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("preserves the API key on subsequent loads", async () => {
    await plugin.onload();
    const firstKey = plugin.getApiKey();

    // Create a second plugin instance with the same SecretStorage
    const plugin2 =
      new (MCPToolsPlugin as unknown as new () => MCPToolsPlugin)();
    plugin2.app = plugin.app;
    plugin2.manifest = plugin.manifest;
    await plugin2.onload();

    expect(plugin2.getApiKey()).toBe(firstKey);
  });

  it("applies default settings when no saved data exists", async () => {
    await plugin.onload();
    expect(plugin.settings.port).toBe(DEFAULT_SETTINGS.port);
  });

  it("merges saved data with defaults", async () => {
    const customPort = 9999;
    vi.spyOn(plugin, "loadData").mockResolvedValue({ port: customPort });
    await plugin.onload();
    expect(plugin.settings.port).toBe(customPort);
  });

  it("regenerateApiKey produces a new key", async () => {
    await plugin.onload();
    const originalKey = plugin.getApiKey();
    await plugin.regenerateApiKey();
    const newKey = plugin.getApiKey();
    expect(newKey).not.toBe(originalKey);
    expect(newKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it("regenerateApiKey persists the new key in SecretStorage", async () => {
    await plugin.onload();
    await plugin.regenerateApiKey();
    const storedKey = plugin.app.secretStorage.getSecret("mcp-api-key");
    expect(storedKey).toBe(plugin.getApiKey());
  });

  it("onunload stops the server without errors", async () => {
    await plugin.onload();
    expect(() => plugin.onunload()).not.toThrow();
  });
});
