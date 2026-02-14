import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianClient } from "../api-client.js";

export function registerActiveFileTools(server: McpServer, client: ObsidianClient) {
  server.tool(
    "active_file_read",
    "Read the currently open note in Obsidian",
    {
      format: z
        .enum(["markdown", "json"])
        .default("json")
        .describe(
          "'json' returns parsed frontmatter, tags, and stats. 'markdown' returns raw content."
        ),
    },
    async ({ format }) => {
      const accept =
        format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";

      const result = await client.request("GET", "/active/", {
        headers: { Accept: accept },
      });

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      const text =
        typeof result.data === "string"
          ? result.data
          : JSON.stringify(result.data, null, 2);

      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "active_file_update",
    "Update the currently open note in Obsidian",
    {
      operation: z
        .enum(["append", "prepend", "replace"])
        .describe("How to apply the update relative to the target"),
      targetType: z
        .enum(["heading", "block", "frontmatter"])
        .describe("Type of target to update"),
      target: z
        .string()
        .describe("Target identifier (same format as vault_update)"),
      content: z.string().describe("Content to insert or replace with"),
      createIfMissing: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, create the target if it doesn't exist"),
    },
    async ({ operation, targetType, target, content, createIfMissing }) => {
      const result = await client.patch("/active/", {
        operation,
        targetType,
        target,
        content,
        createIfMissing,
      });

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: "Updated active file" }],
      };
    }
  );
}
