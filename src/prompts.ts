/**
 * Ready-made workflow prompts and read-only reference resources.
 * Prompts chain the data tools into common Amazon research workflows;
 * resources expose the free catalog/marketplace/guide data without a tool call.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SUPPORTED_DOMAINS } from "./schemas/common.js";
import { buildOperationsCatalogResponse } from "./tools/helpers.js";

const domainArg = z
  .string()
  .optional()
  .describe(`Amazon marketplace domain, e.g. .com, .de, .co.uk. Defaults to .com. Supported: ${SUPPORTED_DOMAINS.join(", ")}`);

function userPrompt(text: string) {
  return {
    messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
  };
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "analyze_competitor_product",
    {
      title: "Analyze a competitor product",
      description:
        "Full competitive teardown of one Amazon product: listing details, who sells it and at what price, and recent sales and BSR trends.",
      argsSchema: {
        asin: z.string().describe("ASIN of the product to analyze, e.g. B0CJB6V2L5"),
        domain: domainArg,
      },
    },
    ({ asin, domain }) =>
      userPrompt(
        `Analyze the Amazon product ${asin} on amazon${domain ?? ".com"} as a competitor.
1. Call get_product_detail for the listing: title, brand, price, rating, review count, BSR and key features.
2. Call get_product_offers (1 page) to see who sells it, the Buy Box winner, and FBA vs FBM split.
3. Call get_sales_history with history_range 3 (8 credits) for weekly sales, price and BSR trends. Tell me the credit cost before calling if I might want a longer range.
Finish with a short summary: estimated demand, price positioning, competition intensity, and the main opportunities or risks.`,
      ),
  );

  server.registerPrompt(
    "estimate_fba_logistics",
    {
      title: "Estimate FBA logistics",
      description:
        "Get exact package dimensions, weight and Amazon fee category for a product to plan FBA fees and shipping.",
      argsSchema: {
        asin: z.string().describe("ASIN of the product, e.g. B0CJB6V2L5"),
        domain: domainArg,
      },
    },
    ({ asin, domain }) =>
      userPrompt(
        `Plan FBA logistics for ASIN ${asin} on amazon${domain ?? ".com"}.
1. Call get_package_dimensions for the exact package size, weight and Amazon fee category.
2. Call get_product_detail for the current price so fees can be put in context.
Report the dimensions and weight in both metric and imperial units, the size tier they likely fall into, and what drives the fulfillment cost. Make clear that fee tiers are an estimate and Amazon's fee schedule is the final source.`,
      ),
  );

  server.registerPrompt(
    "match_barcodes_to_asins",
    {
      title: "Match barcodes to ASINs",
      description:
        "Convert a list of UPC, EAN, GTIN or ISBN codes into Amazon ASINs with a product snapshot for each.",
      argsSchema: {
        codes: z.string().describe("Comma- or newline-separated barcodes"),
        identifier_type: z.string().optional().describe("UPC, EAN, GTIN, ISBN, JAN or MINSAN. Inferred from length if omitted."),
        domain: domainArg,
      },
    },
    ({ codes, identifier_type, domain }) =>
      userPrompt(
        `Match these product codes to Amazon ASINs on amazon${domain ?? ".com"}:
${codes}

Call lookup_product once per code (1 credit each)${identifier_type ? ` with identifier_type ${identifier_type}` : ". Infer identifier_type from the length: 12 digits UPC, 13 digits EAN, 10 characters ISBN"}. If there are more than 20 codes, tell me the total credit cost first.
Return a table with: code, ASIN, title, brand, price. Mark codes with no match instead of guessing.`,
      ),
  );

  server.registerPrompt(
    "vet_amazon_seller",
    {
      title: "Vet an Amazon seller",
      description:
        "Check a seller's legal identity, reputation trends and recent negative feedback before partnering or sourcing.",
      argsSchema: {
        seller_id: z.string().describe("Amazon seller ID, e.g. A1MCYUGJD2ILFU"),
        domain: domainArg,
      },
    },
    ({ seller_id, domain }) =>
      userPrompt(
        `Vet the Amazon seller ${seller_id} on amazon${domain ?? ".com"}.
1. Call get_seller_profile for the legal business name, address and 30/90/365-day feedback percentages.
2. Call get_seller_feedback with max_rating 3 (1 page) to read recent negative comments.
3. Call get_seller_products (1 page) to see what they mainly sell.
Summarize: who the seller is, how their reputation is trending, recurring complaint themes, and an overall risk level with the reasons.`,
      ),
  );

  server.registerPrompt(
    "product_market_research",
    {
      title: "Research a product niche",
      description:
        "Scan an Amazon search niche: top products, price range, ratings and badges, then drill into the leaders.",
      argsSchema: {
        keyword: z.string().describe("Search keyword, e.g. 'standing desk'"),
        domain: domainArg,
      },
    },
    ({ keyword, domain }) =>
      userPrompt(
        `Research the "${keyword}" niche on amazon${domain ?? ".com"}.
1. Call search_products (1 page, exclude_sponsored true) to list the top organic results.
2. For the top 3 products, call get_bestseller_rank to compare demand.
Summarize: price range, typical rating and review counts, dominant brands, badges (Best Seller, Amazon's Choice), and whether the niche looks saturated or open. Offer get_sales_history on a leader as a next step and mention its credit cost.`,
      ),
  );
}

export function registerResources(server: McpServer, guide: string): void {
  server.registerResource(
    "operations",
    "easyparser://operations",
    {
      title: "Easyparser operations catalog",
      description: "Every Easyparser operation with its tool name, input, credit cost and use case. Free to read.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(buildOperationsCatalogResponse(), null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "marketplaces",
    "easyparser://marketplaces",
    {
      title: "Supported Amazon marketplaces",
      description: "The 21 Amazon marketplace domains Easyparser supports, for the domain parameter of every data tool.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { domains: SUPPORTED_DOMAINS, default: ".com", count: SUPPORTED_DOMAINS.length },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "usage-guide",
    "easyparser://guide",
    {
      title: "Easyparser usage guide",
      description: "Decision rules for picking the right tool and keeping credit usage low.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: guide }],
    }),
  );
}
