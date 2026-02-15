import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianClient } from "../api-client.js";

export function registerMetadataTools(
  server: McpServer,
  client: ObsidianClient,
) {
  server.tool(
    "tags_manage",
    "List, add, or remove tags on a note",
    {
      filename: z.string().describe("Path to file relative to vault root"),
      action: z
        .enum(["list", "add", "remove"])
        .describe(
          "'list' returns current tags. 'add'/'remove' modify the tags.",
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          "Tags to add or remove (required for 'add' and 'remove'). Include '#' prefix.",
        ),
    },
    async ({ filename, action, tags }) => {
      const encodedPath = client.encodePath(filename);

      // Read current note to get existing tags
      const readResult = await client.request<{ tags?: string[] }>(
        "GET",
        `/vault/${encodedPath}`,
        {
          headers: { Accept: "application/vnd.olrapi.note+json" },
        },
      );

      if (!readResult.ok) {
        return {
          content: [{ type: "text", text: readResult.error }],
          isError: true,
        };
      }

      const currentTags = readResult.data.tags || [];

      if (action === "list") {
        return {
          content: [
            { type: "text", text: JSON.stringify(currentTags, null, 2) },
          ],
        };
      }

      if (!tags || tags.length === 0) {
        return {
          content: [
            { type: "text", text: "tags are required for add/remove actions" },
          ],
          isError: true,
        };
      }

      let newTags: string[];
      if (action === "add") {
        const tagSet = new Set(currentTags);
        for (const tag of tags) {
          tagSet.add(tag);
        }
        newTags = [...tagSet];
      } else {
        const removeSet = new Set(tags);
        newTags = currentTags.filter((t) => !removeSet.has(t));
      }

      const patchResult = await client.patch(`/vault/${encodedPath}`, {
        operation: "replace",
        targetType: "frontmatter",
        target: "tags",
        content: JSON.stringify(newTags),
        createIfMissing: true,
      });

      if (!patchResult.ok) {
        return {
          content: [{ type: "text", text: patchResult.error }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(newTags, null, 2) }],
      };
    },
  );

  server.tool(
    "frontmatter_manage",
    "Read or update YAML frontmatter fields on a note",
    {
      filename: z.string().describe("Path to file relative to vault root"),
      action: z
        .enum(["read", "set"])
        .describe(
          "'read' returns all frontmatter fields. 'set' updates a specific field.",
        ),
      key: z
        .string()
        .optional()
        .describe("(set only) Frontmatter field name to update"),
      value: z
        .string()
        .optional()
        .describe(
          "(set only) Value to set. For complex values (arrays, objects), pass a JSON string.",
        ),
    },
    async ({ filename, action, key, value }) => {
      const encodedPath = client.encodePath(filename);

      if (action === "read") {
        const result = await client.request<{
          frontmatter?: Record<string, unknown>;
        }>("GET", `/vault/${encodedPath}`, {
          headers: { Accept: "application/vnd.olrapi.note+json" },
        });

        if (!result.ok) {
          return {
            content: [{ type: "text", text: result.error }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data.frontmatter || {}, null, 2),
            },
          ],
        };
      }

      // action === "set"
      if (!key || !value) {
        return {
          content: [
            {
              type: "text",
              text: "key and value are required for the set action",
            },
          ],
          isError: true,
        };
      }

      const result = await client.patch(`/vault/${encodedPath}`, {
        operation: "replace",
        targetType: "frontmatter",
        target: key,
        content: value,
        createIfMissing: true,
      });

      if (!result.ok) {
        return {
          content: [{ type: "text", text: result.error }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Set ${key} on ${filename}` }],
      };
    },
  );
}
