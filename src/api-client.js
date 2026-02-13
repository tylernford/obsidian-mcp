export class ObsidianClient {
  constructor({ apiKey, host = "localhost", port = "27123" } = {}) {
    if (!apiKey) {
      throw new Error(
        "OBSIDIAN_API_KEY is required. Set it in your environment or MCP configuration."
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = `http://${host}:${port}`;
  }

  async request(method, path, { body, headers = {}, queryParams } = {}) {
    const url = new URL(path, this.baseUrl);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const requestHeaders = {
      Authorization: `Bearer ${this.apiKey}`,
      ...headers,
    };

    const options = { method, headers: requestHeaders };

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

    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (
        error.code === "ECONNREFUSED" ||
        error.cause?.code === "ECONNREFUSED"
      ) {
        return {
          ok: false,
          status: 0,
          error:
            "Could not connect to Obsidian. Make sure Obsidian is running and the Local REST API plugin is enabled.",
        };
      }
      return { ok: false, status: 0, error: `Connection error: ${error.message}` };
    }

    if (response.status === 204) {
      return { ok: true, status: 204, data: null };
    }

    const contentType = response.headers.get("content-type") || "";
    let data;
    if (contentType.includes("json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const message =
        data?.message || (typeof data === "string" ? data : JSON.stringify(data));
      return {
        ok: false,
        status: response.status,
        error: `Obsidian API error (${response.status}): ${message}`,
      };
    }

    return { ok: true, status: response.status, data };
  }

  encodePath(path) {
    return path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  async patch(
    path,
    { operation, targetType, target, content, createIfMissing }
  ) {
    const headers = {
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
