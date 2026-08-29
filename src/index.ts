#!/usr/bin/env node
/**
 * Easyparser MCP server — stdio transport.
 * Used by Claude Desktop, Cursor, VS Code, Windsurf via npx.
 *
 * Config: EASYPARSER_API_KEY environment variable.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createEasyparserServer } from "./server.js";

const apiKey = process.env.EASYPARSER_API_KEY;

const server = createEasyparserServer({
  getApiKey: () => process.env.EASYPARSER_API_KEY,
});

if (!apiKey) {
  console.error(
    "[easyparser-mcp] Warning: EASYPARSER_API_KEY is not set. Data tools will return signup guidance; list_operations still works. Get a free key at https://app.easyparser.com/signup",
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[easyparser-mcp] Server running on stdio.");
