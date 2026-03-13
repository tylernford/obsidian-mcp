import { handleConnectionError, handleHttpError } from "./errors.js";

interface ObsidianClientConfig {
  apiKey: string | undefined;
  host?: string;
  port?: string;
}

interface RequestOptions {
  body?: string | Record<string, unknown>;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean | undefined | null>;
}

interface PatchOptions {
  operation: string;
  targetType: string;
  target: string;
  content: string;
  createIfMissing?: boolean;
}

type ApiResponse<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

export class ObsidianClient {
  private apiKey: string;
  private baseUrl: string;

  constructor({
    apiKey,
    host = "localhost",
    port = "27123",
  }: ObsidianClientConfig) {
    if (!apiKey) {
      throw new Error(
        "OBSIDIAN_API_KEY is required. Set it in your environment or MCP configuration.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = `http://${host}:${port}`;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    { body, headers = {}, queryParams }: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const url = new URL(path, this.baseUrl);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      ...headers,
    };

    const options: RequestInit = { method, headers: requestHeaders };

    if (body !== undefined) {
      if (typeof body === "string") {
        options.body = body;
      } else {
        options.body = JSON.stringify(body);
        if (!requestHeaders["Content-Type"]) {
          requestHeaders["Content-Type"] = "application/json";
        }
      }
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      return handleConnectionError(
        error as NodeJS.ErrnoException,
        this.baseUrl,
        url,
      );
    }

    const contentLength = response.headers.get("content-length");
    if (response.status === 204 || (contentLength === "0" && response.ok)) {
      return { ok: true, status: response.status, data: null as T };
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    let data: unknown;
    if (!text) {
      data = null;
    } else if (contentType.includes("json")) {
      try {
        data = JSON.parse(text);
      } catch {
        return {
          ok: false,
          status: response.status,
          error: `Malformed JSON response from Obsidian API: ${text.slice(0, 200)}`,
        };
      }
    } else {
      data = text;
    }

    if (!response.ok) {
      return handleHttpError(response.status, data, path);
    }

    return { ok: true, status: response.status, data: data as T };
  }

  encodePath(path: string): string {
    return path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  async patch<T = unknown>(
    path: string,
    { operation, targetType, target, content, createIfMissing }: PatchOptions,
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "text/markdown",
      Operation: operation,
      "Target-Type": targetType,
      Target: encodeURIComponent(target),
    };

    if (createIfMissing) {
      headers["Create-Target-If-Missing"] = "true";
    }

    return this.request("PATCH", path, { body: content, headers });
  }
}
