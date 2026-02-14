import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianClient } from "../api-client.js";

export function registerNavigationTools(server: McpServer, client: ObsidianClient) {
  server.tool(
    "file_open",
    "Open a note in the Obsidian UI",
    {
      filename: z
        .string()
        .describe("Path to file relative to vault root"),
      newLeaf: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "If true, open in a new tab instead of replacing the current one"
        ),
    },
    async ({ filename, newLeaf }) => {
      const result = await client.request(
        "POST",
        `/open/${client.encodePath(filename)}`,
        { queryParams: { newLeaf } }
      );

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: `Opened ${filename}` }],
      };
    }
  );
}
