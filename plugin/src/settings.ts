import { App, Modal, Plugin, PluginSettingTab, Setting } from "obsidian";

export interface MCPToolsSettings {
  port: number;
}

export const DEFAULT_SETTINGS: MCPToolsSettings = {
  port: 28080,
};

export interface MCPToolsPluginInterface extends Plugin {
  settings: MCPToolsSettings;
  getApiKey(): string;
  regenerateApiKey(): Promise<string>;
  restartServer(): Promise<void>;
  saveData(data: unknown): Promise<void>;
}

export class MCPToolsSettingTab extends PluginSettingTab {
  plugin: MCPToolsPluginInterface;

  constructor(app: App, plugin: MCPToolsPluginInterface) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const port = this.plugin.settings.port;
    const apiKey = this.plugin.getApiKey();

    this.renderHowToConnect(containerEl, port, apiKey);
    this.renderApiKeySection(containerEl, apiKey);
    this.renderPortSection(containerEl, port);
  }

  private renderHowToConnect(
    containerEl: HTMLElement,
    port: number,
    apiKey: string,
  ): void {
    new Setting(containerEl).setName("How to connect").setHeading();

    const mcpJson = JSON.stringify(
      {
        mcpServers: {
          "obsidian-mcp": {
            type: "streamable-http",
            url: `http://127.0.0.1:${port}/mcp`,
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          },
        },
      },
      null,
      2,
    );

    new Setting(containerEl)
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- filename
      .setName("mcp.json")
      .setDesc("Add this to your MCP client configuration")
      .addButton((btn) =>
        btn.setButtonText("Copy").onClick(() => {
          void navigator.clipboard.writeText(mcpJson);
        }),
      );

    const codeBlock = containerEl.createEl("pre");
    codeBlock.createEl("code", { text: mcpJson });

    const claudeCommand = `claude mcp add --transport http --header "Authorization: Bearer ${apiKey}" obsidian-mcp http://127.0.0.1:${port}/mcp`;

    new Setting(containerEl)
      .setName("Claude Code CLI")
      .setDesc("Or run this command to add the server")
      .addButton((btn) =>
        btn.setButtonText("Copy").onClick(() => {
          void navigator.clipboard.writeText(claudeCommand);
        }),
      );

    const cmdBlock = containerEl.createEl("pre");
    cmdBlock.createEl("code", { text: claudeCommand });
  }

  private renderApiKeySection(containerEl: HTMLElement, apiKey: string): void {
    new Setting(containerEl).setName("Authentication").setHeading();

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Used to authenticate MCP client connections")
      .addText((text) => text.setValue(apiKey).setDisabled(true))
      .addButton((btn) =>
        btn.setButtonText("Copy").onClick(() => {
          void navigator.clipboard.writeText(apiKey);
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Regenerate")
          .setWarning()
          .onClick(() => {
            new ConfirmModal(
              this.app,
              "Regenerate API Key",
              "Are you sure? Existing MCP client connections will need to be updated with the new key.",
              async () => {
                await this.plugin.regenerateApiKey();
                this.display();
              },
            ).open();
          }),
      );
  }

  private renderPortSection(containerEl: HTMLElement, port: number): void {
    new Setting(containerEl).setName("Server").setHeading();

    let pendingPort = String(port);

    new Setting(containerEl)
      .setName("Port")
      .setDesc("HTTP server port (requires server restart)")
      .addText((text) =>
        text
          .setValue(String(port))
          .setPlaceholder(String(DEFAULT_SETTINGS.port))
          .onChange((value) => {
            pendingPort = value;
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Apply").onClick(() => {
          const newPort = parseInt(pendingPort, 10);
          if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
            return;
          }
          if (newPort === this.plugin.settings.port) {
            return;
          }

          new ConfirmModal(
            this.app,
            "Change Port",
            `Restart the server on port ${newPort}? Active connections will be dropped.`,
            async () => {
              this.plugin.settings.port = newPort;
              await this.plugin.saveData(this.plugin.settings);
              await this.plugin.restartServer();
              this.display();
            },
          ).open();
        }),
      );
  }
}

export class ConfirmModal extends Modal {
  private title: string;
  private message: string;
  private onConfirm: () => void | Promise<void>;

  constructor(
    app: App,
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
  ) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.createEl("p", { text: this.message });

    const buttonRow = this.contentEl.createEl("div", {
      cls: "modal-button-container",
    });

    new Setting(buttonRow)
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.close();
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Confirm")
          .setCta()
          .onClick(async () => {
            await this.onConfirm();
            this.close();
          }),
      );
  }
}
