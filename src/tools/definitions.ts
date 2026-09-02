/**
 * Easyparser MCP tool definitions.
 * Every description is written for AI agents: what the tool returns,
 * when to use it, when a cheaper/different tool is better, and credit cost.
 */
import { z } from "zod";
import {
  asinSchema,
  currencySchema,
  domainSchema,
  languageSchema,
  minPageSchema,
  pageSchema,
  productUrlSchema,
  sellerIdSchema,
  sellerUrlSchema,
} from "../schemas/common.js";

export interface ToolDefinition {
  name: string;
  operation: string | null; // null for local helper tools
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  /** Maps validated tool input to Easyparser API query params. */
  toApiParams: (input: Record<string, unknown>) => {
    operation: string;
    domain: string;
    [key: string]: string | number | boolean | undefined;
  };
}

const IDENTIFIER_MUTEX_HINT =
  "Provide EITHER the identifier field OR url — never both.";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_product_detail",
    operation: "DETAIL",
    description: `Fetch complete, structured information about a single Amazon product: title, brand, images, feature bullets, description, Buy Box price and availability, Prime eligibility, rating and review count, Best Sellers Rank, category path, variants, specifications, and top reviews. This is the primary tool for product analysis, listing enrichment, and price monitoring.

Use this tool when you need a full product profile. If you only need competing seller prices, use get_product_offers instead (cheaper context). If you only need the sales rank, use get_bestseller_rank. If you only need shipping dimensions or the FBA fee category, use get_package_dimensions.

${IDENTIFIER_MUTEX_HINT} Costs 1 credit; set a_plus_content to true only when the user explicitly asks about enhanced brand content, as it costs 1 extra credit.`,
    schema: z.object({
      asin: asinSchema.optional(),
      url: productUrlSchema.optional(),
      domain: domainSchema,
      language: languageSchema,
      currency: currencySchema,
      a_plus_content: z
        .boolean()
        .default(false)
        .describe(
          "Set true to include the 'From the manufacturer' A+ enhanced brand content. Costs 1 additional credit. Default false.",
        ),
      seller_id: z
        .string()
        .optional()
        .describe(
          "Fetch the product as offered by a specific seller (their Seller ID). Only use when the user asks about a specific merchant's offer.",
        ),
    }),
    toApiParams: (i) => ({
      operation: "DETAIL",
      domain: i.domain as string,
      asin: i.asin as string | undefined,
      url: i.url as string | undefined,
      language: i.language as string | undefined,
      currency: i.currency as string | undefined,
      a_plus_content: i.a_plus_content === true ? true : undefined,
      seller_id: i.seller_id as string | undefined,
    }),
  },
  {
    name: "get_product_offers",
    operation: "OFFER",
    description: `Fetch the list of seller offers for an Amazon product: every merchant selling the item with their price, shipping cost, condition (new/used), fulfillment type (FBA/FBM), and seller rating. Also returns the Buy Box winner. This is the tool for competitive price analysis, reseller monitoring, and availability tracking.

Use this tool when the question is about WHO sells the product and at WHAT price. If you need the product's own details (title, images, rating), use get_product_detail instead.

Each requested page costs 1 credit. Start with a single page (default) and only increase max_page if the user needs the full offer list. Use the condition and shipping filters to narrow results instead of paginating — it is cheaper.`,
    schema: z.object({
      asin: asinSchema,
      domain: domainSchema,
      prime: z.boolean().optional().describe("If true, return only Prime-eligible offers."),
      free_shipping: z.boolean().optional().describe("If true, return only offers with free shipping."),
      condition: z
        .enum(["new", "used_like_new", "used_very_good", "used_good", "used_acceptable"])
        .optional()
        .describe(
          "Filter offers by item condition. Omit to include all conditions.",
        ),
      min_page: minPageSchema,
      max_page: pageSchema(5),
    }),
    toApiParams: (i) => {
      const conditionMap: Record<string, string> = {
        new: "condition_new",
        used_like_new: "condition_used_like_new",
        used_very_good: "condition_used_very_good",
        used_good: "condition_used_good",
        used_acceptable: "condition_used_acceptable",
      };
      const params: {
        operation: string;
        domain: string;
        [key: string]: string | number | boolean | undefined;
      } = {
        operation: "OFFER",
        domain: i.domain as string,
        asin: i.asin as string,
        prime: i.prime as boolean | undefined,
        free_shipping: i.free_shipping as boolean | undefined,
        min_page: i.min_page as number,
        max_page: i.max_page as number,
      };
      if (i.condition) params[conditionMap[i.condition as string]] = true;
      return params;
    },
  },
  {
    name: "search_products",
    operation: "SEARCH",
    description: `Search Amazon by keyword or a full search/category URL and get structured product listings: ASIN, title, price, rating, review count, Prime status, and badges (Best Seller, Amazon's Choice) for each result. Also returns the available refinement filters (category, brand, price range) with their IDs.

Use this tool for market research, keyword analysis, and product discovery. If the user already has an ASIN or product URL, do NOT search — use get_product_detail directly.

Each page costs 1 credit. One page typically returns 20-40 products, which is enough for most questions. Use sort_by and exclude_sponsored to improve result quality instead of fetching more pages. To filter by category or brand, first run one search and read the refinements field in the response to discover valid filter IDs, then pass them in refinements.`,
    schema: z.object({
      keyword: z
        .string()
        .optional()
        .describe(
          "Search query as a user would type it into Amazon (e.g. 'stainless steel water bottle 40oz'). Mutually exclusive with url.",
        ),
      url: z
        .string()
        .url()
        .optional()
        .describe(
          "Full Amazon search or category URL. Use when the user pastes an Amazon link containing filters. Mutually exclusive with keyword.",
        ),
      domain: domainSchema,
      sort_by: z
        .enum(["featured", "price-asc-rank", "price-desc-rank", "review-rank", "date-desc-rank", "exact-aware-popularity-rank"])
        .default("featured")
        .describe(
          "Result ordering. 'featured' is Amazon's default; 'price-asc-rank' cheapest first; 'price-desc-rank' most expensive; 'review-rank' most reviewed; 'date-desc-rank' newest listings; 'exact-aware-popularity-rank' by popularity.",
        ),
      exclude_sponsored: z
        .boolean()
        .default(false)
        .describe(
          "If true, removes sponsored (paid ad) products from results. Recommended true for organic market analysis.",
        ),
      refinements: z
        .string()
        .optional()
        .describe(
          "Category/attribute filters in Amazon's format: 'n:<category_id>,p_<filter_group>:<filter_id>'. Discover valid IDs from the refinements field of a previous search response. Example: 'n:7141123011,p_123:502215'.",
        ),
      language: languageSchema,
      currency: currencySchema,
      min_page: minPageSchema,
      max_page: pageSchema(5),
    }),
    toApiParams: (i) => ({
      operation: "SEARCH",
      domain: i.domain as string,
      keyword: i.keyword as string | undefined,
      url: i.url as string | undefined,
      sort_by: i.sort_by as string,
      exclude_sponsored: i.exclude_sponsored === true ? true : undefined,
      refinements: i.refinements as string | undefined,
      language: i.language as string | undefined,
      currency: i.currency as string | undefined,
      min_page: i.min_page as number,
      max_page: i.max_page as number,
    }),
  },
  {
    name: "lookup_product",
    operation: "PRODUCT_LOOKUP",
    description: `Convert an external product identifier (UPC, EAN, GTIN, ISBN, JAN, MINSAN) into the corresponding Amazon ASIN, with an essential product snapshot. This is the bridge between manufacturer/retail barcodes and the Amazon ecosystem.

Use this tool when the user has a barcode or standard product code and wants to find the matching Amazon listing. Typical workflows: catalog matching, inventory synchronization, converting supplier data into Amazon ASINs. Also accepts ASIN as input type if you need to validate one.

You MUST set identifier_type to match the code you have — guessing the wrong type returns no results. UPC is 12 digits, EAN/GTIN is 13, ISBN is 10 or 13 (books). If the user gives a keyword instead of a code, use search_products instead. Costs 1 credit.`,
    schema: z.object({
      identifier: z
        .string()
        .describe("The product code value (e.g. '724382975021' for a UPC). Digits only for barcode types."),
      identifier_type: z
        .enum(["ASIN", "EAN", "GTIN", "ISBN", "JAN", "MINSAN", "UPC"])
        .describe(
          "The type of code provided. UPC: 12-digit US barcode. EAN/GTIN: 13-digit international barcode. ISBN: book identifier. JAN: Japanese barcode. MINSAN: Italian pharma code. ASIN: Amazon's own identifier.",
        ),
      domain: domainSchema,
    }),
    toApiParams: (i) => ({
      operation: "PRODUCT_LOOKUP",
      domain: i.domain as string,
      identifier: i.identifier as string,
      identifier_type: i.identifier_type as string,
    }),
  },
  {
    name: "get_sales_history",
    operation: "SALES_ANALYSIS_HISTORY",
    description: `Retrieve a product's historical performance over up to 12 months: weekly aggregated trends for estimated views/traffic, sales, price, and Best Sellers Rank. This is Easyparser's 'time machine' — the deepest competitive-intelligence tool in this server.

Use this tool for trend forecasting, seasonality analysis, conversion-rate estimation, and investment/sourcing due diligence. Do NOT use it for a simple current price check — get_product_detail is 5x cheaper for that.

IMPORTANT cost rule: the base cost is 5 credits, and each month of history adds 1 credit (3 months = 8 credits, 12 months = 17 credits). Always ask the user how far back they need, or default to 3 months for a quick trend read. The history array in the response is aggregated by WEEK, not by day.`,
    schema: z.object({
      asin: asinSchema,
      domain: domainSchema,
      history_range: z
        .enum(["0", "3", "6", "9", "12"])
        .default("0")
        .describe(
          "Depth of historical data in months. '0' returns only the current snapshot (5 credits). '3', '6', '9', '12' add weekly history at +1 credit per month. Default '0'.",
        ),
    }),
    toApiParams: (i) => ({
      operation: "SALES_ANALYSIS_HISTORY",
      domain: i.domain as string,
      asin: i.asin as string,
      history_range: i.history_range as string,
    }),
  },
  {
    name: "get_bestseller_rank",
    operation: "BEST_SELLERS_RANK",
    description: `Get a product's current Best Sellers Rank (BSR): its numerical rank in main categories and sub-category node identifiers. A lightweight, single-purpose tool for popularity and demand tracking.

Use this tool when you only need the rank — e.g. 'Is this product selling well?' or daily rank monitoring. Lower rank number means higher sales velocity. If you also need price, rating or content, use get_product_detail instead (it includes BSR along with everything else). For historical rank trends, use get_sales_history. Costs 1 credit.`,
    schema: z.object({
      asin: asinSchema,
      domain: domainSchema,
    }),
    toApiParams: (i) => ({
      operation: "BEST_SELLERS_RANK",
      domain: i.domain as string,
      asin: i.asin as string,
    }),
  },
  {
    name: "get_package_dimensions",
    operation: "PACKAGE_DIMENSION",
    description: `Get a product's precise physical and logistical attributes: package height, width, length, weight, and its Amazon fee category (e.g. Computers, Apparel). This is the FBA fee-estimation and shipping-cost tool.

Use this tool when the question is about shipping, storage, FBA fees, or warehouse planning. Do NOT use it for general product info — get_product_detail includes a human-readable dimensions string, but only THIS tool returns the structured fee category and exact measurements needed for fee calculation. Costs 1 credit.`,
    schema: z.object({
      asin: asinSchema,
      domain: domainSchema,
    }),
    toApiParams: (i) => ({
      operation: "PACKAGE_DIMENSION",
      domain: i.domain as string,
      asin: i.asin as string,
    }),
  },
  {
    name: "get_seller_profile",
    operation: "SELLER_PROFILE",
    description: `Unmask the legal identity and reputation of any Amazon merchant: legal business name, registered business address, and granular feedback trends over 30/90/365 days and lifetime. This is the supplier-verification and brand-protection tool.

Use this tool when the user asks 'who is this seller?', 'is this merchant legitimate?', or needs a supplier's legal entity for compliance or invoicing. To see WHAT the seller sells, use get_seller_products. To read individual buyer reviews about the seller, use get_seller_feedback.

${IDENTIFIER_MUTEX_HINT.replace("the identifier field", "seller_id")} You can discover a product's seller by calling get_product_offers first. Costs 1 credit.`,
    schema: z.object({
      seller_id: sellerIdSchema.optional(),
      url: sellerUrlSchema.optional(),
      domain: domainSchema,
      language: languageSchema,
    }),
    toApiParams: (i) => ({
      operation: "SELLER_PROFILE",
      domain: i.domain as string,
      seller_id: i.seller_id as string | undefined,
      url: i.url as string | undefined,
      language: i.language as string | undefined,
    }),
  },
  {
    name: "get_seller_products",
    operation: "SELLER_PRODUCTS",
    description: `Extract a seller's full product catalog: every ASIN they sell with brand, category, price, Prime status, variant counts, and rating data. Also returns dynamic refinement filters (department, shipping, sustainability) for drilling into the catalog.

Use this tool for competitor inventory analysis, stock monitoring, and pricing-strategy research. If you need the seller's legal identity or reputation instead of their products, use get_seller_profile.

Each page costs 1 credit. Start with one page and use sort_by (e.g. 'exact-aware-popularity-rank' for best sellers first) to surface the most relevant products early. ${IDENTIFIER_MUTEX_HINT.replace("the identifier field", "seller_id")}`,
    schema: z.object({
      seller_id: sellerIdSchema.optional(),
      url: sellerUrlSchema.optional(),
      domain: domainSchema,
      sort_by: z
        .string()
        .optional()
        .describe(
          "Catalog ordering. 'featured-rank' is default; 'exact-aware-popularity-rank' sorts by popularity (best sellers first); 'price-asc-rank'/'price-desc-rank' by price; 'date-desc-rank' by newest.",
        ),
      exclude_refinements: z
        .boolean()
        .default(false)
        .describe(
          "If true, omits the refinement filter list from the response, reducing payload size. Default false.",
        ),
      language: languageSchema,
      min_page: minPageSchema,
      max_page: pageSchema(5),
    }),
    toApiParams: (i) => ({
      operation: "SELLER_PRODUCTS",
      domain: i.domain as string,
      seller_id: i.seller_id as string | undefined,
      url: i.url as string | undefined,
      sort_by: i.sort_by as string | undefined,
      exclude_refinements: i.exclude_refinements === true ? true : undefined,
      language: i.language as string | undefined,
      min_page: i.min_page as number,
      max_page: i.max_page as number,
    }),
  },
  {
    name: "get_seller_feedback",
    operation: "SELLER_FEEDBACK",
    description: `Read individual buyer feedback entries for an Amazon seller: star ratings, comment text, and dates — filterable by rating range and time period. This is the reputation deep-dive tool.

Use this tool when the user wants to read actual buyer comments about a seller, analyze complaint patterns, or audit service quality. For aggregate reputation scores (30/90/365-day percentages) without individual comments, get_seller_profile is sufficient and cheaper in context.

Each page costs 1 credit. To find dissatisfied customers, set max_rating to 3 instead of paging through everything.`,
    schema: z.object({
      seller_id: sellerIdSchema,
      domain: domainSchema,
      history_range: z
        .enum(["1", "3", "12", "all"])
        .default("all")
        .describe("Time period filter: '1' or '3' or '12' for months, 'all' for everything. Default 'all'."),
      min_rating: z
        .number().int().min(1).max(5).default(1)
        .describe("Minimum star rating to include (1-5). Default 1."),
      max_rating: z
        .number().int().min(1).max(5).default(5)
        .describe("Maximum star rating to include (1-5). Set to 3 to focus on negative feedback. Default 5."),
      min_page: minPageSchema,
      max_page: pageSchema(5),
    }),
    toApiParams: (i) => ({
      operation: "SELLER_FEEDBACK",
      domain: i.domain as string,
      seller_id: i.seller_id as string,
      history_range: i.history_range as string,
      min_rating: i.min_rating as number,
      max_rating: i.max_rating as number,
      min_page: i.min_page as number,
      max_page: i.max_page as number,
    }),
  },
];
