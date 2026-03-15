import { describe, expect, it } from "vitest";
import { Notice, Plugin } from "obsidian";
import MCPToolsPlugin from "./main";

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
