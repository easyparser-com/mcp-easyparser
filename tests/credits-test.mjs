import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const KEY = process.env.EASYPARSER_API_KEY ?? process.env.api_key;
const transport = new StdioClientTransport({
  command: "node", args: ["dist/index.js"],
  env: { ...process.env, EASYPARSER_API_KEY: KEY },
});
const client = new Client({ name: "credits-test", version: "0.1.0" });
await client.connect(transport);

const r = await client.callTool({ name: "check_credits", arguments: {} });
const d = JSON.parse(r.content[0].text);
console.log("isError:", r.isError ?? false);
console.log("plan:", d.plan);
console.log("credits_remaining:", d.credits_remaining);
console.log("credits_used:", d.credits_used);
console.log("reset_at:", d.credits_reset_at);
console.log("rate limits:", d.minutely_real_time_credit_limit, "/", d.minutely_bulk_credit_limit);
console.log("current month:", d.current_month_usage?.month, d.current_month_usage?.year, "total:", d.current_month_usage?.month_total);
console.log("days tracked:", d.current_month_usage?.days?.length);
console.log("sample day:", JSON.stringify(d.current_month_usage?.days?.at(-1)));
await client.close();
console.log("CREDITS TEST OK");
