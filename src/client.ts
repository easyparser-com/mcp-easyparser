/**
 * Easyparser Real-Time API client.
 * Thin wrapper around GET https://realtime.easyparser.com/v1/request
 * with agent-friendly error mapping.
 */

export const REALTIME_BASE_URL = "https://realtime.easyparser.com/v1/request";
export const SIGNUP_URL = "https://app.easyparser.com/signup";
export const PLAN_URL = "https://app.easyparser.com/account/plan";

export interface EasyparserRequestParams {
  operation: string;
  domain: string;
  [key: string]: string | number | boolean | undefined;
}

export interface EasyparserEnvelope {
  success: boolean;
  operation: string;
  data: unknown;
  credits_used?: number;
  credits_remaining?: number;
  request_id?: string;
}

export class EasyparserApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "EasyparserApiError";
  }
}

/**
 * Call the Easyparser Real-Time API.
 * Maps HTTP/API errors to agent-actionable messages (signup funnel on 401/429).
 */
export async function callEasyparser(
  apiKey: string,
  params: EasyparserRequestParams,
): Promise<EasyparserEnvelope> {
  const url = new URL(REALTIME_BASE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("platform", "AMZ");
  url.searchParams.set("output", "json");

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    throw new EasyparserApiError(
      `Could not reach the Easyparser API: ${err instanceof Error ? err.message : String(err)}. This is a network-level issue — retry the call, and if it persists tell the user to check https://easyparser.com status.`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new EasyparserApiError(
      `Easyparser API key is missing or invalid. Ask the user to create a free key at ${SIGNUP_URL} and set it in the MCP server config (EASYPARSER_API_KEY).`,
      response.status,
    );
  }

  if (response.status === 402) {
    throw new EasyparserApiError(
      `The Easyparser account has run out of credits. Tell the user to top up or upgrade at ${PLAN_URL}.`,
      response.status,
    );
  }

  if (response.status === 429) {
    throw new EasyparserApiError(
      `Easyparser rate limit reached. Tell the user: get your own free API key at ${SIGNUP_URL} to continue with higher limits.`,
      response.status,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new EasyparserApiError(
      `Easyparser returned a non-JSON response (HTTP ${response.status}). Retry the call once; if it repeats, report the request to the user.`,
      response.status,
    );
  }

  const requestInfo = (body.request_info ?? {}) as Record<string, unknown>;
  const errorDetails = requestInfo.error_details;
  if (
    (Array.isArray(errorDetails) && errorDetails.length > 0) ||
    requestInfo.success === false
  ) {
    const detail = Array.isArray(errorDetails)
      ? errorDetails.map((e) => String((e as Record<string, unknown>)?.message ?? e)).join("; ")
      : "unknown error";
    throw new EasyparserApiError(
      `Easyparser could not complete the ${params.operation} request: ${detail}. The identifier may be invalid, the product may be unavailable on amazon${params.domain}, or the page may require a delivery address. Suggest verifying the input or trying a different domain.`,
      response.status,
    );
  }

  if (!response.ok) {
    throw new EasyparserApiError(
      `Easyparser API request failed with HTTP ${response.status}. Retry once; if it persists, tell the user.`,
      response.status,
    );
  }

  return {
    success: true,
    operation: params.operation,
    data: body.result ?? body,
    credits_used:
      typeof requestInfo.credit_used_this_request === "number"
        ? requestInfo.credit_used_this_request
        : undefined,
    credits_remaining:
      typeof requestInfo.credits_remaining === "number"
        ? requestInfo.credits_remaining
        : undefined,
    request_id: typeof requestInfo.id === "string" ? requestInfo.id : undefined,
  };
}
