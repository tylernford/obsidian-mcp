import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile } from "obsidian";
import {
  appHasDailyNotesPluginLoaded,
  appHasWeeklyNotesPluginLoaded,
  appHasMonthlyNotesPluginLoaded,
  appHasQuarterlyNotesPluginLoaded,
  appHasYearlyNotesPluginLoaded,
  getDailyNote,
  getWeeklyNote,
  getMonthlyNote,
  getQuarterlyNote,
  getYearlyNote,
  getAllDailyNotes,
  getAllWeeklyNotes,
  getAllMonthlyNotes,
  getAllQuarterlyNotes,
  getAllYearlyNotes,
} from "obsidian-daily-notes-interface";
/** Moment is available at runtime via `window.moment` in Obsidian. */
type Moment = ReturnType<typeof window.moment>;

type Period = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

interface PeriodicNoteAccessor {
  isLoaded: () => boolean;
  getAll: () => Record<string, TFile>;
  get: (date: Moment, allNotes: Record<string, TFile>) => TFile | null;
}

const accessors: Record<Period, PeriodicNoteAccessor> = {
  daily: {
    isLoaded: appHasDailyNotesPluginLoaded,
    getAll: getAllDailyNotes,
    get: getDailyNote,
  },
  weekly: {
    isLoaded: appHasWeeklyNotesPluginLoaded,
    getAll: getAllWeeklyNotes,
    get: getWeeklyNote,
  },
  monthly: {
    isLoaded: appHasMonthlyNotesPluginLoaded,
    getAll: getAllMonthlyNotes,
    get: getMonthlyNote,
  },
  quarterly: {
    isLoaded: appHasQuarterlyNotesPluginLoaded,
    getAll: getAllQuarterlyNotes,
    get: getQuarterlyNote,
  },
  yearly: {
    isLoaded: appHasYearlyNotesPluginLoaded,
    getAll: getAllYearlyNotes,
    get: getYearlyNote,
  },
};

export function registerPeriodicTools(server: McpServer, app: App): void {
  server.registerTool(
    "periodic_read",
    {
      description:
        "Read the current periodic note (daily, weekly, monthly, quarterly, or yearly)",
      inputSchema: {
        period: z
          .enum(["daily", "weekly", "monthly", "quarterly", "yearly"])
          .describe("The type of periodic note to read"),
        format: z
          .enum(["markdown", "json"])
          .default("json")
          .describe(
            "'json' returns parsed frontmatter, tags, and file stats. 'markdown' returns raw content.",
          ),
      },
    },
    async ({ period, format }) => {
      const accessor = accessors[period as Period];

      if (!accessor.isLoaded()) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Periodic notes for ${period} is not enabled`,
            },
          ],
          isError: true,
        };
      }

      const now = (window as unknown as { moment: () => Moment }).moment();
      const allNotes = accessor.getAll();
      const note = accessor.get(now, allNotes);

      if (!note) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No ${period} note exists for the current period`,
            },
          ],
          isError: true,
        };
      }

      const content = await app.vault.read(note);

      if (format === "markdown") {
        return { content: [{ type: "text" as const, text: content }] };
      }

      const cache = app.metadataCache.getFileCache(note);
      const result = {
        content,
        frontmatter: cache?.frontmatter ?? {},
        tags: cache?.tags?.map((t) => t.tag) ?? [],
        stat: note.stat,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
