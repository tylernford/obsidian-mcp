import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianClient } from "../api-client.js";

export function registerVaultTools(server: McpServer, client: ObsidianClient) {
  server.tool(
    "vault_list",
    "List files and directories at a given path in the vault",
    {
      path: z
        .string()
        .optional()
        .describe(
          "Directory path relative to vault root. Omit to list root."
        ),
    },
    async ({ path }) => {
      const apiPath = path
        ? `/vault/${client.encodePath(path)}/`
        : "/vault/";

      const result = await client.request("GET", apiPath);

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }
  );

  server.tool(
    "vault_read",
    "Read a note's content with optional parsed frontmatter and tags",
    {
      filename: z
        .string()
        .describe(
          "Path to file relative to vault root (e.g. 'folder/note.md')"
        ),
      format: z
        .enum(["markdown", "json"])
        .default("json")
        .describe(
          "'json' returns parsed frontmatter, tags, and file stats. 'markdown' returns raw content."
        ),
    },
    async ({ filename, format }) => {
      const accept =
        format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";

      const result = await client.request(
        "GET",
        `/vault/${client.encodePath(filename)}`,
        { headers: { Accept: accept } }
      );

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
    "vault_create",
    "Create a new note in the vault",
    {
      filename: z
        .string()
        .describe(
          "Path for the new note relative to vault root (e.g. 'folder/note.md')"
        ),
      content: z.string().describe("Markdown content for the new note"),
    },
    async ({ filename, content }) => {
      const result = await client.request(
        "PUT",
        `/vault/${client.encodePath(filename)}`,
        {
          body: content,
          headers: { "Content-Type": "text/markdown" },
        }
      );

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: `Created ${filename}` }],
      };
    }
  );

  server.tool(
    "vault_update",
    "Update a note by inserting or replacing content at a heading, block, or frontmatter field",
    {
      filename: z
        .string()
        .describe("Path to file relative to vault root"),
      operation: z
        .enum(["append", "prepend", "replace"])
        .describe("How to apply the update relative to the target"),
      targetType: z
        .enum(["heading", "block", "frontmatter"])
        .describe("Type of target to update"),
      target: z
        .string()
        .describe(
          "Target identifier. Headings: use '::' delimiter for nesting (e.g. 'Heading 1::Subheading'). Blocks: block reference ID (e.g. '2d9b4a'). Frontmatter: field name (e.g. 'tags')."
        ),
      content: z.string().describe("Content to insert or replace with"),
      createIfMissing: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "If true, create the target if it doesn't exist (useful for new frontmatter fields)"
        ),
    },
    async ({ filename, operation, targetType, target, content, createIfMissing }) => {
      const result = await client.patch(
        `/vault/${client.encodePath(filename)}`,
        { operation, targetType, target, content, createIfMissing }
      );

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: `Updated ${filename}` }],
      };
    }
  );

  server.tool(
    "vault_delete",
    "Delete a note from the vault",
    {
      filename: z
        .string()
        .describe("Path to file relative to vault root"),
    },
    async ({ filename }) => {
      const result = await client.request(
        "DELETE",
        `/vault/${client.encodePath(filename)}`
      );

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: `Deleted ${filename}` }],
      };
    }
  );
}
