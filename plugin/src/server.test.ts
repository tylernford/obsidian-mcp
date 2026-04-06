import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServer } from "./server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_KEY = "test-key-1234";

function makeServer(overrides: Record<string, unknown> = {}): HttpServer {
  return new HttpServer({
    port: 0, // random available port
    host: "127.0.0.1",
    apiKey: API_KEY,
    createMcpServer: () => new McpServer({ name: "test", version: "0.0.0" }),
    ...overrides,
  });
}

/** Resolve the base URL after the server is listening. */
function baseUrl(server: HttpServer): string {
  // Access the private http.Server to read the OS-assigned port.
  // HttpServer doesn't expose the port publicly, so we reach in via `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const addr = (server as any).server.address();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return `http://127.0.0.1:${String(addr.port)}`;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HttpServer", () => {
  let server: HttpServer;

  afterEach(async () => {
    await server?.stop();
  });

  // ---- Authentication ----------------------------------------------------

  describe("authentication", () => {
    beforeEach(async () => {
      server = makeServer();
      await server.start();
    });

    it("rejects requests with no Authorization header", async () => {
      const res = await fetch(`${baseUrl(server)}/mcp`, { method: "POST" });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("rejects requests with wrong token", async () => {
      const res = await fetch(`${baseUrl(server)}/mcp`, {
        method: "POST",
        headers: { Authorization: "Bearer wrong-token" },
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });

    it("accepts requests with valid Bearer token", async () => {
      const res = await fetch(`${baseUrl(server)}/mcp`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
      });
      expect(res.status).toBeLessThan(400);
    });
  });

  // ---- Routing -----------------------------------------------------------

  describe("routing", () => {
    beforeEach(async () => {
      server = makeServer();
      await server.start();
    });

    it("returns JSON-RPC error for GET /mcp", async () => {
      const res = await fetch(`${baseUrl(server)}/mcp`, {
        method: "GET",
        headers: authHeaders(),
      });
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    it("returns generic error for other methods on /mcp", async () => {
      const res = await fetch(`${baseUrl(server)}/mcp`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "Method Not Allowed" });
    });

    it("returns 404 for unknown paths", async () => {
      const res = await fetch(`${baseUrl(server)}/unknown`, {
        method: "POST",
        headers: authHeaders(),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Not Found" });
    });
  });

  // ---- Request handling --------------------------------------------------

  describe("request handling", () => {
    beforeEach(async () => {
      server = makeServer();
      await server.start();
    });

    it("returns 400 for malformed JSON", async () => {
      const res = await fetch(`${baseUrl(server)}/mcp`, {
        method: "POST",
        headers: authHeaders(),
        body: "not-json{{{",
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid request body" });
    });
  });

  // ---- MCP integration ---------------------------------------------------

  describe("MCP integration", () => {
    it("processes a valid MCP request through the transport", async () => {
      const createMcpServer = vi.fn(
        () => new McpServer({ name: "test", version: "0.0.0" }),
      );
      server = makeServer({ createMcpServer });
      await server.start();

      const res = await fetch(`${baseUrl(server)}/mcp`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" },
          },
        }),
      });

      expect(createMcpServer).toHaveBeenCalledOnce();
      expect(res.status).toBe(200);

      // Response is SSE — extract JSON from the "data:" lines
      const text = await res.text();
      const dataLine = text
        .split("\n")
        .find((line) => line.startsWith("data: "));
      expect(dataLine).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const body = JSON.parse(dataLine!.slice("data: ".length));
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(body.result?.serverInfo?.name).toBe("test");
    });
  });

  // ---- Lifecycle ---------------------------------------------------------

  describe("lifecycle", () => {
    it("starts, accepts requests, and stops cleanly", async () => {
      server = makeServer();
      await server.start();

      // Server should accept a request
      const res = await fetch(`${baseUrl(server)}/mcp`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
      });
      expect(res.status).toBeLessThan(400);

      // Stop should resolve without error
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it("stop() resolves when server is null", async () => {
      server = makeServer();
      // Never started — server is null
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });
});
