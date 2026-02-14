import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianClient } from "../api-client.js";

export function registerSearchTools(server: McpServer, client: ObsidianClient) {
  server.tool(
    "search",
    "Search the vault using full-text search or Dataview DQL queries",
    {
      type: z
        .enum(["simple", "dataview"])
        .describe(
          "'simple' for full-text search, 'dataview' for Dataview DQL queries"
        ),
      query: z
        .string()
        .describe(
          "For 'simple': text to search for. For 'dataview': a TABLE-type DQL query (e.g. 'TABLE file.name FROM #tag')"
        ),
      contextLength: z
        .number()
        .optional()
        .default(100)
        .describe(
          "(simple only) Characters of context to return around each match"
        ),
    },
    async ({ type, query, contextLength }) => {
      let result;

      if (type === "simple") {
        result = await client.request("POST", "/search/simple/", {
          queryParams: { query, contextLength },
        });
      } else {
        result = await client.request("POST", "/search/", {
          body: query,
          headers: {
            "Content-Type": "application/vnd.olrapi.dataview.dql+txt",
          },
        });
      }

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      };
    }
  );
}
