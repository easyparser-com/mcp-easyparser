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

function extractApiKey(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const xApiKey = req.headers["x-api-key"];
  if (typeof xApiKey === "string" && xApiKey.length > 0) return xApiKey;
  return process.env.EASYPARSER_API_KEY;
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "easyparser-mcp", version: "1.0.0" }));
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
