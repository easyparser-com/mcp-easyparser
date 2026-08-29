/**
 * Helper tools that work without an API key (list_operations) or
 * query account state (check_credits). These power the discovery and
 * budget-awareness layer of the server.
 */
import { z } from "zod";
import { SUPPORTED_DOMAINS } from "../schemas/common.js";

export const OPERATIONS_CATALOG = [
  {
    operation: "DETAIL",
    tool: "get_product_detail",
    cost: "1 credit (+1 with a_plus_content)",
    input: "asin OR url",
    use_case: "Full product profile: title, price, images, rating, BSR, variants, reviews",
  },
  {
    operation: "OFFER",
    tool: "get_product_offers",
    cost: "1 credit per page (max 5 pages)",
    input: "asin",
    use_case: "All seller offers for a product: prices, conditions, fulfillment, Buy Box",
  },
  {
    operation: "SEARCH",
    tool: "search_products",
    cost: "1 credit per page (max 5 pages)",
    input: "keyword OR url",
    use_case: "Keyword/category product discovery with prices, ratings, badges",
  },
  {
    operation: "PRODUCT_LOOKUP",
    tool: "lookup_product",
    cost: "1 credit",
    input: "identifier + identifier_type (UPC/EAN/GTIN/ISBN/JAN/MINSAN/ASIN)",
    use_case: "Convert barcodes to Amazon ASINs; catalog matching",
  },
  {
    operation: "SALES_ANALYSIS_HISTORY",
    tool: "get_sales_history",
    cost: "5 credits base + 1 per month of history (max 17 for 12 months)",
    input: "asin + history_range",
    use_case: "12-month weekly trends: views, sales, price, BSR",
  },
  {
    operation: "BEST_SELLERS_RANK",
    tool: "get_bestseller_rank",
    cost: "1 credit",
    input: "asin",
    use_case: "Current Best Sellers Rank in main and sub categories",
  },
  {
    operation: "PACKAGE_DIMENSION",
    tool: "get_package_dimensions",
    cost: "1 credit",
    input: "asin",
    use_case: "Exact dimensions, weight, Amazon fee category — FBA fee estimation",
  },
  {
    operation: "SELLER_PROFILE",
    tool: "get_seller_profile",
    cost: "1 credit",
    input: "seller_id OR url",
    use_case: "Seller legal identity, business address, 30/90/365-day feedback trends",
  },
  {
    operation: "SELLER_PRODUCTS",
    tool: "get_seller_products",
    cost: "1 credit per page (max 5 pages)",
    input: "seller_id OR url",
    use_case: "A seller's full catalog: ASINs, prices, Prime status, ratings",
  },
  {
    operation: "SELLER_FEEDBACK",
    tool: "get_seller_feedback",
    cost: "1 credit per page (max 5 pages)",
    input: "seller_id",
    use_case: "Individual buyer feedback entries, filterable by rating and period",
  },
] as const;

export const listOperationsSchema = z.object({
  operation: z
    .enum([
      "DETAIL", "OFFER", "SEARCH", "PRODUCT_LOOKUP", "SALES_ANALYSIS_HISTORY",
      "BEST_SELLERS_RANK", "PACKAGE_DIMENSION", "SELLER_PROFILE",
      "SELLER_PRODUCTS", "SELLER_FEEDBACK",
    ])
    .optional()
    .describe(
      "Optional. Get the usage guide for one operation instead of the whole catalog.",
    ),
});

export const LIST_OPERATIONS_DESCRIPTION = `List all Easyparser operations available in this server, with their parameters, credit costs, and example use cases. Works WITHOUT an API key — call this first to understand what the server can do, or when you are unsure which tool fits the user's question. Also returns the list of supported Amazon marketplace domains.`;

export function buildOperationsCatalogResponse(operation?: string) {
  const entries = operation
    ? OPERATIONS_CATALOG.filter((o) => o.operation === operation)
    : OPERATIONS_CATALOG;
  return {
    server: "easyparser-mcp",
    operations: entries,
    supported_domains: SUPPORTED_DOMAINS,
    signup: "Get a free API key at https://app.easyparser.com/signup",
    note: "All data tools require an Easyparser API key configured on the server. This catalog tool is free.",
  };
}

export const checkCreditsSchema = z.object({});

export const CHECK_CREDITS_DESCRIPTION = `Check the current Easyparser credit balance and recent usage for the configured API key. Use this before running expensive multi-page or 12-month-history jobs, and whenever the user asks about their quota. Requires an API key.`;
