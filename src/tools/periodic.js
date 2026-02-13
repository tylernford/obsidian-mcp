import { z } from "zod";

const periodEnum = z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]);

export function registerPeriodicTools(server, client) {
  server.tool(
    "periodic_read",
    "Read a periodic note (daily, weekly, monthly, quarterly, yearly)",
    {
      period: periodEnum.describe("Which periodic note to read"),
      format: z
        .enum(["markdown", "json"])
        .default("json")
        .describe(
          "'json' returns parsed frontmatter, tags, and stats. 'markdown' returns raw content."
        ),
    },
    async ({ period, format }) => {
      const accept =
        format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";

      const result = await client.request("GET", `/periodic/${period}/`, {
        headers: { Accept: accept },
      });

      if (!result.ok) {
        return { content: [{ type: "text", text: result.error }], isError: true };
      }

      const text =
        typeof result.data === "string"
          ? result.data
          : JSON.stringify(result.data, null, 2);

      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "periodic_update",
    "Update a periodic note (creates from template if it doesn't exist)",
    {
      period: periodEnum.describe("Which periodic note to update"),
      operation: z
        .enum(["append", "prepend", "replace"])
        .describe("How to apply the update relative to the target"),
      targetType: z
        .enum(["heading", "block", "frontmatter"])
        .describe("Type of target to update"),
      target: z
        .string()
        .describe("Target identifier (same format as vault_update)"),
      content: z.string().describe("Content to insert or replace with"),
      createIfMissing: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, create the target if it doesn't exist"),
    },
    async ({ period, operation, targetType, target, content, createIfMissing }) => {
      const result = await client.patch(`/periodic/${period}/`, {
        operation,
        targetType,
        target,
        content,
        createIfMissing,
      });

      if (!result.ok) {
        // If PATCH fails (note doesn't exist), try creating it first
        if (result.status === 404) {
          const createResult = await client.request(
            "POST",
            `/periodic/${period}/`
          );

          if (!createResult.ok) {
            return {
              content: [{ type: "text", text: createResult.error }],
              isError: true,
            };
          }

          // Retry the patch after creation
          const retryResult = await client.patch(`/periodic/${period}/`, {
            operation,
            targetType,
            target,
            content,
            createIfMissing,
          });

          if (!retryResult.ok) {
            return {
              content: [{ type: "text", text: retryResult.error }],
              isError: true,
            };
          }
        } else {
          return { content: [{ type: "text", text: result.error }], isError: true };
        }
      }

      return {
        content: [{ type: "text", text: `Updated ${period} note` }],
      };
    }
  );
}
