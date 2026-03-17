import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { App, prepareSimpleSearch } from "obsidian";

interface SearchContext {
  match: {
    start: number;
    end: number;
    source: "filename" | "content";
  };
  context: string;
}

interface SearchResponseItem {
  filename: string;
  score: number;
  matches: SearchContext[];
}

interface DataviewQueryResult {
  successful: boolean;
  type: string;
  headers: string[];
  values: unknown[][];
}

interface DataviewApi {
  tryQuery(dql: string): Promise<DataviewQueryResult>;
  settings: { tableIdColumnName: string };
}

interface DataviewPlugin {
  api: DataviewApi;
}

export function registerSearchTools(server: McpServer, app: App): void {
  server.registerTool(
    "search",
    {
      description:
        "Search the vault using simple full-text search or Dataview DQL queries",
      inputSchema: {
        query: z.string().describe("Search query or DQL query string"),
        type: z
          .enum(["simple", "dataview"])
          .describe("'simple' for full-text search, 'dataview' for DQL query"),
        contextLength: z
          .number()
          .optional()
          .default(100)
          .describe(
            "Number of context characters around each match (simple search only)",
          ),
      },
    },
    async ({ query, type, contextLength }) => {
      if (type === "simple") {
        return simpleSearch(app, query, contextLength);
      }
      return dataviewSearch(app, query);
    },
  );
}

async function simpleSearch(
  app: App,
  query: string,
  contextLength: number,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchFn = prepareSimpleSearch(query);
  const files = app.vault.getMarkdownFiles();
  const results: SearchResponseItem[] = [];

  for (const file of files) {
    const content = await app.vault.cachedRead(file);

    const filenamePrefix = file.basename + "\n\n";
    const positionOffset = filenamePrefix.length;
    const combined = filenamePrefix + content;

    const searchResult = searchFn(combined);
    if (!searchResult) continue;

    const matches: SearchContext[] = [];
    for (const match of searchResult.matches) {
      const [start, end] = match;

      if (start < positionOffset && end <= positionOffset) {
        // Filename match
        matches.push({
          match: {
            start,
            end: Math.min(end, file.basename.length),
            source: "filename",
          },
          context: file.basename,
        });
      } else if (start >= positionOffset) {
        // Content match — adjust positions
        const contentStart = start - positionOffset;
        const contentEnd = end - positionOffset;
        const ctxStart = Math.max(0, contentStart - contextLength);
        const ctxEnd = Math.min(content.length, contentEnd + contextLength);
        matches.push({
          match: {
            start: contentStart,
            end: contentEnd,
            source: "content",
          },
          context: content.slice(ctxStart, ctxEnd),
        });
      }
      // Boundary-spanning matches are intentionally skipped
    }

    if (matches.length > 0) {
      results.push({
        filename: file.path,
        score: searchResult.score,
        matches,
      });
    }
  }

  results.sort((a, b) => a.score - b.score);

  return {
    content: [
      { type: "text" as const, text: JSON.stringify(results, null, 2) },
    ],
  };
}

async function dataviewSearch(
  app: App,
  query: string,
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const dvPlugin = (
    app as App & { plugins: { getPlugin(id: string): unknown } }
  ).plugins.getPlugin("dataview") as DataviewPlugin | null;

  if (!dvPlugin?.api) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Dataview plugin is not installed or enabled",
        },
      ],
      isError: true,
    };
  }

  const dvApi = dvPlugin.api;
  const result = await dvApi.tryQuery(query);

  if (!result.successful) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Dataview query failed: ${JSON.stringify(result)}`,
        },
      ],
      isError: true,
    };
  }

  if (result.type !== "table") {
    return {
      content: [
        {
          type: "text" as const,
          text: "Only TABLE dataview queries are supported.",
        },
      ],
      isError: true,
    };
  }

  const idColumnName = dvApi.settings.tableIdColumnName;
  if (!result.headers.includes(idColumnName)) {
    return {
      content: [
        {
          type: "text" as const,
          text: "TABLE WITHOUT ID queries are not supported.",
        },
      ],
      isError: true,
    };
  }

  const idColumnIndex = result.headers.indexOf(idColumnName);
  const items = result.values.map((row) => {
    const fileLink = row[idColumnIndex] as { path: string };
    const resultObj: Record<string, unknown> = {};
    for (let i = 0; i < result.headers.length; i++) {
      if (i !== idColumnIndex) {
        resultObj[result.headers[i]!] = row[i];
      }
    }
    return { filename: fileLink.path, result: resultObj };
  });

  return {
    content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }],
  };
}
