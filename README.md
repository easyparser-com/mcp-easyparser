# easyparser-mcp

<div align="center">
  <br>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://easyparser.com/assets/svg/logos/logo-white-2.svg">
    <img alt="Easyparser" src="https://easyparser.com/assets/svg/logos/logo.svg" width="260">
  </picture>
  <br><br>
</div>
The official **Easyparser MCP server** — give your AI agent real-time, structured Amazon data across 21 marketplaces through the [Model Context Protocol](https://modelcontextprotocol.io).

Product details, seller offers, search results, 12-month sales history, Best Sellers Rank, package dimensions, seller legal identities, catalogs, and feedback — 10 operations, one connection.

## What your agent can do

**Product data**

| Tool | What it returns | Cost |
|---|---|---|
| `get_product_detail` | Full product profile: title, price, images, rating, BSR, variants, reviews | 1 credit (+1 with A+ content) |
| `get_product_offers` | Every seller offer: prices, conditions, FBA/FBM, Buy Box winner | 1 credit per page (max 5) |
| `get_bestseller_rank` | Current Best Sellers Rank by category | 1 credit |
| `get_package_dimensions` | Exact dimensions, weight, Amazon fee category | 1 credit |
| `get_sales_history` | 12-month weekly trends: views, sales, price, BSR | 5 credits + 1 per month of history (max 17) |

**Search & discovery**

| Tool | What it returns | Cost |
|---|---|---|
| `search_products` | Keyword/category results with prices, ratings, badges | 1 credit per page (max 5) |
| `lookup_product` | UPC/EAN/GTIN/ISBN → ASIN conversion | 1 credit |

**Seller intelligence**

| Tool | What it returns | Cost |
|---|---|---|
| `get_seller_profile` | Seller legal name, address, 30/90/365-day feedback trends | 1 credit |
| `get_seller_products` | A seller's full catalog with prices and ratings | 1 credit per page (max 5) |
| `get_seller_feedback` | Individual buyer feedback, filterable by rating/period | 1 credit per page (max 5) |

**Bulk job monitoring** — tracks jobs started from the [web app](https://app.easyparser.com/bulk-requests) or the Bulk API

| Tool | What it returns | Cost |
|---|---|---|
| `list_bulk_jobs` | Your bulk jobs with progress: status, completed/failed/invalid counts | Free |
| `get_bulk_job_items` | Per-item outcomes inside a job (debug failed/invalid items) | Free |
| `get_bulk_item_result` | The parsed data an item produced (retained 24 hours) | Free |
| `get_bulk_webhook_logs` | Webhook delivery logs for job completions | Free |

**Account & discovery**

| Tool | What it returns | Cost |
|---|---|---|
| `list_operations` | Operations catalog with parameters, costs, and supported domains — works **without** a key | Free |
| `check_credits` | Plan, credit balance, rate limits, and this month's daily usage by operation | Free |

## Get your API key

Sign up at [app.easyparser.com/signup](https://app.easyparser.com/signup) — free tier included, no credit card required. Copy your key from **Account → Plan**.

## Setup

### Remote server (hosted — no install)

Connect directly to the hosted Streamable HTTP endpoint:

**Claude Code**

```bash
claude mcp add --scope user --transport http easyparser https://mcp.easyparser.com/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

**Any client that reads `.mcp.json`**

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

`x-api-key: YOUR_API_KEY` works as an alternative header. The `list_operations` discovery tool works without a key, so agents can explore before signing up.

### Local (stdio via npx)

**Claude Code**

```bash
claude mcp add --scope user easyparser -- npx -y easyparser-mcp
claude mcp add-env easyparser EASYPARSER_API_KEY YOUR_API_KEY
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "easyparser": {
      "command": "npx",
      "args": ["-y", "easyparser-mcp"],
      "env": { "EASYPARSER_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "easyparser": {
      "command": "npx",
      "args": ["-y", "easyparser-mcp"],
      "env": { "EASYPARSER_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

**VS Code** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "easyparser": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "easyparser-mcp"],
      "env": { "EASYPARSER_API_KEY": "YOUR_API_KEY" }
    }
  }
}
```

**Windsurf** — same stdio pattern in your Windsurf MCP configuration.

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
amazon.de — prices, ratings, and which ones are Prime.
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

MIT — see [LICENSE](LICENSE).
