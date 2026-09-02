/**
 * Bulk job management tools — expose the Data Service bulk-monitoring API
 * (the same endpoints that power the /bulk-requests page in the Easyparser
 * web app) so agents can inspect, track and debug bulk jobs the user
 * started from the app or the Bulk API.
 */
import { z } from "zod";
import { SUPPORTED_DOMAINS } from "../schemas/common.js";

export const DATA_SERVICE_BASE_URL = "https://data.easyparser.com/v1";

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
    .number().int().min(1).max(50).default(25)
    .describe("Items per page (max 50). Default 25 — keep it small to save context."),
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

export const GET_BULK_WEBHOOK_LOGS_DESCRIPTION = `Check webhook delivery logs for bulk jobs: whether the completion notification was delivered to the user's callback_url, delivery status, and timestamps. Use this when a job shows as completed but the user's system never received the webhook — the classic "job finished but my integration didn't fire" debugging case.

Scope to one job with group_id (from list_bulk_jobs), or omit it to scan recent deliveries across all jobs. This tool is free of per-call credits.`;

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
