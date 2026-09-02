/**
 * OAuth 2.1 discovery contract tests.
 * Verifies: well-known endpoints, 401 contract in OAuth mode,
 * and that default (API-key) mode is unchanged.
 */
import { spawn } from "node:child_process";

const PORT = 3941;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0;
let failed = 0;

function check(name, cond, detail = "") {
  if (cond) { passed++; console.log(`PASS  ${name}`); }
  else { failed++; console.log(`FAIL  ${name} ${detail}`); }
}

async function startServer(env = {}) {
  const proc = spawn("node", ["dist/http.js"], {
    env: { ...process.env, PORT: String(PORT), ...env },
    stdio: "pipe",
  });
  await new Promise((r) => setTimeout(r, 1500));
  return proc;
}

const INIT = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
const HEADERS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

// --- Mode 1: default (API-key mode) ---
let srv = await startServer();

let r = await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`);
let j = await r.json();
check("well-known protected-resource returns 200", r.status === 200);
check("resource field correct", j.resource === "https://mcp.easyparser.com/mcp", JSON.stringify(j));
check("authorization_servers present", Array.isArray(j.authorization_servers) && j.authorization_servers[0] === "https://mcp.easyparser.com");

r = await fetch(`${BASE}/.well-known/oauth-authorization-server`);
j = await r.json();
check("well-known authorization-server returns 200", r.status === 200);
check("issuer correct", j.issuer === "https://mcp.easyparser.com");
check("PKCE S256 declared", j.code_challenge_methods_supported?.includes("S256"));
check("refresh_token grant declared", j.grant_types_supported?.includes("refresh_token"));
check("registration endpoint declared", j.registration_endpoint === "https://mcp.easyparser.com/register");

// Default mode: unauthenticated initialize must NOT 401 (freemium loop preserved)
r = await fetch(`${BASE}/mcp`, { method: "POST", headers: HEADERS, body: INIT });
check("default mode: unauthenticated initialize returns 200", r.status === 200, `got ${r.status}`);
check("default mode: no WWW-Authenticate header", !r.headers.get("www-authenticate"));

srv.kill();
await new Promise((r2) => setTimeout(r2, 500));

// --- Mode 2: OAuth enabled ---
srv = await startServer({ OAUTH_ENABLED: "true" });

r = await fetch(`${BASE}/mcp`, { method: "POST", headers: HEADERS, body: INIT });
check("oauth mode: unauthenticated initialize returns 401", r.status === 401, `got ${r.status}`);
const wwwAuth = r.headers.get("www-authenticate") ?? "";
check(
  "oauth mode: WWW-Authenticate points at resource metadata",
  wwwAuth.includes('resource_metadata="https://mcp.easyparser.com/.well-known/oauth-protected-resource/mcp"'),
  wwwAuth,
);
j = await r.json();
check("oauth mode: 401 body is JSON-RPC error", j?.error?.code === -32000);

// Authenticated request still works in OAuth mode (any non-empty credential
// passes the gate; the Easyparser API validates it downstream)
r = await fetch(`${BASE}/mcp`, {
  method: "POST",
  headers: { ...HEADERS, Authorization: "Bearer test-credential-present" },
  body: INIT,
});
check("oauth mode: authenticated initialize returns 200", r.status === 200, `got ${r.status}`);

// Health endpoint unaffected
r = await fetch(`${BASE}/health`);
check("health endpoint unaffected by oauth mode", r.status === 200);

srv.kill();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
