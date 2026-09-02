/**
 * Easyparser Account API client.
 * GET https://account.easyparser.com/v1/account?api_key=...
 * Free of per-call credits: returns plan, credit balance, rate limits
 * and daily usage history.
 */

export const ACCOUNT_BASE_URL = "https://account.easyparser.com/v1/account";

export interface AccountInfo {
  success: boolean;
  plan?: string;
  credits_used?: number;
  credits_remaining?: number;
  credits_limit?: number;
  credits_reset_at?: string;
  minutely_real_time_credit_limit?: number;
  minutely_bulk_credit_limit?: number;
  addresses_used?: number;
  addresses_limit?: number;
  /** Current-month daily usage, flattened for agent readability. */
  current_month_usage?: {
    month: string;
    year: number;
    month_total: number;
    days: Array<{
      day: number;
      total: number;
      realtime: number;
      bulk: number;
      top_operations: Record<string, number>;
    }>;
  };
}

interface RawDayEntry {
  day_total?: { success?: number };
  REALTIME?: { total?: { success?: number }; operations?: Record<string, { success?: number }> };
  BULK?: { total?: { success?: number }; operations?: Record<string, { success?: number }> };
}

interface RawMonth {
  month: string;
  year: number;
  is_current_month?: boolean;
  credits_total_per_day?: Record<string, RawDayEntry>;
  month_summary?: { success?: number };
}

/** Shape the raw account payload into an agent-friendly summary. */
export function shapeAccountInfo(raw: Record<string, unknown>): AccountInfo {
  const info = (raw.account_info ?? {}) as Record<string, unknown>;
  const history = (info.usage_history ?? []) as RawMonth[];
  const current = history.find((m) => m.is_current_month);

  let currentMonth: AccountInfo["current_month_usage"];
  if (current) {
    const days = Object.entries(current.credits_total_per_day ?? {})
      .map(([day, entry]) => {
        const ops: Record<string, number> = {};
        for (const channel of [entry.REALTIME, entry.BULK]) {
          for (const [op, stat] of Object.entries(channel?.operations ?? {})) {
            const v = stat?.success ?? 0;
            if (v > 0) ops[op] = (ops[op] ?? 0) + v;
          }
        }
        const top = Object.fromEntries(
          Object.entries(ops).sort((a, b) => b[1] - a[1]).slice(0, 5),
        );
        return {
          day: Number(day),
          total: entry.day_total?.success ?? 0,
          realtime: entry.REALTIME?.total?.success ?? 0,
          bulk: entry.BULK?.total?.success ?? 0,
          top_operations: top,
        };
      })
      .sort((a, b) => a.day - b.day);

    currentMonth = {
      month: current.month,
      year: current.year,
      month_total: current.month_summary?.success ?? 0,
      days,
    };
  }

  return {
    success: true,
    plan: info.plan as string | undefined,
    credits_used: info.credits_used as number | undefined,
    credits_remaining: info.credits_remaining as number | undefined,
    credits_limit: info.credits_limit as number | undefined,
    credits_reset_at: info.credits_reset_at as string | undefined,
    minutely_real_time_credit_limit: info.minutely_real_time_credit_limit as number | undefined,
    minutely_bulk_credit_limit: info.minutely_bulk_credit_limit as number | undefined,
    addresses_used: info.addresses_used as number | undefined,
    addresses_limit: info.addresses_limit as number | undefined,
    current_month_usage: currentMonth,
  };
}

/** Call the Account API. Free of per-call credits. */
export async function callAccountApi(apiKey: string): Promise<AccountInfo> {
  const url = new URL(ACCOUNT_BASE_URL);
  url.searchParams.set("api_key", apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new Error(
      `Could not reach the Easyparser Account API: ${err instanceof Error ? err.message : String(err)}. Retry once.`,
    );
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Easyparser API key is missing or invalid. Ask the user to create a free key at https://app.easyparser.com/signup and set EASYPARSER_API_KEY.",
    );
  }

  if (!response.ok || !body || (body.request_info as Record<string, unknown>)?.success !== true) {
    throw new Error(
      `Account API request failed (HTTP ${response.status}). Retry once; if it persists, tell the user.`,
    );
  }

  return shapeAccountInfo(body);
}
