# AI Assistant Feature Plan — Store Chatbot (Admin + Cashier)

**Status:** ✅ Built & verified end-to-end (admin + cashier) against the live AWS gateway (2026-07-17)
**Updated:** 2026-07-17 — grounded in the actual codebase; the LLM gateway is now
**live in AWS**, so deployment is a wiring exercise, not a build. Admin answers ship
**text-first** (inline dashboards are a later phase).

## Gateway contract — VERIFIED against the live instance (2026-07-17)

Probed `http://3.81.99.148:8080/api-docs` ("Secure LLM API Gateway"). Confirmed:

- **Auth.** API keys authenticate via the **`X-API-Key`** header (verified — `Authorization:
  Bearer <key>` is rejected; the Bearer scheme is only for login JWTs from
  `POST /api/v1/auth/token`). The POS backend uses the API key by default
  (`LLM_GATEWAY_API_KEY` → `X-API-Key`), and falls back to a static JWT or username/password
  login if no key is set.
- **Chat is TEXT-ONLY** — `ChatRequest = {provider, model, systemPrompt(≤2000),
  userMessage(≤8000), history[{role,content}]}`. **No `tools` field** → the adaptive design
  resolves to the **context-injection strategy** (the guaranteed path). Tool-loop stays a
  future item, gated on a gateway upgrade.
- **Model allow-list:** for `ANTHROPIC` the gateway currently allows only
  `claude-haiku-4-5-20251001` (Opus is rejected). **Both assistants run on Haiku** — fine
  for grounded Q&A over an injected snapshot. This overrides the earlier Opus default.
- **Response** carries `content` + `usage{promptTokens,completionTokens,totalTokens}` for
  cost/audit visibility.

---

## Goal & guarantees

Two role-scoped chat assistants, both served by the existing `pos-backend`, both routing
every LLM call through the owner's **live LLM API Gateway** (API-key auth, rate limiting,
input/output scanning, token/audit logging). Hard guarantees, enforced in the backend:

1. **Answers only from store data.** The model never has free knowledge access to the
   store — it can only obtain facts by calling a fixed allowlist of **read-only tools**
   (or, in the text-only fallback, from a backend-built data snapshot). If a question
   can't be answered from those tools, the assistant says so.
2. **Store isolation.** `storeId` and `role` are taken from the JWT `UserPrincipal` and
   **injected into every tool call** — model-supplied scoping args are ignored. A cashier
   or admin can never read another store's data through the assistant.
3. **Read-only.** No tool mutates anything. No sells, refunds, price changes, user edits.
4. **Role separation.** Admin/manager get analytical tools; cashiers get three narrow
   lookups and one-line answers.

---

## Architecture

```
pos-frontend (one app, two surfaces)      pos-backend                         LLM Gateway (LIVE, AWS)
┌──────────────────────────┐  POST /assistant/chat      ┌──────────────────┐  POST {gw}/chat   ┌───────────────┐
│ AdminLayout → ChatPanel  │ ─────────────────────────► │ assistant module │ ────────────────► │ key auth       │
│ PosLayout   → PosChat    │  POST /assistant/pos-chat  │  ├ Controller     │                   │ rate limit     │ ─► Claude API
│                          │ ◄───────────────────────── │  ├ Service (loop) │ ◄──────────────── │ in/out scan    │
└──────────────────────────┘  ApiResponse<ChatResponse> │  ├ GatewayClient  │  text (+toolCalls)│ token audit    │
                                                        │  └ ToolRegistry   │                   └───────────────┘
                                                           │ tools = store-scoped wrappers
                                                           ▼
                                    ReportService · InventoryService · ProductService (existing, unchanged)
```

Both chat surfaces live in the **same** `pos-frontend` app (admin pages under
`AdminLayout`, POS under `PosLayout`), so this is two small UI entry points sharing one
`assistantService.ts`, plus one backend module.

---

## Gateway integration — discover, then adapt ("figure it out and apply")

We do **not** assume the gateway's contract. The `GatewayClient` is built behind an
interface with a **capability probe** run once at startup (and cached):

- **Step 0 (wiring):** hit the gateway's OpenAPI/Swagger (or a probe request) using the
  configured `LLM_GATEWAY_URL` + `LLM_GATEWAY_API_KEY` to determine whether the chat
  endpoint accepts `tools` / returns `stopReason` + `toolCalls`.
- **If tool-use passthrough is supported →** `ToolLoopStrategy`: send tool definitions,
  execute requested tools server-side, loop (≤5 iterations) until `end_turn`. This is the
  preferred path — the model retrieves exactly the data it needs.
- **If the gateway is still text-only →** `ContextInjectionStrategy` (the guaranteed
  fallback, works against any text chat API):
  - **Admin:** backend precomputes a compact JSON snapshot for the store (today's/period
    totals, low-stock list, top products, payment split) and puts it in the system prompt;
    the model answers strictly from that snapshot. For the common questions this covers
    ~everything; broader questions get "I don't have that data."
  - **Cashier:** backend does its own product/barcode retrieval + today's total, injects
    matches into the prompt.

Both strategies implement the same `AssistantStrategy` interface, so the controller,
prompts, caps, and UI are identical regardless of which the live gateway supports. The
strategy is chosen automatically from the probe (overridable via config
`assistant.mode: auto|tools|context`).

> **What I need from you to wire it (build phase, not now):** the gateway **base URL**,
> the **auth header format** (e.g. `Authorization: Bearer <key>` vs `X-API-Key`), and an
> **org API key** for the POS backend. Provide the key as a server **env var** — never
> pasted into the repo or chat. If the gateway has Swagger, its URL is enough for me to
> read the exact request/response shape and finalize the mapping.

---

## Backend — new module `com.mart.module.assistant`

```
module/assistant/
├── controller/AssistantController.java     POST /assistant/chat, POST /assistant/pos-chat
├── dto/ChatRequest.java                    { message, history[] }
├── dto/ChatResponse.java                   { reply, usedTools[], (later) dashboard }
├── service/AssistantService.java           orchestrates the chosen AssistantStrategy
├── service/strategy/AssistantStrategy.java + ToolLoopStrategy + ContextInjectionStrategy
├── gateway/GatewayClient.java              thin HTTP client (RestClient) + capability probe
├── gateway/dto/*                           request/response records mirroring the gw contract
├── tool/ToolRegistry.java                  name → (schema, handler) allowlist per role
├── tool/AdminTools.java  tool/CashierTools.java   wrappers over existing services
└── config/AssistantProperties.java         @ConfigurationProperties("assistant")
```

**Endpoints** (JWT + `@PreAuthorize`, mirroring existing controllers):
- `POST /assistant/chat` — `hasAnyRole('MASTER_ADMIN','ADMIN','MANAGER')`
- `POST /assistant/pos-chat` — `hasAnyRole('MASTER_ADMIN','ADMIN','MANAGER','CASHIER')`
- Both read `storeId`/`role` from `@AuthenticationPrincipal UserPrincipal` and return the
  standard `ApiResponse<ChatResponse>`.

**Tools → existing services (all already store-scoped, first arg `storeId`):**

| Tool (admin/manager) | Backs onto |
|---|---|
| `get_sales_summary(from,to)` | `ReportService.getSalesSummary` |
| `get_profit_loss(from,to)` | `ReportService.getProfitLoss` |
| `get_top_products(from,to,limit)` | `ReportService.getTopProducts` |
| `get_payment_breakdown(from,to)` | `ReportService.getPaymentBreakdown` |
| `get_cashier_performance(from,to)` | `ReportService.getCashierPerformance` |
| `get_category_sales(from,to)` | `ReportService.getCategorySales` |
| `get_low_stock()` | `InventoryService.getLowStock` |
| `get_product_stock(query|barcode)` | `ProductService.getProductByBarcode`/search → `InventoryService.getStockByProduct` |

| Tool (cashier) | Backs onto |
|---|---|
| `get_product_stock(query)` | product search → `InventoryService.getStockByProduct` |
| `get_price(query)` | `ProductService` lookup |
| `get_todays_sales_total()` | `ReportService.getSalesSummary` (today) |

Tool arg rules: `storeId` injected from principal (never from model); date args parsed
like `ReportController` (ISO-8601 `Instant`); `limit` capped; free-text `query` length-capped.

**Guardrails / abuse control:**
- Per-user **daily query cap** (config, default 50) — a second layer beneath the gateway's
  own Redis rate limit.
- Max tool-loop iterations = 5; `maxTokens` capped server-side.
- Every assistant call written to the existing **audit log** (user, role, question,
  tools used, token counts returned by the gateway).
- If `LLM_GATEWAY_URL` is absent → endpoints return `503` and the UI hides the chat
  button (feature flag via presence of config).

**Config (`application.yml`):**
```yaml
assistant:
  gateway-url: ${LLM_GATEWAY_URL:}          # absent → feature disabled
  gateway-api-key: ${LLM_GATEWAY_API_KEY:}
  auth-header: ${LLM_GATEWAY_AUTH_HEADER:Authorization}   # discovered/overridable
  mode: ${ASSISTANT_MODE:auto}              # auto | tools | context
  admin-model: ${ASSISTANT_ADMIN_MODEL:claude-opus-4-8}
  cashier-model: ${ASSISTANT_CASHIER_MODEL:claude-haiku-4-5}
  max-iterations: 5
  daily-query-cap-per-user: 50
```
No new DB tables required for v1 (audit reuses the existing audit module). Optional later:
a `assistant_query_log` table if you want per-query analytics beyond the audit log.

---

## Frontend — `pos-frontend`

- **`src/services/assistantService.ts`** — `chat(message, history)` and
  `posChat(message, history)` over the shared `api` axios instance (auth + refresh already
  handled). Add `/assistant/*` to the PWA `NetworkOnly` routes (online-only).
- **Admin:** `src/components/assistant/AssistantPanel.tsx` — floating button in
  `AdminLayout`, slide-in panel, message list, **text answers** (markdown). Dashboard
  block rendering is stubbed in the response type for the later phase.
- **Cashier:** `src/components/assistant/PosAssistantModal.tsx` — compact modal launched
  from the POS bottom action bar in `PosScreen`, scanner-friendly input, large one-line
  answers.
- Uses the existing Tailwind design system; no new heavy deps for the text-first phase
  (Recharts only enters in the dashboard phase).

---

## Build phases

1. **Backend module + GatewayClient with capability probe** — `ContextInjectionStrategy`
   working end-to-end first (guaranteed against any gateway), verified via Swagger/curl
   through the full chain (POS → gateway → Claude).
2. **Admin chat UI** (text answers) wired to `/assistant/chat`.
3. **Cashier bot** — narrow toolset/snapshot on the cashier model + POS modal.
4. **Tool-loop strategy** — enabled automatically if/when the probe reports tool-use
   support (or `ASSISTANT_MODE=tools`).
5. **Hardening** — daily caps, audit entries, prompt-cache pass-through headers.
6. **Dashboards** (deferred) — `render_dashboard` terminal tool + Recharts inline block.

## Models & cost (via gateway)

| Role | Model | Rough cost/query |
|---|---|---|
| Admin | `claude-opus-4-8` (config-swappable to Sonnet 5) | ~$0.02–0.06 |
| Cashier | `claude-haiku-4-5` | < $0.01 |

## Open items for the owner (build phase)
1. Gateway **base URL + auth header + org API key** (key as env var).
2. Should the public `demo.admin` account get the assistant? (recommend yes, with the
   daily cap so demo traffic can't run up cost).
3. Admin model Opus 4.8 (default) vs Sonnet 5 — config-only.
