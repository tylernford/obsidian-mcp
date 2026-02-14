import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianClient } from "../api-client.js";

export function registerCommandTools(server: McpServer, client: ObsidianClient) {
  server.tool(
    "commands_list",
    "List all registered Obsidian commands (core + plugins)",
    {},
    async () => {
      const result = await client.request("GET", "/commands/");

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }
  );

  server.tool(
    "commands_execute",
    "Execute an Obsidian command by ID",
    {
      commandId: z
        .string()
        .describe(
          "Command ID to execute (e.g. 'global-search:open'). Use commands_list to find available IDs."
        ),
    },
    async ({ commandId }) => {
      const result = await client.request(
        "POST",
        `/commands/${encodeURIComponent(commandId)}/`
      );

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: `Executed command: ${commandId}` }],
      };
    }
  );
}
