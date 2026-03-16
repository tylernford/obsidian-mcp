import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile } from "obsidian";

export function registerActiveFileTools(server: McpServer, app: App): void {
  server.registerTool(
    "active_file_read",
    {
      description: "Read the currently open note in Obsidian",
      inputSchema: {
        format: z
          .enum(["markdown", "json"])
          .default("json")
          .describe(
            "'json' returns parsed frontmatter, tags, and stats. 'markdown' returns raw content.",
          ),
      },
    },
    async ({ format }) => {
      const file = app.workspace.getActiveFile();

      if (!file || !(file instanceof TFile)) {
        return {
          content: [{ type: "text" as const, text: "No active file open" }],
          isError: true,
        };
      }

      const content = await app.vault.read(file);

      if (format === "markdown") {
        return { content: [{ type: "text" as const, text: content }] };
      }

      const cache = app.metadataCache.getFileCache(file);
      const result = {
        content,
        frontmatter: cache?.frontmatter ?? {},
        tags: cache?.tags?.map((t) => t.tag) ?? [],
        stat: file.stat,
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );
}
