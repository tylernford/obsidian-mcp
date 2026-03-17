// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile, TFolder, CachedMetadata } from "obsidian";
import { registerPeriodicTools } from "./periodic";

vi.mock("obsidian-daily-notes-interface", () => ({
  appHasDailyNotesPluginLoaded: vi.fn(() => false),
  appHasWeeklyNotesPluginLoaded: vi.fn(() => false),
  appHasMonthlyNotesPluginLoaded: vi.fn(() => false),
  appHasQuarterlyNotesPluginLoaded: vi.fn(() => false),
  appHasYearlyNotesPluginLoaded: vi.fn(() => false),
  getDailyNote: vi.fn(() => null),
  getWeeklyNote: vi.fn(() => null),
  getMonthlyNote: vi.fn(() => null),
  getQuarterlyNote: vi.fn(() => null),
  getYearlyNote: vi.fn(() => null),
  getAllDailyNotes: vi.fn(() => ({})),
  getAllWeeklyNotes: vi.fn(() => ({})),
  getAllMonthlyNotes: vi.fn(() => ({})),
  getAllQuarterlyNotes: vi.fn(() => ({})),
  getAllYearlyNotes: vi.fn(() => ({})),
}));

import {
  appHasDailyNotesPluginLoaded,
  appHasWeeklyNotesPluginLoaded,
  getDailyNote,
  getWeeklyNote,
  getAllDailyNotes,
  getAllWeeklyNotes,
} from "obsidian-daily-notes-interface";

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

function createApp(overrides: Partial<App> = {}): App {
  const root = new TFolder();
  root.path = "";
  root.name = "";
  root.children = [];
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      getRoot: vi.fn(() => root),
      read: vi.fn(async () => ""),
      cachedRead: vi.fn(async () => ""),
      getMarkdownFiles: vi.fn(() => []),
      create: vi.fn(async () => createTFile("new.md")),
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
      processFrontMatter: vi.fn(async () => {}),
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
    plugins: {
      getPlugin: vi.fn(() => null),
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

const fakeMoment = {} as unknown;

beforeEach(() => {
  Object.keys(registeredTools).forEach((k) => delete registeredTools[k]);
  vi.restoreAllMocks();
  (window as unknown as Record<string, unknown>).moment = () => fakeMoment;
});

describe("periodic_read", () => {
  it("returns markdown content for daily note", async () => {
    const file = createTFile("daily/2026-03-16.md");
    const allNotes = { "2026-03-16": file };
    vi.mocked(appHasDailyNotesPluginLoaded).mockReturnValue(true);
    vi.mocked(getAllDailyNotes).mockReturnValue(allNotes);
    vi.mocked(getDailyNote).mockReturnValue(file);

    const app = createApp();
    vi.mocked(app.vault.read).mockResolvedValue("# Today\nDid stuff.");

    registerPeriodicTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("periodic_read", {
      period: "daily",
      format: "markdown",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("# Today\nDid stuff.");
    expect(getDailyNote).toHaveBeenCalledWith(fakeMoment, allNotes);
  });

  it("returns json with frontmatter, tags, and stat", async () => {
    const file = createTFile("daily/2026-03-16.md", {
      ctime: 100,
      mtime: 200,
      size: 50,
    });
    vi.mocked(appHasDailyNotesPluginLoaded).mockReturnValue(true);
    vi.mocked(getAllDailyNotes).mockReturnValue({ key: file });
    vi.mocked(getDailyNote).mockReturnValue(file);

    const app = createApp();
    vi.mocked(app.vault.read).mockResolvedValue("body");
    vi.mocked(app.metadataCache.getFileCache).mockReturnValue({
      frontmatter: { mood: "good" },
      tags: [{ tag: "#journal", position: {} }],
    } as unknown as CachedMetadata);

    registerPeriodicTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("periodic_read", {
      period: "daily",
      format: "json",
    });

    const parsed = JSON.parse(result.content[0]!.text) as Record<
      string,
      unknown
    >;
    expect(parsed.content).toBe("body");
    expect(parsed.frontmatter).toEqual({ mood: "good" });
    expect(parsed.tags).toEqual(["#journal"]);
    expect(parsed.stat).toEqual({ ctime: 100, mtime: 200, size: 50 });
  });

  it("returns error when periodic notes plugin is not enabled", async () => {
    vi.mocked(appHasDailyNotesPluginLoaded).mockReturnValue(false);

    const app = createApp();
    registerPeriodicTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("periodic_read", {
      period: "daily",
      format: "markdown",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe(
      "Periodic notes for daily is not enabled",
    );
  });

  it("returns error when current period note does not exist", async () => {
    vi.mocked(appHasDailyNotesPluginLoaded).mockReturnValue(true);
    vi.mocked(getAllDailyNotes).mockReturnValue({});
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- testing null return from loosely-typed library
    vi.mocked(getDailyNote).mockReturnValue(null as unknown as TFile);

    const app = createApp();
    registerPeriodicTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("periodic_read", {
      period: "daily",
      format: "markdown",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe(
      "No daily note exists for the current period",
    );
  });

  it("works with weekly period", async () => {
    const file = createTFile("weekly/2026-W12.md");
    vi.mocked(appHasWeeklyNotesPluginLoaded).mockReturnValue(true);
    vi.mocked(getAllWeeklyNotes).mockReturnValue({ key: file });
    vi.mocked(getWeeklyNote).mockReturnValue(file);

    const app = createApp();
    vi.mocked(app.vault.read).mockResolvedValue("# Week 12");

    registerPeriodicTools(new McpServer({ name: "t", version: "1" }), app);
    const result = await callTool("periodic_read", {
      period: "weekly",
      format: "markdown",
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toBe("# Week 12");
    expect(getWeeklyNote).toHaveBeenCalledWith(fakeMoment, { key: file });
  });
});
