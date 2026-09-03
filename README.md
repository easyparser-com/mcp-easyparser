# easyparser-mcp

<div align="center">
  <br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://easyparser.com/assets/svg/logos/logo-white-2.svg">
    <img alt="Easyparser" src="https://easyparser.com/assets/svg/logos/logo.svg" width="260">
  </picture>
  <br><br>
</div>

The official **Easyparser MCP server**: give your AI agent real-time, structured Amazon data across 21 marketplaces through the [Model Context Protocol](https://modelcontextprotocol.io).

Product details, seller offers, search results, 12-month sales history, Best Sellers Rank, package dimensions, seller legal identities, catalogs, and feedback. 10 data operations plus bulk-job monitoring and account tools, one connection.

## What your agent can do

**Product data**

<table>
<thead><tr><th width="220">Tool</th><th>What it returns</th><th width="260">Cost</th></tr></thead>
<tbody>
<tr><td><code>get_product_detail</code></td><td>Full product profile: title, price, images, rating, BSR, variants, reviews</td><td>1 credit (+1 with A+ content)</td></tr>
<tr><td><code>get_product_offers</code></td><td>Every seller offer: prices, conditions, FBA/FBM, Buy Box winner</td><td>1 credit per page (max 5)</td></tr>
<tr><td><code>get_bestseller_rank</code></td><td>Current Best Sellers Rank by category</td><td>1 credit</td></tr>
<tr><td><code>get_package_dimensions</code></td><td>Exact dimensions, weight, Amazon fee category</td><td>1 credit</td></tr>
<tr><td><code>get_sales_history</code></td><td>12-month weekly trends: views, sales, price, BSR</td><td>5 credits + 1 per month of history (max 17)</td></tr>
</tbody>
</table>

**Search & discovery**

<table>
<thead><tr><th width="220">Tool</th><th>What it returns</th><th width="260">Cost</th></tr></thead>
<tbody>
<tr><td><code>search_products</code></td><td>Keyword/category results with prices, ratings, badges</td><td>1 credit per page (max 5)</td></tr>
<tr><td><code>lookup_product</code></td><td>UPC/EAN/GTIN/ISBN → ASIN conversion</td><td>1 credit</td></tr>
</tbody>
</table>

**Seller intelligence**

<table>
<thead><tr><th width="220">Tool</th><th>What it returns</th><th width="260">Cost</th></tr></thead>
<tbody>
<tr><td><code>get_seller_profile</code></td><td>Seller legal name, address, 30/90/365-day feedback trends</td><td>1 credit</td></tr>
<tr><td><code>get_seller_products</code></td><td>A seller's full catalog with prices and ratings</td><td>1 credit per page (max 5)</td></tr>
<tr><td><code>get_seller_feedback</code></td><td>Individual buyer feedback, filterable by rating/period</td><td>1 credit per page (max 5)</td></tr>
</tbody>
</table>

**Bulk job monitoring**: tracks jobs started from the [web app](https://app.easyparser.com/bulk-requests) or the Bulk API

<table>
<thead><tr><th width="220">Tool</th><th>What it returns</th><th width="260">Cost</th></tr></thead>
<tbody>
<tr><td><code>list_bulk_jobs</code></td><td>Your bulk jobs with progress: status, completed/failed/invalid counts</td><td>Free</td></tr>
<tr><td><code>get_bulk_job_items</code></td><td>Per-item outcomes inside a job (debug failed/invalid items)</td><td>Free</td></tr>
<tr><td><code>get_bulk_item_result</code></td><td>The parsed data an item produced (retained 24 hours)</td><td>Free</td></tr>
<tr><td><code>get_bulk_webhook_logs</code></td><td>Webhook delivery logs for job completions</td><td>Free</td></tr>
</tbody>
</table>

**Error logs**: the same data as the [Errors page](https://app.easyparser.com/errors) in the web app

<table>
<thead><tr><th width="220">Tool</th><th>What it returns</th><th width="260">Cost</th></tr></thead>
<tbody>
<tr><td><code>get_error_logs</code></td><td>API request errors (real-time and bulk): error code, channel, operation, the failing request params, timestamp</td><td>Free</td></tr>
</tbody>
</table>

**Account & discovery**

<table>
<thead><tr><th width="220">Tool</th><th>What it returns</th><th width="260">Cost</th></tr></thead>
<tbody>
<tr><td><code>list_operations</code></td><td>Operations catalog with parameters, costs, and supported domains. Works <strong>without</strong> a key</td><td>Free</td></tr>
<tr><td><code>check_credits</code></td><td>Plan, credit balance, rate limits, and this month's daily usage by operation</td><td>Free</td></tr>
</tbody>
</table>

## Get your API key

Sign up at [app.easyparser.com/signup](https://app.easyparser.com/signup): free tier included, no credit card required. Copy your API key from [Account → Plan](https://app.easyparser.com/account/plan). Wherever a setup step below asks for `YOUR_API_KEY`, paste this key.

## Setup

Two ways to connect: the **hosted remote server** (no install, always up to date) or **local via npx** (runs on your machine).

### <img src="https://cursor.com/favicon.ico" width="18" height="18" alt="Cursor"> Cursor

One-click install (opens Cursor with the configuration pre-filled; replace `YOUR_API_KEY` when prompted):

- **Remote server:** [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=easyparser&config=eyJ1cmwiOiJodHRwczovL21jcC5lYXN5cGFyc2VyLmNvbS9tY3AiLCJoZWFkZXJzIjp7IkF1dGhvcml6YXRpb24iOiJCZWFyZXIgWU9VUl9BUElfS0VZIn19)
- **Local (npx):** [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=easyparser&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImVhc3lwYXJzZXItbWNwIl0sImVudiI6eyJFQVNZUEFSU0VSX0FQSV9LRVkiOiJZT1VSX0FQSV9LRVkifX0%3D)

Or add manually to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "easyparser": {
      "type": "http",
      "url": "https://mcp.easyparser.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

### <img src="https://code.visualstudio.com/favicon.ico" width="18" height="18" alt="VS Code"> VS Code

One-click install (VS Code asks for your API key securely via an input prompt):

- **Remote server:** [Add to VS Code](vscode:mcp/install?%7B%22name%22%3A%22easyparser%22%2C%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A//mcp.easyparser.com/mcp%22%2C%22headers%22%3A%7B%22Authorization%22%3A%22Bearer%20%24%7Binput%3Aeasyparser-api-key%7D%22%7D%7D)

Or add manually to `.vscode/mcp.json`:

```json
{
  "servers": {
    "easyparser": {
      "type": "http",
      "url": "https://mcp.easyparser.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

### <img src="https://claude.ai/favicon.ico" width="18" height="18" alt="Claude"> Claude Code

```bash
claude mcp add --scope user --transport http easyparser https://mcp.easyparser.com/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

### <img src="https://claude.ai/favicon.ico" width="18" height="18" alt="Claude"> Claude Desktop & claude.ai

Add a custom connector:

1. Open **Settings → Connectors → Add → Add custom connector**.
2. **Name:** `Easyparser`
3. **Remote MCP server URL:** `https://mcp.easyparser.com/mcp` and click **Continue**.
4. Under **Authentication**, select **None** (Easyparser uses an API key, not OAuth).
5. Under **Request headers**, add a header: name `authorization`, value `Bearer YOUR_API_KEY`, marked **Required**.
6. Click **Add**.

### <img src="https://manus.im/favicon.ico" width="18" height="18" alt="Manus"> Manus

Go to **Settings → Integrations → Custom MCP Servers → Add Server** and fill in the form:

| Field | Value |
|---|---|
| Server name | `Easyparser` |
| Transport type | `HTTP` |
| Server URL | `https://mcp.easyparser.com/mcp` |
| Custom headers | Header name: `Authorization`, value: `Bearer YOUR_API_KEY` (paste your Easyparser API key after "Bearer ") |

Click **Test** to verify the connection, then **Save**. The value is always your Easyparser API key; no separate token is needed.

### Any MCP client

The hosted endpoint speaks [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http) at `https://mcp.easyparser.com/mcp`. Authenticate with `Authorization: Bearer YOUR_API_KEY`; the `x-api-key` and `api-key` headers work too. The `list_operations` discovery tool works without a key, so agents can explore before signing up.

For local stdio clients, run `npx -y easyparser-mcp` with `EASYPARSER_API_KEY` set in the environment.

## Example prompts

```
What is the current price and rating of ASIN B0F25371FH?
```

```
Find the ASIN for UPC 041604458187, then show me its 6-month sales trend.
```

```
Who is the seller behind this product, what is their legal business name,
and what do their negative reviews say?
```

```
Compare the top 10 organic results for "stainless steel water bottle" on
amazon.de: prices, ratings, and which ones are Prime.
```

```
Is the bulk job I started this morning finished? If any items failed,
tell me which ASINs and why.
```

## Self-hosting the HTTP server

```bash
npm install -g easyparser-mcp
PORT=3000 easyparser-mcp-http   # or: node dist/http.js from a clone
```

Or with Docker:

```bash
docker build -t easyparser-mcp .
docker run -p 3000:3000 easyparser-mcp
```

Endpoints: `POST /mcp` (MCP), `GET /health` (health check).

## How it works

This server is a thin, read-only adapter over the [Easyparser Real-Time API](https://easyparser.gitbook.io/easyparser-documentation). Tool descriptions are written for AI agents: each one states what it returns, when to use it, when a cheaper tool is better, and its credit cost. Every response includes `credits_remaining` so agents can make budget-aware decisions. Rate-limit and auth errors return actionable guidance (including the signup link) instead of raw HTTP codes.

## License

MIT. See [LICENSE](LICENSE).
