/**
 * Shared MCP server factory for Easyparser.
 * Used by both the stdio entrypoint (index.ts) and the HTTP entrypoint (http.ts).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callAccountApi } from "./account.js";
import { callEasyparser, EasyparserApiError } from "./client.js";
import {
  callAccountService,
  callDataService,
  callItemResult,
  GET_BULK_ITEM_RESULT_DESCRIPTION,
  GET_BULK_JOB_ITEMS_DESCRIPTION,
  GET_BULK_WEBHOOK_LOGS_DESCRIPTION,
  GET_ERROR_LOGS_DESCRIPTION,
  getBulkItemResultSchema,
  getBulkJobItemsSchema,
  getBulkWebhookLogsSchema,
  getErrorLogsSchema,
  LIST_BULK_JOBS_DESCRIPTION,
  listBulkJobsSchema,
} from "./tools/bulk.js";
import { registerPrompts, registerResources } from "./prompts.js";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import {
  buildOperationsCatalogResponse,
  CHECK_CREDITS_DESCRIPTION,
  checkCreditsSchema,
  LIST_OPERATIONS_DESCRIPTION,
  listOperationsSchema,
} from "./tools/helpers.js";

export const SERVER_INSTRUCTIONS = `Easyparser gives you real-time, structured Amazon data across 21 marketplaces: product details, seller offers, search results, sales history, seller identities, and logistics data.

Decision rules:
1. ASIN or product URL in hand → call the specific tool directly, never search first.
2. Only a barcode (UPC/EAN/GTIN/ISBN) → lookup_product to get the ASIN, then the specific tool.
3. Only a product name or category → search_products to find ASINs, then drill down.
4. Cost awareness: most tools cost 1 credit. get_sales_history costs 5+ credits — confirm the history depth with the user before calling. Paginated tools cost 1 credit per page — prefer filters over extra pages.
5. Every response includes credits_remaining. If it drops low or a call returns a rate-limit error, tell the user to get a free key at https://app.easyparser.com/signup.
6. If unsure which tool fits, call list_operations — it is free and works without a key.
7. Bulk jobs: use list_bulk_jobs to see the user's bulk extraction jobs (including ones started from the Easyparser web app), get_bulk_job_items to debug failed items inside a job, get_bulk_item_result to fetch an item's parsed data (results expire — regenerate via the matching real-time tool if expired), and get_bulk_webhook_logs when a completed job's webhook never arrived. These monitoring tools are free.`;

export interface ServerContext {
  /** Resolves the API key for the current request/session. */
  getApiKey: () => string | undefined;
}

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

/** Text plus structured copy, for tools that declare an outputSchema. */
function structuredResult(payload: object) {
  return {
    ...textResult(payload),
    structuredContent: payload as Record<string, unknown>,
  };
}

/** Envelope returned by every Real-Time API data tool (see EasyparserEnvelope). */
const dataEnvelopeOutputSchema = {
  success: z.boolean().describe("True when the request completed."),
  operation: z.string().describe("Easyparser operation that ran, e.g. DETAIL or OFFER."),
  data: z.unknown().describe("Parsed Amazon data for the operation."),
  credits_used: z.number().optional().describe("Credits charged for this request."),
  credits_remaining: z.number().optional().describe("Credits left on the account after this request."),
  request_id: z.string().optional().describe("Easyparser request ID, useful for support and error logs."),
};

/** Data Service / Account responses: pass the JSON object through as-is. */
const passthroughOutputSchema = z
  .object({})
  .passthrough()
  .describe("JSON response from the Easyparser Data Service or Account API. Non-object payloads are wrapped as { result }.");

function passthroughResult(payload: unknown) {
  const structured =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : { result: payload };
  return { ...textResult(payload), structuredContent: structured as Record<string, unknown> };
}

const operationsCatalogOutputSchema = {
  server: z.string(),
  operations: z.array(
    z.object({
      operation: z.string(),
      tool: z.string(),
      cost: z.string(),
      input: z.string(),
      use_case: z.string(),
    }),
  ),
  supported_domains: z.array(z.string()),
  signup: z.string(),
  note: z.string(),
};

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function requireApiKey(ctx: ServerContext): string {
  const key = ctx.getApiKey();
  if (!key) {
    throw new EasyparserApiError(
      "No Easyparser API key configured on this server. Tell the user: create a free key at https://app.easyparser.com/signup and set EASYPARSER_API_KEY in the MCP server config. The list_operations tool works without a key.",
    );
  }
  return key;
}

/** Validate identifier mutex rules that zod cannot express cleanly. */
function validateMutex(
  input: Record<string, unknown>,
  a: string,
  b: string,
): string | null {
  const hasA = input[a] !== undefined && input[a] !== "";
  const hasB = input[b] !== undefined && input[b] !== "";
  if (hasA && hasB) return `Provide either "${a}" or "${b}", not both.`;
  if (!hasA && !hasB) return `One of "${a}" or "${b}" is required.`;
  return null;
}

export function createEasyparserServer(ctx: ServerContext): McpServer {
  const server = new McpServer(
    {
      name: "easyparser-mcp",
      version: "1.4.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  for (const def of TOOL_DEFINITIONS) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.schema,
        outputSchema: dataEnvelopeOutputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: true,
        },
      },
      async (input) => {
        try {
          // Mutex validation for identifier pairs
          if (def.name === "get_product_detail") {
            const err = validateMutex(input as Record<string, unknown>, "asin", "url");
            if (err) return errorResult(`Invalid input: ${err} Example: get_product_detail({ asin: "B0CJB6V2L5", domain: ".com" })`);
          }
          if (def.name === "search_products") {
            const err = validateMutex(input as Record<string, unknown>, "keyword", "url");
            if (err) return errorResult(`Invalid input: ${err} Example: search_products({ keyword: "winter jacket", domain: ".com" })`);
          }
          if (def.name === "get_seller_profile" || def.name === "get_seller_products") {
            const err = validateMutex(input as Record<string, unknown>, "seller_id", "url");
            if (err) return errorResult(`Invalid input: ${err} Example: ${def.name}({ seller_id: "A1MCYUGJD2ILFU", domain: ".com" })`);
          }

          const apiKey = requireApiKey(ctx);
          const params = def.toApiParams(input as Record<string, unknown>);
          const result = await callEasyparser(apiKey, params);
          return structuredResult(result);
        } catch (err) {
          if (err instanceof EasyparserApiError) {
            return errorResult(err.message);
          }
          return errorResult(
            `Unexpected error in ${def.name}: ${err instanceof Error ? err.message : String(err)}. Retry once; if it persists, report to the user.`,
          );
        }
      },
    );
  }

  // Helper: list_operations (no API key required)
  server.registerTool(
    "list_operations",
    {
      description: LIST_OPERATIONS_DESCRIPTION,
      inputSchema: listOperationsSchema,
      outputSchema: operationsCatalogOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) => {
      return structuredResult(buildOperationsCatalogResponse(input.operation));
    },
  );

  // Bulk job monitoring: list_bulk_jobs
  server.registerTool(
    "list_bulk_jobs",
    {
      description: LIST_BULK_JOBS_DESCRIPTION,
      inputSchema: listBulkJobsSchema,
      outputSchema: passthroughOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const apiKey = requireApiKey(ctx);
        const body = await callDataService(apiKey, "/bulk/bulk-requests", {
          page: input.page,
          limit: input.limit,
          sort_direction: input.sort_direction,
          status: input.status,
          operation: input.operation,
          domain: input.domain,
          bulk_request_id: input.bulk_request_id,
        });
        return passthroughResult(body);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Bulk job monitoring: get_bulk_job_items
  server.registerTool(
    "get_bulk_job_items",
    {
      description: GET_BULK_JOB_ITEMS_DESCRIPTION,
      inputSchema: getBulkJobItemsSchema,
      outputSchema: passthroughOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const apiKey = requireApiKey(ctx);
        const body = await callDataService(
          apiKey,
          `/bulk/bulk-requests/${input.group_id}/items`,
          {
            page: input.page,
            limit: input.limit,
            sort_direction: input.sort_direction,
            status: input.status,
            search_key: input.search_key,
            date_from: input.date_from,
            date_to: input.date_to,
          },
        );
        return passthroughResult(body);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Bulk job monitoring: get_bulk_item_result
  server.registerTool(
    "get_bulk_item_result",
    {
      description: GET_BULK_ITEM_RESULT_DESCRIPTION,
      inputSchema: getBulkItemResultSchema,
      outputSchema: passthroughOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const apiKey = requireApiKey(ctx);
        const body = await callItemResult(apiKey, input.item_id);
        return passthroughResult(body);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Bulk job monitoring: get_bulk_webhook_logs
  server.registerTool(
    "get_bulk_webhook_logs",
    {
      description: GET_BULK_WEBHOOK_LOGS_DESCRIPTION,
      inputSchema: getBulkWebhookLogsSchema,
      outputSchema: passthroughOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const apiKey = requireApiKey(ctx);
        const body = await callDataService(apiKey, "/bulk/webhook-logs", {
          page: input.page,
          limit: input.limit,
          sort_direction: input.sort_direction,
          group_id: input.group_id,
          status: input.status,
          bulk_request_id: input.bulk_request_id,
          request_id: input.request_id,
          date_from: input.date_from,
          date_to: input.date_to,
        });
        return passthroughResult(body);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Error logs: get_error_logs (API key required)
  server.registerTool(
    "get_error_logs",
    {
      description: GET_ERROR_LOGS_DESCRIPTION,
      inputSchema: getErrorLogsSchema,
      outputSchema: passthroughOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async (input) => {
      try {
        const apiKey = requireApiKey(ctx);
        const body = await callAccountService(apiKey, "/error-logs", {
          page: input.page,
          limit: input.limit,
          error_channel: input.error_channel,
          error_code: input.error_code,
          operation: input.operation,
          domain: input.domain,
          platform: input.platform,
          date_from: input.date_from,
          date_to: input.date_to,
          order_by: input.order_by,
          order_type: input.order_type,
        });
        return passthroughResult(body);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // Helper: check_credits (API key required)
  server.registerTool(
    "check_credits",
    {
      description: CHECK_CREDITS_DESCRIPTION,
      inputSchema: checkCreditsSchema,
      outputSchema: passthroughOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      try {
        const apiKey = requireApiKey(ctx);
        // Account API: free of per-call credits, returns plan + balance + usage.
        const info = await callAccountApi(apiKey);
        return structuredResult({
          ...info,
          note: "This check is free (Account API consumes no credits). Plan management: https://app.easyparser.com/account/plan",
        });
      } catch (err) {
        if (err instanceof EasyparserApiError) return errorResult(err.message);
        return errorResult(
          `Unexpected error in check_credits: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );

  registerPrompts(server);
  registerResources(server, SERVER_INSTRUCTIONS);

  return server;
}
