#!/usr/bin/env node
/**
 * Easyparser MCP server — Streamable HTTP transport.
 * Remote endpoint for Claude, ChatGPT, Gemini, Cursor and any MCP client
 * that speaks streamable HTTP.
 *
 * Auth: Authorization: Bearer <EASYPARSER_API_KEY> header per request,
 * or x-api-key header. Falls back to the server-level EASYPARSER_API_KEY
 * env var (useful for a single-tenant deployment with a built-in demo key).
 *
 * Env:
 *   PORT                 (default 3000)
 *   EASYPARSER_API_KEY   (optional fallback key)
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createEasyparserServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? "https://mcp.easyparser.com").replace(/\/$/, "");

/**
 * OAuth 2.1 discovery (RFC 9728 / RFC 8414). These documents are static:
 * they advertise the authorization server endpoints. The endpoints
 * themselves (/authorize, /token, /register) are served by the Easyparser
 * backend authorization server; until it ships, the metadata points at the
 * paths that will exist on this same public origin.
 */
const OAUTH_ENABLED = process.env.OAUTH_ENABLED === "true";

function protectedResourceMetadata(): Record<string, unknown> {
  return {
    resource: `${PUBLIC_BASE_URL}/mcp`,
    authorization_servers: [PUBLIC_BASE_URL],
    bearer_methods_supported: ["header"],
  };
}

function authorizationServerMetadata(): Record<string, unknown> {
  return {
    issuer: PUBLIC_BASE_URL,
    authorization_endpoint: `${PUBLIC_BASE_URL}/authorize`,
    token_endpoint: `${PUBLIC_BASE_URL}/token`,
    registration_endpoint: `${PUBLIC_BASE_URL}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post"],
  };
}

function extractApiKey(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  for (const h of ["x-api-key", "api-key", "apikey"]) {
    const v = req.headers[h];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return process.env.EASYPARSER_API_KEY;
}

/**
 * The 401 discovery contract (MCP authorization spec): when OAuth mode is
 * enabled, every unauthenticated request — initialize included — must
 * return 401 with a WWW-Authenticate header pointing at the protected
 * resource metadata. This is how clients like claude.ai discover that the
 * server requires OAuth. Never special-case initialize to return 200.
 */
function sendAuthRequired(res: ServerResponse): void {
  res.writeHead(401, {
    "Content-Type": "application/json",
    "WWW-Authenticate": `Bearer resource_metadata="${PUBLIC_BASE_URL}/.well-known/oauth-protected-resource/mcp"`,
  });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Authentication required." },
      id: null,
    }),
  );
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "easyparser-mcp", version: "1.3.1" }));
    return;
  }

  // OAuth discovery documents (public, no auth)
  if (url.pathname === "/.well-known/oauth-protected-resource/mcp" || url.pathname === "/.well-known/oauth-protected-resource") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
    res.end(JSON.stringify(protectedResourceMetadata()));
    return;
  }
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
    res.end(JSON.stringify(authorizationServerMetadata()));
    return;
  }

  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. The MCP endpoint is /mcp" }));
    return;
  }

  // Read body for POST requests
  let body: unknown = undefined;
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8");
    try {
      body = raw.length > 0 ? JSON.parse(raw) : undefined;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }
  }

  const requestApiKey = extractApiKey(req);

  // OAuth mode: unauthenticated requests get the 401 discovery response.
  // API-key mode (default) keeps today's behavior: keyless requests reach
  // the tools, which return signup guidance (freemium discovery loop).
  if (OAUTH_ENABLED && !requestApiKey) {
    sendAuthRequired(res);
    return;
  }

  // Stateless mode: a fresh server+transport per request, keyed by the
  // request's API key. Simple and horizontally scalable.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createEasyparserServer({ getApiKey: () => requestApiKey });

  res.on("close", () => {
    transport.close().catch(() => undefined);
    server.close().catch(() => undefined);
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: `MCP transport error: ${err instanceof Error ? err.message : String(err)}`,
        }),
      );
    }
  }
});

httpServer.listen(PORT, () => {
  console.log(`[easyparser-mcp] Streamable HTTP server listening on port ${PORT} (endpoint: /mcp)`);
});
