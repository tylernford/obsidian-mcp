import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, TFile } from "obsidian";
import { applyUpdate } from "./update-utils";

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

  server.registerTool(
    "active_file_update",
    {
      description:
        "Update the currently open note by targeting a specific heading, block reference, or frontmatter field",
      inputSchema: {
        operation: z
          .enum(["append", "prepend", "replace"])
          .describe("How to apply the content relative to the target"),
        targetType: z
          .enum(["heading", "block", "frontmatter"])
          .describe("The type of target to patch"),
        target: z
          .string()
          .describe(
            "Target identifier: heading text with '::' delimiter for hierarchy (e.g. 'Parent::Child' for a ## Child under # Parent), block reference ID (without ^), or frontmatter field name",
          ),
        content: z.string().describe("Content to insert or replace with"),
        createIfMissing: z
          .boolean()
          .optional()
          .default(false)
          .describe("Create the target if it does not exist"),
      },
    },
    async ({ operation, targetType, target, content, createIfMissing }) => {
      const file = app.workspace.getActiveFile();

      if (!file || !(file instanceof TFile)) {
        return {
          content: [{ type: "text" as const, text: "No active file open" }],
          isError: true,
        };
      }

      return applyUpdate(app, file, {
        operation: operation,
        targetType: targetType,
        target: target,
        content: content,
        createIfMissing: createIfMissing,
      });
    },
  );
}
