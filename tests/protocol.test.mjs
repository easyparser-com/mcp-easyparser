/**
 * Protocol-level smoke test: spawns the stdio server, lists tools,
 * calls list_operations (no key needed) and validates the tool surface.
 * Run: node tests/protocol.test.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env },
});

const client = new Client({ name: "easyparser-test-client", version: "0.1.0" });

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name} ${extra}`);
    failures++;
  }
};

try {
  await client.connect(transport);

  // 1. Tool listing
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  console.log(`\nRegistered tools (${tools.length}): ${names.join(", ")}\n`);

  const expected = [
    "check_credits", "get_bestseller_rank", "get_package_dimensions",
    "get_product_detail", "get_product_offers", "get_sales_history",
    "get_seller_feedback", "get_seller_products", "get_seller_profile",
    "list_operations", "lookup_product", "search_products",
  ];
  check("12 tools registered", tools.length === 12, `got ${tools.length}`);
  for (const e of expected) check(`tool present: ${e}`, names.includes(e));

  // 2. Annotations
  const detail = tools.find((t) => t.name === "get_product_detail");
  check("readOnlyHint annotation", detail?.annotations?.readOnlyHint === true);
  check(
    "description mentions cheaper alternatives",
    detail?.description?.includes("get_product_offers") === true,
  );

  // 3. list_operations without API key
  const catResult = await client.callTool({ name: "list_operations", arguments: {} });
  const catalog = JSON.parse(catResult.content[0].text);
  check("list_operations returns 10 operations", catalog.operations?.length === 10);
  check("list_operations returns domains", Array.isArray(catalog.supported_domains) && catalog.supported_domains.length === 21);
  check("list_operations not flagged as error", catResult.isError !== true);

  // 4. Mutex validation (asin + url together must fail gracefully)
  const mutexResult = await client.callTool({
    name: "get_product_detail",
    arguments: { asin: "B0CJB6V2L5", url: "https://www.amazon.com/dp/B0CJB6V2L5", domain: ".com" },
  });
  check(
    "mutex violation returns guidance",
    mutexResult.isError === true && /either/i.test(mutexResult.content[0].text),
  );

  // 5. Missing key guidance (only when no key in env)
  if (!process.env.EASYPARSER_API_KEY) {
    const noKey = await client.callTool({
      name: "get_bestseller_rank",
      arguments: { asin: "B0F25371FH", domain: ".com" },
    });
    check(
      "missing key returns signup guidance",
      noKey.isError === true && /signup/i.test(noKey.content[0].text),
    );
  } else {
    console.log("SKIP  missing-key test (EASYPARSER_API_KEY is set)");
  }

  // 6. Schema validation: bad ASIN rejected
  try {
    const badAsin = await client.callTool({
      name: "get_bestseller_rank",
      arguments: { asin: "not-an-asin", domain: ".com" },
    });
    check("invalid ASIN rejected", badAsin.isError === true);
  } catch {
    check("invalid ASIN rejected", true);
  }
} catch (err) {
  console.error("FATAL", err);
  failures++;
} finally {
  await client.close();
}

console.log(failures === 0 ? "\nALL PROTOCOL TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
