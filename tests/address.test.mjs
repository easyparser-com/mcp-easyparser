/**
 * Delivery-address params: schema surface, API param mapping, validation and
 * applied_address passthrough. No network: fetch is mocked, and the stdio
 * checks fail before any API call.
 * Run: npm run build && node tests/address.test.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TOOL_DEFINITIONS } from "../dist/tools/definitions.js";
import { validateDeliveryAddress } from "../dist/schemas/common.js";
import { callEasyparser } from "../dist/client.js";

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name} ${extra}`);
    failures++;
  }
};

const ADDRESS_TOOLS = ["get_product_detail", "get_product_offers", "search_products", "get_seller_products"];
const ADDRESS_FIELDS = ["address_id", "zip_code", "city", "district", "country_code"];
const def = (name) => TOOL_DEFINITIONS.find((d) => d.name === name);

// 1. Schema surface: only the four supporting operations take address fields.
for (const d of TOOL_DEFINITIONS) {
  const shape = d.schema.shape;
  const has = ADDRESS_FIELDS.every((f) => f in shape);
  const none = ADDRESS_FIELDS.every((f) => !(f in shape));
  if (ADDRESS_TOOLS.includes(d.name)) check(`${d.name} accepts address fields`, has);
  else check(`${d.name} has no address fields`, none);
}

// 2. Param mapping: fields reach the API params; absent fields stay undefined.
const cases = [
  ["get_product_detail", { asin: "B0CJB6V2L5", domain: ".com", zip_code: "10001" }],
  ["get_product_offers", { asin: "B0CJB6V2L5", domain: ".com", zip_code: "10001", condition: "new" }],
  ["search_products", { keyword: "water bottle", domain: ".com.au", zip_code: "3101", city: "KEW" }],
  ["get_seller_products", { seller_id: "A1MCYUGJD2ILFU", domain: ".com", address_id: 722 }],
];
for (const [name, raw] of cases) {
  const d = def(name);
  const input = d.schema.parse(raw);
  const params = d.toApiParams(input);
  for (const f of ADDRESS_FIELDS) {
    check(`${name} maps ${f}`, params[f] === raw[f], `expected ${raw[f]} got ${params[f]}`);
  }
}
check(
  "offers keeps condition flag with address",
  def("get_product_offers").toApiParams(def("get_product_offers").schema.parse(cases[1][1])).condition_new === true,
);
check("address_id must be a positive integer", !def("get_product_detail").schema.safeParse({ asin: "B0CJB6V2L5", address_id: 1.5 }).success);

// 3. Validation of combinations the API silently ignores.
check("no address is fine", validateDeliveryAddress({ domain: ".com" }) === null);
check("zip on .com is fine", validateDeliveryAddress({ domain: ".com", zip_code: "10001" }) === null);
check(".ae city + district is fine", validateDeliveryAddress({ domain: ".ae", city: "Abu Dhabi", district: "ADCO Compound" }) === null);
check(".com.au zip + city is fine", validateDeliveryAddress({ domain: ".com.au", zip_code: "3101", city: "KEW" }) === null);
check(".com.be rejects any address", validateDeliveryAddress({ domain: ".com.be", zip_code: "1000" }) !== null);
check(".com.be rejects address_id", validateDeliveryAddress({ domain: ".com.be", address_id: 5 }) !== null);
check("district outside .ae rejected", validateDeliveryAddress({ domain: ".com", city: "X", district: "Y" }) !== null);
check("district without city rejected", validateDeliveryAddress({ domain: ".ae", district: "Y" }) !== null);
check(".com.au zip without city rejected", validateDeliveryAddress({ domain: ".com.au", zip_code: "3101" }) !== null);

// 4. Client sends the fields and returns applied_address.
const realFetch = globalThis.fetch;
let calledUrl = null;
globalThis.fetch = async (url) => {
  calledUrl = new URL(url);
  return new Response(
    JSON.stringify({
      request_info: {
        id: "req_1",
        success: true,
        credit_used_this_request: 1,
        credits_remaining: 99,
        address: { city: null, district: null, country_code: null, zipCode: ["10001"] },
      },
      result: { detail: {} },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
try {
  const d = def("get_product_detail");
  const result = await callEasyparser("test-key", d.toApiParams(d.schema.parse(cases[0][1])));
  check("zip_code sent as query param", calledUrl?.searchParams.get("zip_code") === "10001");
  check("unset address fields not sent", !calledUrl?.searchParams.has("city") && !calledUrl?.searchParams.has("address_id"));
  check("applied_address returned", result.applied_address?.zipCode?.[0] === "10001");
} finally {
  globalThis.fetch = realFetch;
}

// 5. MCP surface: validation error comes back before any API call.
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, EASYPARSER_API_KEY: "" },
});
const client = new Client({ name: "easyparser-address-test", version: "0.1.0" });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const detail = tools.find((t) => t.name === "get_product_detail");
  check("listed schema exposes zip_code", Boolean(detail?.inputSchema?.properties?.zip_code));
  check("listed output schema exposes applied_address", Boolean(detail?.outputSchema?.properties?.applied_address));
  const r = await client.callTool({
    name: "get_product_detail",
    arguments: { asin: "B0CJB6V2L5", domain: ".com", city: "X", district: "Y" },
  });
  check("invalid address returns guidance", r.isError === true && /district only works on \.ae/.test(r.content[0].text));
} finally {
  await client.close();
}

if (failures) {
  console.log(`\n${failures} ADDRESS TEST(S) FAILED`);
  process.exit(1);
}
console.log("\nALL ADDRESS TESTS PASSED");
