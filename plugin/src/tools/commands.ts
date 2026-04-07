import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App } from "obsidian";

export function registerCommandTools(server: McpServer, app: App): void {
  server.registerTool(
    "commands_list",
    {
      description: "List all registered Obsidian commands (core + plugins)",
      inputSchema: {},
    },
    async () => {
      const cmds = app.commands.commands;
      const list = Object.values(cmds).map(({ id, name }) => ({ id, name }));

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(list, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "commands_execute",
    {
      description: "Execute an Obsidian command by ID",
      inputSchema: {
        commandId: z
          .string()
          .describe(
            "Command ID to execute (e.g. 'global-search:open'). Use commands_list to find available IDs.",
          ),
      },
    },
    async ({ commandId }) => {
      const result = app.commands.executeCommandById(commandId);

      if (!result) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Command not found: ${commandId}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Executed command: ${commandId}`,
          },
        ],
      };
    },
  );
}
