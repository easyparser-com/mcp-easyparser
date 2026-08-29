/**
 * Live API test: calls every Easyparser operation through the MCP server
 * using the real API key from the environment (api_key or EASYPARSER_API_KEY).
 * Run: node tests/live.test.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const KEY = process.env.EASYPARSER_API_KEY ?? process.env.api_key;
if (!KEY) {
  console.error("Set EASYPARSER_API_KEY (or api_key) to run live tests.");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, EASYPARSER_API_KEY: KEY },
});

const client = new Client({ name: "easyparser-live-test", version: "0.1.0" });

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name} ${extra}`);
    failures++;
  }
};

const parse = (r) => {
  try {
    return JSON.parse(r.content[0].text);
  } catch {
    return null;
  }
};

// A well-known, stable product (Stanley tumbler used in Easyparser docs)
const TEST_ASIN = "B0F25371FH";
// Amazon's own seller ID (stable)
const TEST_SELLER = "ATVPDKIKX0DER";

const CASES = [
  {
    name: "get_bestseller_rank",
    args: { asin: TEST_ASIN, domain: ".com" },
    expect: (d) => d?.result?.product || d?.product || d?.result,
  },
  {
    name: "get_package_dimensions",
    args: { asin: TEST_ASIN, domain: ".com" },
    expect: (d) => d?.result ?? d,
  },
  {
    name: "get_product_detail",
    args: { asin: TEST_ASIN, domain: ".com" },
    // client.ts strips the envelope; data is the `result` object itself
    expect: (d) => d?.detail?.asin === TEST_ASIN || d?.detail?.title,
  },
  {
    name: "get_product_offers",
    args: { asin: TEST_ASIN, domain: ".com" },
    expect: (d) => d?.result ?? d,
  },
  {
    name: "search_products",
    args: { keyword: "stanley tumbler", domain: ".com" },
    expect: (d) => d?.result ?? d,
  },
  {
    name: "lookup_product",
    args: { identifier: "041604458187", identifier_type: "UPC", domain: ".com" },
    expect: (d) => d?.result ?? d,
  },
  {
    name: "get_sales_history",
    args: { asin: TEST_ASIN, domain: ".com", history_range: "0" },
    expect: (d) => d?.result ?? d,
  },
  {
    name: "get_seller_profile",
    // Third-party seller ID taken from the official Easyparser docs
    args: { seller_id: "A1MCYUGJD2ILFU", domain: ".com" },
    expect: (d) => d?.seller_profile ?? d?.seller ?? d,
  },
  {
    name: "get_seller_products",
    args: { seller_id: TEST_SELLER, domain: ".com" },
    expect: (d) => d?.result ?? d,
  },
  {
    name: "get_seller_feedback",
    args: { seller_id: "A1MCYUGJD2ILFU", domain: ".com", max_page: 1 },
    expect: (d) => d?.feedback ?? d?.seller_feedback ?? d,
  },
  {
    name: "check_credits",
    args: {},
    expect: (d) => typeof d?.credits_remaining === "number",
  },
];

try {
  await client.connect(transport);

  for (const c of CASES) {
    process.stdout.write(`\n--- ${c.name} ---\n`);
    try {
      const result = await client.callTool({ name: c.name, arguments: c.args });
      if (result.isError) {
        check(c.name, false, `isError: ${result.content[0].text.slice(0, 200)}`);
        continue;
      }
      const data = parse(result);
      const ok = data && data.success === true && c.expect(data.data ?? data);
      check(c.name, !!ok, ok ? "" : `unexpected payload: ${JSON.stringify(data).slice(0, 300)}`);
      if (data?.credits_remaining !== undefined) {
        console.log(`      credits_remaining: ${data.credits_remaining}`);
      }
    } catch (err) {
      check(c.name, false, err.message?.slice(0, 200));
    }
  }
} catch (err) {
  console.error("FATAL", err);
  failures++;
} finally {
  await client.close();
}

console.log(failures === 0 ? "\nALL LIVE TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
