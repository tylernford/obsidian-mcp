import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface HttpServerConfig {
  port: number;
  host: string;
  apiKey: string;
  createMcpServer: () => McpServer;
}

const METHOD_NOT_ALLOWED_RESPONSE = JSON.stringify({
  jsonrpc: "2.0",
  error: { code: -32000, message: "Method not allowed." },
  id: null,
});

export class HttpServer {
  private server: Server | null = null;
  private connections = new Set<import("net").Socket>();
  private config: HttpServerConfig;

  constructor(config: HttpServerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => this.handleRequest(req, res));
    this.server.on("connection", (socket) => {
      this.connections.add(socket);
      socket.on("close", () => this.connections.delete(socket));
    });
    return new Promise((resolve, reject) => {
      this.server!.on("error", reject);
      this.server!.listen(this.config.port, this.config.host, () => {
        this.server!.removeListener("error", reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close((err) => {
        this.server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (!this.authenticate(req, res)) return;

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    const method = req.method?.toUpperCase();
    if (method === "POST") {
      this.handlePost(req, res);
      return;
    }

    if (method === "GET" || method === "DELETE") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(METHOD_NOT_ALLOWED_RESPONSE);
      return;
    }

    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
  }

  private authenticate(req: IncomingMessage, res: ServerResponse): boolean {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${this.config.apiKey}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return false;
    }
    return true;
  }

  private handlePost(req: IncomingMessage, res: ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      void (async () => {
        try {
          const body: unknown = JSON.parse(Buffer.concat(chunks).toString());
          const mcpServer = this.config.createMcpServer();
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, body);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid request body" }));
        } finally {
          await transport.close();
        }
      })();
    });
  }
}
