/**
 * Bulk job management tools — expose the Data Service bulk-monitoring API
 * (the same endpoints that power the /bulk-requests page in the Easyparser
 * web app) so agents can inspect, track and debug bulk jobs the user
 * started from the app or the Bulk API.
 */
import { z } from "zod";
import { SUPPORTED_DOMAINS } from "../schemas/common.js";

export const DATA_SERVICE_BASE_URL = "https://data.easyparser.com/v1";
export const ACCOUNT_SERVICE_BASE_URL = "https://account.easyparser.com/v1";

export const BULK_OPERATIONS = [
  "DETAIL", "OFFER", "SEARCH", "PRODUCT_LOOKUP", "SALES_ANALYSIS_HISTORY",
  "BEST_SELLERS_RANK", "PACKAGE_DIMENSION", "SELLER_PROFILE",
  "SELLER_PRODUCTS", "SELLER_FEEDBACK",
] as const;

export const BULK_JOB_STATUSES = [
  "pending", "processing", "completed", "partial_success", "failed",
] as const;

export const BULK_ITEM_STATUSES = [
  "success", "invalid", "failed", "accepted", "pending", "processing",
] as const;

const paginationFields = {
  page: z.number().int().min(1).default(1).describe("Page number. Default 1."),
  limit: z
    .number().int().min(1).max(1000).default(100)
    .describe("Items per page (max 1000). Default 100."),
  sort_direction: z
    .enum(["asc", "desc"]).default("desc")
    .describe("Sort by creation time. 'desc' (newest first) is default."),
};

export const listBulkJobsSchema = z.object({
  status: z
    .enum(BULK_JOB_STATUSES).optional()
    .describe(
      "Filter by job status: pending, processing, completed, partial_success (some items failed), failed.",
    ),
  operation: z
    .enum(BULK_OPERATIONS).optional()
    .describe("Filter by operation type, e.g. DETAIL or SEARCH."),
  domain: z
    .enum(SUPPORTED_DOMAINS).optional()
    .describe("Filter by marketplace domain."),
  bulk_request_id: z
    .string().optional()
    .describe("Look up a specific job by its bulk_request_id (returned when the job was submitted)."),
  ...paginationFields,
});

export const getBulkJobItemsSchema = z.object({
  group_id: z
    .string()
    .describe(
      "The job's group_id — get it from list_bulk_jobs (each job row has one). Identifies which job's items to inspect.",
    ),
  status: z
    .enum(BULK_ITEM_STATUSES).optional()
    .describe(
      "Filter items by outcome. Use 'failed' or 'invalid' to debug a partial_success job; omit to see everything.",
    ),
  search_key: z
    .string().optional()
    .describe("Search within item values (e.g. a specific ASIN) to find one item in a large job."),
  date_from: z.string().optional().describe("ISO date lower bound, e.g. 2026-08-01."),
  date_to: z.string().optional().describe("ISO date upper bound."),
  ...paginationFields,
});

export const getBulkWebhookLogsSchema = z.object({
  group_id: z
    .string().optional()
    .describe("Scope logs to one job's group_id. Omit to see recent webhook deliveries across all jobs."),
  status: z
    .string().optional()
    .describe("Filter by delivery status (e.g. 'success', 'failed')."),
  bulk_request_id: z.string().optional().describe("Filter by the job's bulk_request_id."),
  request_id: z.string().optional().describe("Filter by an individual request ID."),
  date_from: z.string().optional().describe("ISO date lower bound."),
  date_to: z.string().optional().describe("ISO date upper bound."),
  ...paginationFields,
});

export const LIST_BULK_JOBS_DESCRIPTION = `List the user's bulk extraction jobs with their progress: operation, domain, status, total/completed/failed/invalid item counts, and timestamps. This reads the SAME data as the Bulk Requests page in the Easyparser web app — so it can see and track jobs the user started from the app UI, not just jobs submitted through this MCP server.

Use this tool when the user asks about their bulk jobs: "is my job done?", "what bulk jobs are running?", "did the DETAIL batch finish?". Each row includes a group_id — pass it to get_bulk_job_items to drill into individual items, or to get_bulk_webhook_logs to check webhook deliveries.

Statuses: pending (queued), processing (running), completed (all items succeeded), partial_success (some items failed or were dropped — check failed_items/invalid_items counts), failed. This tool is free of per-call credits (monitoring endpoints do not consume credits).`;

export const GET_BULK_JOB_ITEMS_DESCRIPTION = `Inspect the individual items inside a bulk job: each item's input value (ASIN, keyword, seller ID...), its status (success/failed/invalid/pending/processing), error message if it failed, credit cost, and completion time.

Use this tool to debug a job after list_bulk_jobs shows failed_items or invalid_items > 0 — filter with status='failed' or status='invalid' to see exactly which inputs failed and why. Use search_key to locate one specific ASIN inside a large job. The item's item_id can be used with the Data Service (GET /v1/queries/{id}) to fetch its parsed result.

This tool is free of per-call credits (monitoring endpoints do not consume credits).`;

export const getBulkItemResultSchema = z.object({
  item_id: z
    .string()
    .describe(
      "The item_id of a bulk job item — get it from get_bulk_job_items (each item row has one). This is the same ID the Data Service calls a query ID.",
    ),
});

export const GET_BULK_ITEM_RESULT_DESCRIPTION = `Fetch the parsed result data of a single bulk job item — the actual Amazon data that item produced (product detail, search results, seller profile, etc., depending on the job's operation). This is the same data shown in the item result modal on the Bulk Requests page of the web app.

Use this tool after get_bulk_job_items, when the user wants to see the DATA behind a specific item, not just its status. Typical flow: list_bulk_jobs → get_bulk_job_items → get_bulk_item_result.

IMPORTANT: bulk results are retained for 24 HOURS after the job completes, then they expire. If the item's data has expired, the tool returns a clear message — suggest re-running that item through the matching real-time tool (e.g. get_product_detail for a DETAIL item) to regenerate the data. This tool is free of per-call credits.`;

export const GET_BULK_WEBHOOK_LOGS_DESCRIPTION = `Check webhook delivery logs for bulk jobs: whether the completion notification was delivered to the user's callback_url, delivery status, and timestamps. Use this when a job shows as completed but the user's system never received the webhook — the classic "job finished but my integration didn't fire" debugging case.

Scope to one job with group_id (from list_bulk_jobs), or omit it to scan recent deliveries across all jobs. This tool is free of per-call credits.`;

export const getErrorLogsSchema = z.object({
  error_channel: z
    .enum(["BULK", "REALTIME"])
    .optional()
    .describe("Filter by channel: BULK (bulk job errors) or REALTIME (real-time API errors). Omit for both."),
  error_code: z
    .string().optional()
    .describe("Filter by a specific error code, e.g. 'WEBHOOK_ERROR_404' or 'SOMETHING_WENT_WRONG'."),
  operation: z
    .enum(BULK_OPERATIONS).optional()
    .describe("Filter by operation type, e.g. DETAIL or SEARCH."),
  domain: z
    .enum(SUPPORTED_DOMAINS).optional()
    .describe("Filter by marketplace domain."),
  platform: z.string().optional().describe("Filter by platform (e.g. 'AMZ')."),
  date_from: z.string().optional().describe("ISO date lower bound, e.g. 2026-08-01."),
  date_to: z.string().optional().describe("ISO date upper bound."),
  order_by: z
    .enum(["create_date", "error_channel", "error_code", "platform", "domain", "operation"])
    .default("create_date")
    .describe("Sort field. Default 'create_date'."),
  order_type: z
    .enum(["asc", "desc"]).default("desc")
    .describe("Sort direction. 'desc' (newest first) is default."),
  page: z.number().int().min(1).default(1).describe("Page number. Default 1."),
  limit: z
    .number().int().min(1).max(1000).default(100)
    .describe("Items per page (max 1000). Default 100."),
});

export const GET_ERROR_LOGS_DESCRIPTION = `List the user's API request error logs — the same data shown on the Errors page of the Easyparser web app. Covers both real-time API errors and bulk job errors: each row has the platform, operation, domain, error code, channel (BULK/REALTIME), the request parameters that caused it, and a timestamp.

Use this tool when the user asks about failures: "why are my requests failing?", "show me recent errors", "any webhook errors today?", "what went wrong with my DETAIL calls?". Filter by error_channel (BULK or REALTIME), error_code, operation, or domain to narrow down. Each row includes a request_id and the query_params that triggered the error, so you can trace exactly which input failed.

This tool is free of per-call credits (monitoring endpoints do not consume credits).`;

/** Shared fetch helper for Account Service endpoints (error-logs). Uses Api-Key header. */
export async function callAccountService(
  apiKey: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<unknown> {
  const url = new URL(`${ACCOUNT_SERVICE_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new Error(
      `Could not reach the Easyparser Account Service: ${err instanceof Error ? err.message : String(err)}. Retry once.`,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Easyparser API key is missing or invalid. Ask the user to create a free key at https://app.easyparser.com/signup and set EASYPARSER_API_KEY.",
    );
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !body) {
    throw new Error(
      `Account Service request failed (HTTP ${response.status}). Retry once; if it persists, tell the user.`,
    );
  }
  return body;
}

/** Shared fetch helper for Data Service monitoring endpoints. */
export async function callDataService(
  apiKey: string,
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<unknown> {
  const url = new URL(`${DATA_SERVICE_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new Error(
      `Could not reach the Easyparser Data Service: ${err instanceof Error ? err.message : String(err)}. Retry once.`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Easyparser API key is missing or invalid. Ask the user to create a free key at https://app.easyparser.com/signup and set EASYPARSER_API_KEY.",
    );
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !body) {
    throw new Error(
      `Data Service request failed (HTTP ${response.status}). Retry once; if it persists, tell the user.`,
    );
  }
  return body;
}

/** Fetch a bulk item's parsed result, with a friendly message for expired data. */
export async function callItemResult(apiKey: string, itemId: string): Promise<unknown> {
  const url = `${DATA_SERVICE_BASE_URL}/queries/${encodeURIComponent(itemId)}/results?format=json`;
  const response = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  }).catch((err) => {
    throw new Error(
      `Could not reach the Easyparser Data Service: ${err instanceof Error ? err.message : String(err)}. Retry once.`,
    );
  });

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Easyparser API key is missing or invalid. Ask the user to create a free key at https://app.easyparser.com/signup and set EASYPARSER_API_KEY.",
    );
  }

  // 3404 = result expired or not found (documented behavior of the Data Service)
  const errorCode = (body as Record<string, unknown> | null)?.error_code;
  if (errorCode === 3404 || (body && body.success === false)) {
    return {
      success: false,
      expired: true,
      message:
        "This item's parsed result has expired or is no longer stored. Bulk results are retained for 24 hours after job completion. To regenerate the data, re-run the item's input through the matching real-time tool (e.g. get_product_detail for a DETAIL item, search_products for a SEARCH item).",
    };
  }

  if (!response.ok || !body) {
    throw new Error(
      `Data Service request failed (HTTP ${response.status}). Retry once; if it persists, tell the user.`,
    );
  }
  return body;
}
