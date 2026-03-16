// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, SecretStorage } from "obsidian";
import {
  MCPToolsSettingTab,
  MCPToolsPluginInterface,
  DEFAULT_SETTINGS,
} from "./settings";

const TEST_API_KEY = "a".repeat(64);
const TEST_PORT = 28080;

function createMockPlugin(
  overrides: Partial<MCPToolsPluginInterface> = {},
): MCPToolsPluginInterface {
  return {
    app: {
      vault: { getAbstractFileByPath: () => null },
      secretStorage: new SecretStorage(),
    } as unknown as App,
    manifest: { id: "mcp-tools", name: "MCP Tools", version: "1.0.0" },
    settings: { port: TEST_PORT },
    getApiKey: () => TEST_API_KEY,
    regenerateApiKey: vi.fn().mockResolvedValue(TEST_API_KEY),
    restartServer: vi.fn().mockResolvedValue(undefined),
    saveData: vi.fn().mockResolvedValue(undefined),
    loadData: vi.fn().mockResolvedValue(null),
    addSettingTab: vi.fn(),
    onload: vi.fn(),
    onunload: vi.fn(),
    ...overrides,
  } as unknown as MCPToolsPluginInterface;
}

describe("MCPToolsSettingTab", () => {
  let plugin: MCPToolsPluginInterface;
  let tab: MCPToolsSettingTab;

  beforeEach(() => {
    plugin = createMockPlugin();
    tab = new MCPToolsSettingTab(plugin.app, plugin);
  });

  it("renders without errors", () => {
    expect(() => tab.display()).not.toThrow();
  });

  it("displays the current API key", () => {
    tab.display();
    expect(tab.containerEl.textContent).toContain(TEST_API_KEY);
  });

  it("displays the current port", () => {
    tab.display();
    expect(tab.containerEl.textContent).toContain(String(TEST_PORT));
  });

  it("How to Connect mcp.json contains correct URL", () => {
    tab.display();
    const text = tab.containerEl.textContent ?? "";
    expect(text).toContain(`http://127.0.0.1:${TEST_PORT}/mcp`);
  });

  it("How to Connect mcp.json contains the API key", () => {
    tab.display();
    const text = tab.containerEl.textContent ?? "";
    expect(text).toContain(`Bearer ${TEST_API_KEY}`);
  });

  it("How to Connect claude command contains correct URL and key", () => {
    tab.display();
    const text = tab.containerEl.textContent ?? "";
    expect(text).toContain("claude mcp add");
    expect(text).toContain(`obsidian-mcp http://127.0.0.1:${TEST_PORT}/mcp`);
    expect(text).toContain(TEST_API_KEY);
  });

  it("updates How to Connect when port changes", () => {
    const customPort = 9999;
    plugin.settings.port = customPort;
    tab.display();
    const text = tab.containerEl.textContent ?? "";
    expect(text).toContain(`http://127.0.0.1:${customPort}/mcp`);
  });

  it("updates How to Connect when API key changes", () => {
    const newKey = "b".repeat(64);
    plugin = createMockPlugin({ getApiKey: () => newKey });
    tab = new MCPToolsSettingTab(plugin.app, plugin);
    tab.display();
    const text = tab.containerEl.textContent ?? "";
    expect(text).toContain(newKey);
    expect(text).not.toContain(TEST_API_KEY);
  });

  it("DEFAULT_SETTINGS has expected values", () => {
    expect(DEFAULT_SETTINGS.port).toBe(28080);
  });
});
