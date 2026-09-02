import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const KEY = process.env.EASYPARSER_API_KEY ?? process.env.api_key;
const transport = new StreamableHTTPClientTransport(
  new URL("https://mcp.easyparser.com/mcp"),
  { requestInit: { headers: { Authorization: `Bearer ${KEY}` } } },
);
const client = new Client({ name: "remote-smoke", version: "1.0" });
await client.connect(transport);
const { tools } = await client.listTools();
console.log(`tools: ${tools.length}`);
const jobs = await client.callTool({ name: "list_bulk_jobs", arguments: { page: 1, limit: 3 } });
const d = JSON.parse(jobs.content[0].text);
console.log(`list_bulk_jobs: success=${d.success}, total=${d.meta_data?.total}`);
await client.close();
console.log("REMOTE OK");
