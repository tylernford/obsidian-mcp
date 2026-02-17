export function handleConnectionError(
  err: NodeJS.ErrnoException,
  baseUrl: string,
  url: URL,
): { ok: false; status: number; error: string } {
  const cause = err.cause as NodeJS.ErrnoException | undefined;
  const code = err.code || cause?.code;

  switch (code) {
    case "ECONNREFUSED":
      return {
        ok: false,
        status: 0,
        error: `Could not connect to Obsidian at ${baseUrl}. Make sure Obsidian is running and the Local REST API plugin is enabled.`,
      };
    case "EACCES":
      return {
        ok: false,
        status: 0,
        error: `Permission denied when connecting to Obsidian at ${baseUrl}. Check that the configured port is accessible.`,
      };
    case "ETIMEDOUT":
      return {
        ok: false,
        status: 0,
        error: `Connection to Obsidian at ${baseUrl} timed out. Check that the host and port settings are correct and that Obsidian is responsive.`,
      };
    case "ECONNRESET":
      return {
        ok: false,
        status: 0,
        error: `Connection to Obsidian at ${baseUrl} was reset. This usually means Obsidian restarted mid-request — try again.`,
      };
    case "ENOTFOUND":
      return {
        ok: false,
        status: 0,
        error: `Could not resolve host '${url.hostname}'. Check the OBSIDIAN_API_HOST setting.`,
      };
    default:
      return {
        ok: false,
        status: 0,
        error: `Could not connect to Obsidian at ${baseUrl}: ${err.message}`,
      };
  }
}

export function handleHttpError(
  status: number,
  data: unknown,
  path: string,
): { ok: false; status: number; error: string } {
  const dataObj = data as Record<string, unknown> | null;
  const message =
    (dataObj && typeof dataObj === "object" && "message" in dataObj
      ? dataObj.message
      : null) || (typeof data === "string" ? data : JSON.stringify(data));

  if (status === 401) {
    return {
      ok: false,
      status: 401,
      error: `Authentication failed. Check that OBSIDIAN_API_KEY matches the key in Obsidian's Local REST API plugin settings. (HTTP 401: ${message})`,
    };
  }

  if (status === 403) {
    return {
      ok: false,
      status: 403,
      error: `Request forbidden by Obsidian. Check the Local REST API plugin's access settings. (HTTP 403: ${message})`,
    };
  }

  if (status === 404) {
    return {
      ok: false,
      status: 404,
      error: `Not found: ${path}. Check that the file or path exists in your vault. (HTTP 404: ${message})`,
    };
  }

  if (status >= 500) {
    return {
      ok: false,
      status,
      error: `Obsidian REST API plugin returned an internal error. This is usually a plugin-side issue — try restarting Obsidian. (HTTP ${status}: ${message})`,
    };
  }

  return {
    ok: false,
    status,
    error: `Obsidian API error (HTTP ${status}: ${message})`,
  };
}
