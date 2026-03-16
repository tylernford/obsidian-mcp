import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

export interface HttpServerConfig {
  port: number;
  host: string;
  apiKey: string;
  createMcpServer: () => McpServer;
}

export class HttpServer {
  private server: Server | null = null;
  private transports = new Map<string, StreamableHTTPServerTransport>();
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
    const closePromises = Array.from(this.transports.values()).map((t) =>
      t.close(),
    );
    await Promise.all(closePromises);
    this.transports.clear();

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
    if (method !== "POST" && method !== "GET" && method !== "DELETE") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      return;
    }

    if (method === "POST") {
      this.handlePost(req, res);
    } else {
      this.handleGetOrDelete(req, res);
    }
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
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString());
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (sessionId && this.transports.has(sessionId)) {
          const transport = this.transports.get(sessionId)!;
          void transport.handleRequest(req, res, body);
          return;
        }

        if (!sessionId && isInitializeRequest(body)) {
          void this.createSession(req, res, body);
          return;
        }

        if (sessionId && !this.transports.has(sessionId)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid or expired session ID" }));
          return;
        }

        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing session ID" }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request body" }));
      }
    });
  }

  private handleGetOrDelete(req: IncomingMessage, res: ServerResponse): void {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !this.transports.has(sessionId)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or missing session ID" }));
      return;
    }

    const transport = this.transports.get(sessionId)!;
    void transport.handleRequest(req, res);
  }

  private async createSession(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
  ): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        this.transports.set(sessionId, transport);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) this.transports.delete(sid);
    };

    const mcpServer = this.config.createMcpServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, body);
  }
}
