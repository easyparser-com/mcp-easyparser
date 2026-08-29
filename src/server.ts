/**
 * Shared MCP server factory for Easyparser.
 * Used by both the stdio entrypoint (index.ts) and the HTTP entrypoint (http.ts).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callEasyparser, EasyparserApiError } from "./client.js";
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
6. If unsure which tool fits, call list_operations — it is free and works without a key.`;

export interface ServerContext {
  /** Resolves the API key for the current request/session. */
  getApiKey: () => string | undefined;
}

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

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
      version: "1.0.0",
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
          return textResult(result);
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
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (input) => {
      return textResult(buildOperationsCatalogResponse(input.operation));
    },
  );

  // Helper: check_credits (API key required)
  server.registerTool(
    "check_credits",
    {
      description: CHECK_CREDITS_DESCRIPTION,
      inputSchema: checkCreditsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      try {
        const apiKey = requireApiKey(ctx);
        // Cheapest possible probe: BSR on a well-known ASIN costs 1 credit and
        // returns the credit envelope.
        const result = await callEasyparser(apiKey, {
          operation: "BEST_SELLERS_RANK",
          domain: ".com",
          asin: "B0F25371FH",
        });
        return textResult({
          success: true,
          credits_remaining: result.credits_remaining,
          credits_used_this_probe: result.credits_used,
          note: "This check consumed 1 credit (cheapest available probe). Plan details: https://app.easyparser.com/account/plan",
        });
      } catch (err) {
        if (err instanceof EasyparserApiError) return errorResult(err.message);
        return errorResult(
          `Unexpected error in check_credits: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );

  return server;
}
