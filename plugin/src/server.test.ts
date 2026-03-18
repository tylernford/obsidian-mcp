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

  describe("stateless POST", () => {
    it("returns successful MCP response with no mcp-session-id header", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      const text = await res.text();
      expect(res.ok).toBe(true);
      expect(res.headers.get("mcp-session-id")).toBeNull();

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
      expect(mcpResponse.result.serverInfo.name).toBe("test-server");
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

    it("handles two sequential POSTs independently", async () => {
      const res1 = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      const text1 = await res1.text();
      expect(res1.ok).toBe(true);

      const res2 = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      const text2 = await res2.text();
      expect(res2.ok).toBe(true);

      // Both should succeed independently — no shared state
      const parse = (text: string) => {
        const line = text
          .split("\n")
          .find((l) => l.startsWith("data: "))!
          .slice(6);
        return JSON.parse(line) as {
          result: { serverInfo: { name: string } };
        };
      };
      expect(parse(text1).result.serverInfo.name).toBe("test-server");
      expect(parse(text2).result.serverInfo.name).toBe("test-server");
    });
  });

  describe("GET and DELETE", () => {
    it("returns 405 with JSON-RPC error for GET to /mcp", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "GET",
        headers: authHeaders(),
      });
      expect(res.status).toBe(405);
      const body = (await res.json()) as {
        jsonrpc: string;
        error: { code: number; message: string };
        id: null;
      };
      expect(body).toEqual({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    it("returns 405 with JSON-RPC error for DELETE to /mcp", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      expect(res.status).toBe(405);
      const body = (await res.json()) as {
        jsonrpc: string;
        error: { code: number; message: string };
        id: null;
      };
      expect(body).toEqual({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });
  });

  describe("lifecycle", () => {
    it("starts and stops cleanly", async () => {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      await res.text();
      expect(res.ok).toBe(true);

      // Stop and verify port is released by starting again
      await httpServer.stop();
      await httpServer.start();

      const res2 = await fetch(`${BASE_URL}/mcp`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: initializeBody(),
      });
      await res2.text();
      expect(res2.ok).toBe(true);
    });
  });
});
