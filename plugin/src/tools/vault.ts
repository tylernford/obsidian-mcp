import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile, TFolder, normalizePath } from "obsidian";

export function registerVaultTools(server: McpServer, app: App): void {
  server.registerTool(
    "vault_list",
    {
      description: "List files and directories at a given path in the vault",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe(
            "Directory path relative to vault root. Omit to list root.",
          ),
      },
    },
    async ({ path }) => {
      const folder = path
        ? app.vault.getAbstractFileByPath(normalizePath(path))
        : app.vault.getRoot();

      if (!folder || !(folder instanceof TFolder)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Directory not found: ${path ?? "/"}`,
            },
          ],
          isError: true,
        };
      }

      const files = folder.children
        .map((child) =>
          child instanceof TFolder ? `${child.name}/` : child.name,
        )
        .sort();

      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ files }, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "vault_read",
    {
      description:
        "Read a note's content with optional parsed frontmatter and tags",
      inputSchema: {
        filename: z
          .string()
          .describe(
            "Path to file relative to vault root (e.g. 'folder/note.md')",
          ),
        format: z
          .enum(["markdown", "json"])
          .default("json")
          .describe(
            "'json' returns parsed frontmatter, tags, and file stats. 'markdown' returns raw content.",
          ),
      },
    },
    async ({ filename, format }) => {
      const file = app.vault.getAbstractFileByPath(normalizePath(filename));

      if (!file || !(file instanceof TFile)) {
        return {
          content: [
            { type: "text" as const, text: `File not found: ${filename}` },
          ],
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

  server.registerTool(
    "vault_create",
    {
      description: "Create a new note in the vault",
      inputSchema: {
        filename: z
          .string()
          .describe(
            "Path for the new note relative to vault root (e.g. 'folder/note.md')",
          ),
        content: z.string().describe("Markdown content for the new note"),
      },
    },
    async ({ filename, content }) => {
      const normalized = normalizePath(filename);

      try {
        await app.vault.create(normalized, content);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `File already exists: ${filename}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: `Created ${filename}` }],
      };
    },
  );

  server.registerTool(
    "vault_delete",
    {
      description: "Delete a note from the vault",
      inputSchema: {
        filename: z.string().describe("Path to file relative to vault root"),
      },
    },
    async ({ filename }) => {
      const file = app.vault.getAbstractFileByPath(normalizePath(filename));

      if (!file || !(file instanceof TFile)) {
        return {
          content: [
            { type: "text" as const, text: `File not found: ${filename}` },
          ],
          isError: true,
        };
      }

      await app.fileManager.trashFile(file);

      return {
        content: [{ type: "text" as const, text: `Deleted ${filename}` }],
      };
    },
  );
}
