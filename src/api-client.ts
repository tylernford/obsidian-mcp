interface ObsidianClientConfig {
  apiKey: string;
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

type ApiResponse =
  | { ok: true; status: number; data: unknown }
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

  async request(
    method: string,
    path: string,
    { body, headers = {}, queryParams }: RequestOptions = {},
  ): Promise<ApiResponse> {
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
      const err = error as NodeJS.ErrnoException;
      const cause = err.cause as NodeJS.ErrnoException | undefined;
      if (err.code === "ECONNREFUSED" || cause?.code === "ECONNREFUSED") {
        return {
          ok: false,
          status: 0,
          error:
            "Could not connect to Obsidian. Make sure Obsidian is running and the Local REST API plugin is enabled.",
        };
      }
      return {
        ok: false,
        status: 0,
        error: `Connection error: ${err.message}`,
      };
    }

    const contentLength = response.headers.get("content-length");
    if (response.status === 204 || contentLength === "0") {
      return { ok: true, status: response.status, data: null };
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    let data: unknown;
    if (!text) {
      data = null;
    } else if (contentType.includes("json")) {
      data = JSON.parse(text);
    } else {
      data = text;
    }

    if (!response.ok) {
      const dataObj = data as Record<string, unknown> | null;
      const message =
        (dataObj && typeof dataObj === "object" && "message" in dataObj
          ? dataObj.message
          : null) || (typeof data === "string" ? data : JSON.stringify(data));
      return {
        ok: false,
        status: response.status,
        error: `Obsidian API error (${response.status}): ${message}`,
      };
    }

    return { ok: true, status: response.status, data };
  }

  encodePath(path: string): string {
    return path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  async patch(
    path: string,
    { operation, targetType, target, content, createIfMissing }: PatchOptions,
  ): Promise<ApiResponse> {
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
