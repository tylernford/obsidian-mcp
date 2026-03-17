import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServer } from "./server";

const TEST_PORT = 48372;
const TEST_HOST = "127.0.0.1";
const TEST_API_KEY = "test-api-key-abc123";
const BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;

function createMcpServer(): McpServer {
  return new McpServer({ name: "test-server", version: "0.0.1" });
}

function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    Authorization: `Bearer ${TEST_API_KEY}`,
    Accept: "application/json, text/event-stream",
    Connection: "close",
    ...extra,
  };
}

function initializeBody() {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" },
    },
  });
}

async function initializeSession(): Promise<string> {
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: initializeBody(),
  });
  // Consume the SSE response body to release the connection
  await res.text();
  const sessionId = res.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("No session ID returned from initialize");
  return sessionId;
}

describe("HttpServer", () => {
  let httpServer: HttpServer;

  beforeEach(async () => {
    httpServer = new HttpServer({
      port: TEST_PORT,
      host: TEST_HOST,
      apiKey: TEST_API_KEY,
      createMcpServer,
    });
    await httpServer.start();
  });

  afterEach(async () => {
    await httpServer.stop();
  });

  describe("authentication", () => {
    it("rejects requests with no Authorization header", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, { method: "POST" });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects requests with wrong Bearer token", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: { Authorization: "Bearer wrong-key" },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("rejects requests with non-Bearer auth scheme", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: { Authorization: `Basic ${TEST_API_KEY}` },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("routing", () => {
    it("returns 404 for unknown routes", async () => {
      const res = await fetch(`${BASE_URL}/unknown`, {
        method: "GET",
        headers: authHeaders(),
      });
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Not Found");
    });

    it("returns 405 for unsupported methods on /mcp", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "PUT",
        headers: authHeaders(),
      });
      expect(res.status).toBe(405);
    });
  });

  describe("session management", () => {
    it("creates a session on initialize request with valid MCP response", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      const text = await res.text();
      expect(res.ok).toBe(true);
      expect(res.headers.get("mcp-session-id")).toBeTruthy();

      // Verify the response contains a valid MCP initialize result
      // SSE format: lines prefixed with "data: "
      const dataLines = text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice(6));
      expect(dataLines.length).toBeGreaterThan(0);
      const mcpResponse = JSON.parse(dataLines[0]!) as {
        result: { protocolVersion: string; serverInfo: { name: string } };
      };
      expect(mcpResponse.result).toBeDefined();
      expect(mcpResponse.result.protocolVersion).toBeDefined();
      expect(mcpResponse.result.serverInfo).toBeDefined();
      expect(mcpResponse.result.serverInfo.name).toBe("test-server");
    });

    it("reuses existing session on subsequent requests", async () => {
      const sessionId = await initializeSession();

      // Send initialized notification to complete handshake
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
          "mcp-session-id": sessionId,
        }),
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      });
      await res.text();
      expect(res.ok).toBe(true);
      // No new session ID should be issued — the existing one is reused
      expect(res.headers.get("mcp-session-id")).toBeNull();
    });

    it("returns 400 for non-initialize POST without session ID", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for invalid session ID on POST", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
          "mcp-session-id": "nonexistent-session",
        }),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for GET with invalid session ID", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "GET",
        headers: authHeaders({ "mcp-session-id": "nonexistent-session" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for DELETE with invalid session ID", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "DELETE",
        headers: authHeaders({ "mcp-session-id": "nonexistent-session" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for GET without session ID", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "GET",
        headers: authHeaders(),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for DELETE without session ID", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      expect(res.status).toBe(400);
    });

    it("handles GET with valid session ID", async () => {
      const sessionId = await initializeSession();

      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "GET",
        headers: authHeaders({ "mcp-session-id": sessionId }),
      });
      // GET on a valid session opens an SSE stream (200) — the transport handles it
      expect(res.ok).toBe(true);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    });

    it("handles DELETE with valid session ID", async () => {
      const sessionId = await initializeSession();

      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "DELETE",
        headers: authHeaders({ "mcp-session-id": sessionId }),
      });
      await res.text();
      expect(res.ok).toBe(true);

      // Session should be invalidated after DELETE
      const res2 = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
          "mcp-session-id": sessionId,
        }),
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      });
      expect(res2.status).toBe(404);
    });

    it("returns 400 for invalid JSON body", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: "not valid json{{{",
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Invalid request body");
    });
  });

  describe("lifecycle", () => {
    it("starts and stops cleanly", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      expect(res.ok).toBe(true);

      // Stop and verify port is released by starting again
      await httpServer.stop();
      await httpServer.start();

      const res2 = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      expect(res2.ok).toBe(true);
    });

    it("cleans up sessions on stop", async () => {
      const sessionId = await initializeSession();
      await httpServer.stop();
      await httpServer.start();

      // Old session ID should no longer be valid after restart
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
          "mcp-session-id": sessionId,
        }),
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      });
      expect(res.status).toBe(404);
    });
  });
});
