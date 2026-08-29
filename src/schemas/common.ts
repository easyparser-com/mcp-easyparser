/**
 * Shared schema fragments used across all Easyparser MCP tools.
 * Descriptions are written for AI agents, not humans.
 */
import { z } from "zod";

export const SUPPORTED_DOMAINS = [
  ".com", ".co.uk", ".de", ".fr", ".it", ".es", ".ca", ".com.mx",
  ".com.br", ".co.jp", ".in", ".com.au", ".ae", ".sa", ".nl", ".pl",
  ".se", ".be", ".com.tr", ".sg", ".ie",
] as const;

export const domainSchema = z
  .enum(SUPPORTED_DOMAINS)
  .default(".com")
  .describe(
    "Amazon marketplace domain extension. Determines the regional Amazon site the data is fetched from. Use the domain that matches the user's market — prices, availability and rankings differ across marketplaces.",
  );

export const asinSchema = z
  .string()
  .regex(/^[A-Z0-9]{10}$/i, "ASIN must be a 10-character alphanumeric code")
  .describe(
    "Amazon Standard Identification Number — a 10-character alphanumeric product identifier (e.g. B0CJB6V2L5). Found in the product URL after /dp/ or /gp/product/.",
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
