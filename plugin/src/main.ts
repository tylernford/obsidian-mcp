import { Notice, Plugin } from "obsidian";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateApiKey } from "./crypto";
import { HttpServer } from "./server";
import {
  MCPToolsSettingTab,
  MCPToolsSettings,
  DEFAULT_SETTINGS,
} from "./settings";

const API_KEY_SECRET_ID = "mcp-api-key";

export default class MCPToolsPlugin extends Plugin {
  settings: MCPToolsSettings = { ...DEFAULT_SETTINGS };
  private apiKey = "";
  private httpServer: HttpServer | null = null;
  private mcpServer: McpServer | null = null;

  async onload(): Promise<void> {
    const saved = (await this.loadData()) as Partial<MCPToolsSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved };

    this.apiKey = this.loadOrGenerateApiKey();

    this.mcpServer = new McpServer({
      name: this.manifest.name,
      version: this.manifest.version,
    });

    this.httpServer = new HttpServer({
      port: this.settings.port,
      host: "127.0.0.1",
      apiKey: this.apiKey,
      mcpServer: this.mcpServer,
    });

    try {
      await this.httpServer.start();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error starting server";
      new Notice(`MCP Tools: Failed to start server — ${message}`);
    }

    this.addSettingTab(new MCPToolsSettingTab(this.app, this));
  }

  onunload(): void {
    if (this.httpServer) {
      void this.httpServer.stop();
      this.httpServer = null;
    }
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async regenerateApiKey(): Promise<string> {
    this.apiKey = generateApiKey();
    this.app.secretStorage.setSecret(API_KEY_SECRET_ID, this.apiKey);
    await this.restartServer();
    return this.apiKey;
  }

  async restartServer(): Promise<void> {
    if (this.httpServer) {
      await this.httpServer.stop();
    }

    if (!this.mcpServer) return;

    this.httpServer = new HttpServer({
      port: this.settings.port,
      host: "127.0.0.1",
      apiKey: this.apiKey,
      mcpServer: this.mcpServer,
    });

    await this.httpServer.start();
  }

  private loadOrGenerateApiKey(): string {
    const existing = this.app.secretStorage.getSecret(API_KEY_SECRET_ID);
    if (existing) return existing;

    const newKey = generateApiKey();
    this.app.secretStorage.setSecret(API_KEY_SECRET_ID, newKey);
    return newKey;
  }
}
