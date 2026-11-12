/**
 * Shared schema fragments used across all Easyparser MCP tools.
 * Descriptions are written for AI agents, not humans.
 */
import { z } from "zod";

export const SUPPORTED_DOMAINS = [
  ".com", ".co.uk", ".de", ".fr", ".it", ".es", ".ca", ".com.mx",
  ".com.br", ".co.jp", ".in", ".com.au", ".ae", ".sa", ".nl", ".pl",
  ".se", ".com.be", ".com.tr", ".sg", ".ie", ".eg",
] as const;

export const domainSchema = z
  .enum(SUPPORTED_DOMAINS)
  .default(".com")
  .describe(
    "Amazon marketplace domain extension. Determines the regional Amazon site the data is fetched from. Use the domain that matches the user's market, because prices, availability and rankings differ across marketplaces.",
  );

export const asinSchema = z
  .string()
  .regex(/^[A-Z0-9]{10}$/i, "ASIN must be a 10-character alphanumeric code")
  .describe(
    "Amazon Standard Identification Number, a 10-character alphanumeric product identifier (e.g. B0CJB6V2L5). Found in the product URL after /dp/ or /gp/product/.",
  );

export const productUrlSchema = z
  .string()
  .url()
  .describe(
    "Full Amazon product URL (e.g. https://www.amazon.com/dp/B0CJB6V2L5). Use this when the user pastes a link instead of an ASIN.",
  );

export const sellerIdSchema = z
  .string()
  .min(5)
  .describe(
    "Amazon's unique seller identifier (e.g. A1MCYUGJD2ILFU). Found in seller profile URLs as the 'seller=' or 'me=' parameter.",
  );

export const sellerUrlSchema = z
  .string()
  .url()
  .describe(
    "Full Amazon seller profile or storefront URL (e.g. https://www.amazon.com/sp?seller=A1MCYUGJD2ILFU).",
  );

export const languageSchema = z
  .string()
  .optional()
  .describe(
    "Language code for the Amazon page, in locale format (e.g. en_US, de_DE, tr_TR). Affects the language of titles, descriptions and reviews in the response.",
  );

export const currencySchema = z
  .string()
  .optional()
  .describe(
    "ISO currency code for price display (e.g. usd, eur, try). Prices are converted by Amazon's own display logic.",
  );

export const pageSchema = (maxPages: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(maxPages)
    .default(1)
    .describe(
      `Ending page number. Each page costs 1 credit; max ${maxPages} pages per request. Default 1.`,
    );

export const minPageSchema = z
  .number()
  .int()
  .min(1)
  .default(1)
  .describe("Starting page number. Default 1.");

/**
 * Delivery-address fields for the operations that support an address
 * (DETAIL, OFFER, SEARCH, SELLER_PRODUCTS). Inline fields need no setup in the
 * web app; address_id points to an address saved on the Addresses page.
 */
export const deliveryAddressShape = {
  address_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "ID of an Active saved address for the same domain, from https://app.easyparser.com/addresses. Only use it when the user gives an address ID. For a ZIP code or city, use the inline fields instead. Inline fields override address_id.",
    ),
  zip_code: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Inline delivery address: ZIP or postal code, so prices, availability and delivery dates match a shopper at that location. Examples: '10001' on .com, 'SW1A 1AA' on .co.uk. Join two-part codes with a comma: 'N0E,1Y0' on .ca, '01310,100' on .com.br, '241,0014' on .co.jp. On .com.au send it with city.",
    ),
  city: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Inline delivery address: city. Only for .com.au (with zip_code, e.g. 'KEW'), .ae (with district, e.g. 'Abu Dhabi'), .sa and .eg (alone, one of Amazon's delivery cities, e.g. 'Riyadh'). Do not send it on other domains.",
    ),
  district: z
    .string()
    .min(1)
    .optional()
    .describe("Inline delivery address: area within city. Only on .ae, together with city (e.g. 'ADCO Compound')."),
  country_code: z
    .string()
    .min(2)
    .optional()
    .describe(
      "Inline delivery address: destination country for cross-border delivery as an ISO 3166-1 alpha-2 code (e.g. 'GB' on .com). On .nl only 'NL' or 'BE'.",
    ),
};

export const DELIVERY_ADDRESS_HINT =
  "To see what a shopper at a specific location sees (price, availability, delivery date), pass the inline address fields (zip_code, or city/district/country_code where the domain needs them); no setup is needed. A new location is saved to the account and counts once against the plan's address limit; repeat requests for the same location reuse it. Requests with inline address fields can take up to 45 seconds. Check applied_address in the response: if it does not contain the values you sent, the address was not applied.";

/** Maps validated address input to API query params (undefined values are skipped). */
export function addressApiParams(i: Record<string, unknown>) {
  return {
    address_id: i.address_id as number | undefined,
    zip_code: i.zip_code as string | undefined,
    city: i.city as string | undefined,
    district: i.district as string | undefined,
    country_code: i.country_code as string | undefined,
  };
}

/**
 * Catches address combinations the API accepts with HTTP 200 but silently
 * ignores, so the agent does not report a localized result that is not.
 * Returns an agent-facing message, or null when the input is fine.
 */
export function validateDeliveryAddress(i: Record<string, unknown>): string | null {
  const domain = i.domain as string | undefined;
  const has = (key: string) => typeof i[key] === "string" && (i[key] as string).trim() !== "";
  const anyAddress = i.address_id !== undefined || has("zip_code") || has("city") || has("district") || has("country_code");
  if (!anyAddress) return null;
  if (domain === ".com.be") {
    return "The delivery address cannot be set on .com.be. Remove the address fields, or use another domain.";
  }
  if (has("district") && (domain !== ".ae" || !has("city"))) {
    return "district only works on .ae together with city (e.g. city 'Abu Dhabi', district 'ADCO Compound'). Remove district or fix the domain.";
  }
  if (domain === ".com.au" && has("zip_code") && !has("city")) {
    return "On .com.au send zip_code together with city (e.g. zip_code '3101', city 'KEW').";
  }
  return null;
}
