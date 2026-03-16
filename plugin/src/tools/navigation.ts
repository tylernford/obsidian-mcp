import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, normalizePath } from "obsidian";

export function registerNavigationTools(server: McpServer, app: App): void {
  server.registerTool(
    "file_open",
    {
      description: "Open a note in the Obsidian UI",
      inputSchema: {
        filename: z.string().describe("Path to file relative to vault root"),
        newLeaf: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "If true, open in a new tab instead of replacing the current one",
          ),
      },
    },
    async ({ filename, newLeaf }) => {
      await app.workspace.openLinkText(normalizePath(filename), "", newLeaf);

      return {
        content: [{ type: "text" as const, text: `Opened ${filename}` }],
      };
    },
  );
}
