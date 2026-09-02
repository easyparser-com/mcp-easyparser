import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const KEY = process.env.EASYPARSER_API_KEY ?? process.env.api_key;
const transport = new StreamableHTTPClientTransport(
  new URL("https://mcp.easyparser.com/mcp"),
  { requestInit: { headers: { Authorization: `Bearer ${KEY}` } } },
);
const client = new Client({ name: "remote-credits", version: "1.0" });
await client.connect(transport);
const r = await client.callTool({ name: "check_credits", arguments: {} });
const d = JSON.parse(r.content[0].text);
console.log(`plan: ${d.plan}, remaining: ${d.credits_remaining}, month_total: ${d.current_month_usage?.month_total}`);
await client.close();
console.log("REMOTE CREDITS OK");
