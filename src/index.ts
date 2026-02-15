import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ObsidianClient } from "./api-client.js";
import { registerVaultTools } from "./tools/vault.js";
import { registerSearchTools } from "./tools/search.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerCommandTools } from "./tools/commands.js";
import { registerActiveFileTools } from "./tools/active-file.js";
import { registerNavigationTools } from "./tools/navigation.js";
import { registerPeriodicTools } from "./tools/periodic.js";

const client = new ObsidianClient({
  apiKey: process.env.OBSIDIAN_API_KEY,
  host: process.env.OBSIDIAN_API_HOST,
  port: process.env.OBSIDIAN_API_PORT,
});

const server = new McpServer({ name: "obsidian", version: "1.0.0" });
registerVaultTools(server, client);
registerSearchTools(server, client);
registerMetadataTools(server, client);
registerCommandTools(server, client);
registerActiveFileTools(server, client);
registerNavigationTools(server, client);
registerPeriodicTools(server, client);

const transport = new StdioServerTransport();
try {
  await server.connect(transport);
} catch (error) {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
}
