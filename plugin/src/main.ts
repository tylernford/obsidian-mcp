import { Plugin } from "obsidian";

export default class MCPToolsPlugin extends Plugin {
  async onload() {
    console.debug("MCP Tools plugin loaded");
  }

  onunload() {
    console.debug("MCP Tools plugin unloaded");
  }
}
