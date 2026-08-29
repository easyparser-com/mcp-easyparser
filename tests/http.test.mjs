/**
 * HTTP transport test: starts the Streamable HTTP server, connects with an
 * MCP client over HTTP, verifies auth header passing and a live tool call.
 * Run: node tests/http.test.mjs
 */
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const PORT = 3939;
const KEY = process.env.EASYPARSER_API_KEY ?? process.env.api_key;

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name} ${extra}`);
    failures++;
  }
};

const serverProc = spawn("node", ["dist/http.js"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"],
});
serverProc.stderr.on("data", (d) => process.stderr.write(d));
await new Promise((r) => setTimeout(r, 1500));

try {
  // Health endpoint
  const health = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json());
  check("health endpoint", health.status === "ok");

  // MCP over HTTP with Bearer key
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${PORT}/mcp`),
    KEY
      ? { requestInit: { headers: { Authorization: `Bearer ${KEY}` } } }
      : undefined,
  );
  const client = new Client({ name: "easyparser-http-test", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  check("HTTP: 12 tools listed", tools.length === 12, `got ${tools.length}`);

  const cat = await client.callTool({ name: "list_operations", arguments: {} });
  const catalog = JSON.parse(cat.content[0].text);
  check("HTTP: list_operations works", catalog.operations?.length === 10);

  if (KEY) {
    const rank = await client.callTool({
      name: "get_bestseller_rank",
      arguments: { asin: "B0F25371FH", domain: ".com" },
    });
    const data = JSON.parse(rank.content[0].text);
    check(
      "HTTP: live call with Bearer key",
      rank.isError !== true && data.success === true,
      rank.isError ? rank.content[0].text.slice(0, 150) : "",
    );
    console.log(`      credits_remaining: ${data.credits_remaining}`);
  } else {
    console.log("SKIP  HTTP live call (no key)");
  }

  await client.close();
} catch (err) {
  console.error("FATAL", err);
  failures++;
} finally {
  serverProc.kill();
}

console.log(failures === 0 ? "\nALL HTTP TESTS PASSED" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
