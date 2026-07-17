# AI Assistant Feature Plan — Store Chatbot (Admin + Cashier)

**Status:** Proposed (not yet implemented)
**Date:** 2026-07-15

## What we're building

Two role-scoped AI chat assistants powered by the Claude API, served by the existing
Spring Boot backend:

1. **Admin/Manager assistant** (back-office pages) — answers questions about the store
   ("how did sales do this week vs last?", "which products are running low?", "who was my
   best cashier in June?"). For analytical questions it can return a **small dashboard**
   (stat tiles + a chart + a table) rendered inline in the chat; for simple questions it
   answers in plain text.
2. **Cashier assistant** (POS screen) — a deliberately limited quick-lookup bot:
   "how many Coke 12 oz have we got left?", "how many of item 5566 remaining?",
   "what's the total sales for the day?". Short factual answers only. No reports, no
   management data, no other stores.

Both use the same mechanism: **Claude tool use (function calling)**. The model never
touches the database — it calls a fixed allowlist of tools, and each tool is a thin,
store-scoped wrapper around existing service/repository methods. The backend runs the
tool loop and returns the final answer.

---

## Architecture

```
pos-frontend (chat UI)                      pos-backend
┌───────────────────────┐   POST /api/v1/assistant/chat   ┌──────────────────────────────┐
│ AdminChatPanel        │ ──────────────────────────────► │ module/assistant             │
│ PosChatWidget         │   { messages: [...] }           │  AssistantController         │
│ (renders text +       │ ◄────────────────────────────── │  AssistantService (tool loop)│
│  dashboard blocks)    │   ApiResponse<ChatResponse>     │  AssistantTools (allowlist)  │
└───────────────────────┘                                 │        │ calls existing       │
                                                          │        ▼ services             │
                                                          │  ReportService, Inventory-   │
                                                          │  Service, SaleService, ...   │
                                                          └───────────┬──────────────────┘
                                                                      │ Anthropic Java SDK
                                                                      ▼
                                                              Claude API (api.anthropic.com)
```

### New backend module: `com.mart.module.assistant`

- `AssistantController` — `POST /assistant/chat` with `@PreAuthorize` per role.
  Two endpoints (or one endpoint that branches on the caller's role):
  - `/assistant/chat` — ADMIN / MANAGER / MASTER_ADMIN
  - `/assistant/pos-chat` — CASHIER (and above)
- `AssistantService` — builds the request (system prompt + role's toolset + conversation
  history from the client), runs the tool-use loop with the **Anthropic Java SDK**
  (`com.anthropic:anthropic-java`, `BetaToolRunner` or a manual loop), caps iterations
  (e.g. 5) and `max_tokens`.
- `AssistantTools` — the tool implementations. **Every tool takes `storeId` and the
  caller's role from `UserPrincipal`, never from model-provided arguments.** Tools call
  existing services only; no SQL, no repositories invoked with model-controlled filters
  beyond validated enums/dates/ids.
- Conversation state: stateless backend — the frontend sends the running message history
  each turn (same pattern as the API itself). No new tables needed for v1.

### Response contract (fits the existing `ApiResponse<T>` standard)

```json
{
  "success": true,
  "data": {
    "reply": "Sales this week are Rs. 42,300, up 12% over last week...",
    "dashboard": {
      "title": "This week vs last week",
      "tiles": [{ "label": "Revenue", "value": "Rs. 42,300", "delta": "+12%" }],
      "chart": { "type": "bar", "labels": ["Mon", "..."], "series": [{ "name": "This week", "data": [5400, ...] }] },
      "table": { "columns": ["Product", "Qty", "Revenue"], "rows": [["Coke 12oz", 84, "Rs. 6,720"]] }
    },
    "usage": { "inputTokens": 3100, "outputTokens": 420 }
  }
}
```

`dashboard` is null for plain answers. The model produces it by calling a
`render_dashboard` tool whose input schema *is* the dashboard spec — the backend
validates it and passes it through. This keeps chart generation fully structured
(no HTML/markdown parsing on the frontend).

---

## Toolsets

### Admin/Manager toolset

| Tool | Backed by | Notes |
|---|---|---|
| `get_sales_summary(period, groupBy?)` | ReportService | day/week/month/custom range; totals, tx count, avg basket |
| `get_top_products(period, limit)` | ReportService | by revenue or quantity |
| `get_inventory_status(lowStockOnly?)` | InventoryService | stock levels, low-stock list with thresholds |
| `get_product_stock(query)` | ProductService/InventoryService | by name, id, or barcode |
| `get_refund_summary(period)` | RefundService | count, value, top reasons |
| `get_expense_summary(period)` | ExpenseService | |
| `get_cashier_performance(period)` | ReportService/ShiftService | sales per cashier, shift stats |
| `get_customer_stats(period)` | CustomerService | new customers, loyalty redemptions (aggregates only — no PII lists) |
| `render_dashboard(spec)` | — | terminal tool; validated spec passed to the frontend |

MANAGER gets the same set minus anything ADMIN-only (e.g. expense summary can be
role-filtered later). System prompt instructs: *use `render_dashboard` when the user asks
for a report/comparison/breakdown; otherwise answer in one or two sentences.*

### Cashier toolset (deliberately tiny)

| Tool | Notes |
|---|---|
| `get_product_stock(query)` | name / item id / barcode → on-hand quantity + price |
| `get_todays_sales_total()` | current business day, caller's store |
| `get_price(query)` | quick price check |

System prompt: answer in one short sentence, numbers first; refuse anything outside
stock/price/today's sales ("Ask a manager on the back-office side for that."). No
dashboard tool, no customer data, no other stores, no date ranges beyond today.

### Security rules (non-negotiable, consistent with the repo's standards)

- Endpoints behind JWT + `@PreAuthorize`, like every other controller.
- Store scoping injected server-side from `UserPrincipal` — a prompt-injected
  "show me store 1" cannot cross stores because no tool accepts a storeId argument.
- Tool inputs validated (enums, date ranges capped at e.g. 1 year, limits capped at 50).
- Iteration cap + `max_tokens` cap + per-user rate limit (e.g. 20 requests/min) to bound
  cost; return a friendly error when exceeded.
- Assistant queries logged to the existing audit log (who asked what, which tools ran).
- `ANTHROPIC_API_KEY` comes from the environment (EC2 `/opt/pos/.env` + compose), never
  committed. If unset, the endpoints return 503 "assistant not configured" and the
  frontend hides the chat buttons (feature flag via a `/assistant/status` ping).

---

## Model choice & cost (current pricing, per million tokens)

| Model | Input | Output | Fit |
|---|---|---|---|
| `claude-opus-4-8` | $5 | $25 | Default recommendation for the **admin assistant** — best quality for multi-step report reasoning and dashboard building |
| `claude-sonnet-5` | $3 ($2 intro to 2026-08-31) | $15 ($10 intro) | Middle option if admin costs need trimming |
| `claude-haiku-4-5` | $1 | $5 | **Cashier assistant** — single-tool lookups don't need frontier reasoning, and speed matters at the counter |

Rough per-query economics (typical query ≈ 2–4K input tokens including tool definitions
and one or two tool results, ≈ 300–800 output tokens):

- **Admin query on Opus 4.8:** ~$0.02–0.06 → even 100 admin queries/day ≈ **$2–6/day worst case**, realistically far less for a demo.
- **Cashier query on Haiku 4.5:** well under **$0.01**.
- **Prompt caching** (system prompt + tool definitions marked `cache_control: ephemeral`)
  cuts repeat input cost ~90%. Note Haiku 4.5's minimum cacheable prefix is 4096 tokens,
  so the cashier bot's small prompt may not cache — that's fine at Haiku prices.

The model IDs and per-role model selection live in `application.yml`
(`assistant.admin-model`, `assistant.cashier-model`) so they're swappable without code
changes. My recommendation: **Opus 4.8 for admin, Haiku 4.5 for cashier** — but this is
a cost/quality dial you own; dropping admin to Sonnet 5 is a config change.

Java SDK dependency:

```xml
<dependency>
    <groupId>com.anthropic</groupId>
    <artifactId>anthropic-java</artifactId>
    <version>2.34.0</version>
</dependency>
```

---

## Frontend

### Admin chat (pos-frontend, dashboard pages)

- Floating chat button (bottom-right) on back-office pages → slide-in panel.
- Renders `reply` as text; when `dashboard` is present, renders it above/with the reply:
  - **Tiles** — existing Tailwind card style.
  - **Chart** — one small bar/line component (either add `recharts`, or hand-rolled
    Tailwind bars for v1 to avoid a new dependency).
  - **Table** — existing table styling.
- Keeps history in a Zustand store for the session; "clear chat" resets.

### Cashier chat (POS screen)

- A "Ask" quick-action button alongside Price Check — opens a compact modal with a large
  input (barcode-scanner friendly: scanning into the chat box should work since scanners
  type + Enter) and big touch targets.
- Answers render as one large-text line, optimized for glanceability.
- **Online-required**: the assistant is exempt from offline-capability (like email
  receipts already are); the button greys out when offline. Add `/api/v1/assistant` to
  the PWA `NetworkOnly` route list in `vite.config.ts`.

---

## Build phases

1. **Backend core** — assistant module, Java SDK wiring, admin toolset (sales summary,
   inventory, top products, product stock), tool loop, security caps. Verify via curl.
2. **Admin chat UI** — chat panel + text answers, then `render_dashboard` + tile/chart/
   table rendering.
3. **Cashier bot** — limited toolset endpoint + POS modal widget on Haiku 4.5.
4. **Hardening/polish** — rate limiting, audit logging, prompt caching markers,
   usage logging (token counts per query for cost visibility), optional SSE streaming
   for the admin panel.

Estimated new code: ~1 controller, 1 service, ~10 tool methods (mostly delegating to
existing services), 2 frontend components. No schema changes for v1.

## Deployment notes

- Add `ANTHROPIC_API_KEY` (and optionally `ASSISTANT_ENABLED=true`) to `/opt/pos/.env`
  on the EC2 box; pass through in `docker-compose.prod.yml`.
- Outbound HTTPS to `api.anthropic.com` from EC2 — allowed (no egress restrictions).
- No CloudFront changes needed: `/api/v1/assistant/*` already routes through the
  existing `/api/*` behavior. If SSE streaming is added later, that behavior already has
  `OriginReadTimeout: 60`; long streams may need it raised.

## Open decisions (owner: you)

1. Admin model: Opus 4.8 (recommended) vs Sonnet 5 (cheaper).
2. Chart rendering: add `recharts` (~nicer) vs Tailwind-only bars (zero new deps).
3. Should MANAGER get the full admin toolset or a reduced one in v1?
4. Demo users: should `demo.admin` have the assistant enabled (each customer demo query
   costs real money — a per-user daily cap, e.g. 30 queries, is cheap insurance)?
