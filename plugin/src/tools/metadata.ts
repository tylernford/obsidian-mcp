import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile, normalizePath } from "obsidian";

export function registerMetadataTools(server: McpServer, app: App): void {
  server.registerTool(
    "tags_manage",
    {
      description: "List, add, or remove tags in a note's frontmatter",
      inputSchema: {
        filename: z.string().describe("Path to file relative to vault root"),
        action: z
          .enum(["list", "add", "remove"])
          .describe("Action to perform on tags"),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            "Tags to add or remove. No '#' prefix. Required for add/remove.",
          ),
      },
    },
    async ({ filename, action, tags }) => {
      const file = app.vault.getAbstractFileByPath(normalizePath(filename));

      if (!file || !(file instanceof TFile)) {
        return {
          content: [
            { type: "text" as const, text: `File not found: ${filename}` },
          ],
          isError: true,
        };
      }

      if (action === "list") {
        const cache = app.metadataCache.getFileCache(file);
        const frontmatter: Record<string, unknown> = cache?.frontmatter ?? {};
        const rawTags: unknown = frontmatter.tags;
        const tagList = Array.isArray(rawTags)
          ? (rawTags as string[]).map((t) => t.replace(/^#/, ""))
          : [];

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ tags: tagList }, null, 2),
            },
          ],
        };
      }

      if (!tags || tags.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Tags array is required for add/remove actions",
            },
          ],
          isError: true,
        };
      }

      const cleanTags = tags.map((t) => t.replace(/^#/, ""));

      await app.fileManager.processFrontMatter(
        file,
        (frontmatter: Record<string, unknown>) => {
          const existing: string[] = Array.isArray(frontmatter.tags)
            ? (frontmatter.tags as string[])
            : [];

          if (action === "add") {
            const merged = [...existing];
            for (const tag of cleanTags) {
              if (!merged.includes(tag)) {
                merged.push(tag);
              }
            }
            frontmatter.tags = merged;
          } else {
            frontmatter.tags = existing.filter((t) => !cleanTags.includes(t));
          }
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Tags ${action === "add" ? "added" : "removed"}: ${cleanTags.join(", ")}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "frontmatter_manage",
    {
      description: "Read or set frontmatter fields on a note",
      inputSchema: {
        filename: z.string().describe("Path to file relative to vault root"),
        action: z
          .enum(["read", "set"])
          .describe("'read' returns all frontmatter, 'set' updates a field"),
        key: z
          .string()
          .optional()
          .describe("Frontmatter key to set. Required for 'set' action."),
        value: z
          .string()
          .optional()
          .describe(
            "Value to set. JSON strings are parsed into native types. Required for 'set' action.",
          ),
      },
    },
    async ({ filename, action, key, value }) => {
      const file = app.vault.getAbstractFileByPath(normalizePath(filename));

      if (!file || !(file instanceof TFile)) {
        return {
          content: [
            { type: "text" as const, text: `File not found: ${filename}` },
          ],
          isError: true,
        };
      }

      if (action === "read") {
        const cache = app.metadataCache.getFileCache(file);
        const frontmatter = { ...(cache?.frontmatter ?? {}) };
        delete frontmatter.position;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(frontmatter, null, 2),
            },
          ],
        };
      }

      if (!key) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Key is required for set action",
            },
          ],
          isError: true,
        };
      }

      let parsedValue: unknown = value;
      if (typeof value === "string") {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // Keep as raw string
        }
      }

      await app.fileManager.processFrontMatter(
        file,
        (frontmatter: Record<string, unknown>) => {
          frontmatter[key] = parsedValue;
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Set ${key} in ${filename}`,
          },
        ],
      };
    },
  );
}
