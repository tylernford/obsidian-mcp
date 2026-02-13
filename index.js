import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ObsidianClient } from "./src/api-client.js";
import { registerVaultTools } from "./src/tools/vault.js";
import { registerSearchTools } from "./src/tools/search.js";
import { registerMetadataTools } from "./src/tools/metadata.js";

const client = new ObsidianClient({
  apiKey: process.env.OBSIDIAN_API_KEY,
  host: process.env.OBSIDIAN_API_HOST,
  port: process.env.OBSIDIAN_API_PORT,
});

const server = new McpServer({ name: "obsidian", version: "1.0.0" });
registerVaultTools(server, client);
registerSearchTools(server, client);
registerMetadataTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
