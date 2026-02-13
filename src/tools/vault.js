import { z } from "zod";

export function registerVaultTools(server, client) {
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
}
