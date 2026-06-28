# Retail Management Ecosystem — Project Context

## What This Actually Is

This is NOT a single POS application.

This is a **multi-system retail management ecosystem** for convenience stores — built as separate
deployable applications that share one backend API. Think of it like how Shopify has a storefront,
an admin panel, and a POS app — all separate systems, all talking to the same backend.

The ecosystem is designed to eventually run as a SaaS platform for multiple store owners,
starting with a single store deployment and scaling to unlimited stores without architectural changes.

---

## The Full Ecosystem — 4 Systems

### 1. `pos-frontend` — Cashier POS App (React)
**Who uses it:** Cashiers at the physical store counter
**Device:** Dedicated touchscreen terminal or tablet
**Key traits:**
- Offline-capable — must work even if internet drops
- PIN-based login (4-6 digit PIN, not email/password)
- Optimized for speed — every interaction must be < 1 second
- Large touch targets, minimal typing
- Barcode scanner input support
- Cannot access any management features

**Features:**
- Product scan / search / manual entry
- Cart management (add, remove, quantity, hold, resume)
- Discount application (cashier ≤5%, manager approval >5%)
- Cash + digital payment processing
- Receipt printing and email
- Void (before payment) and initiate refund (after payment)
- Loyalty points lookup and redemption
- Day open/close, shift clock in/out

---

### 2. `pos-backoffice` — Back Office + Admin App (React) [TO BE CREATED]
**Who uses it:** Store owners, admins, managers
**Device:** Desktop browser
**Key traits:**
- Full management capabilities
- Rich data tables, reports, charts
- Not time-critical — can afford slightly slower interactions
- Role-gated features (manager sees less than admin)

**Features:**
- User management (create, assign roles, set PINs)
- Product and category management
- Inventory tracking, stock adjustments, goods receiving
- Vendor and purchase order management
- Day operations (open/close, cash reconciliation)
- Shift management and employee performance
- Refund approval workflow
- Full reporting suite (sales, inventory, cashier, P&L)
- Loyalty program configuration
- Audit log viewer
- Store settings

---

### 3. `pos-api` — Shared Backend API (Spring Boot) [currently `pos-backend`]
**Who uses it:** All frontend applications
**Key traits:**
- Single Spring Boot application serving all frontends
- Modular monolith — clean domain separation, ready to split into microservices later
- All business logic lives here
- JWT authentication for browser apps, PIN auth for POS terminals
- Multi-store data isolation built in from day 1

---

### 4. Ecommerce Storefront (FUTURE — Phase 2)
**Who uses it:** End customers browsing and ordering online
**Key traits:**
- Public-facing online store
- Product catalog synced from the same inventory system
- Orders flow directly into the inventory module
- Built with Next.js for SEO
- Completely separate deployment

---

## How The Systems Relate
┌─────────────────────────────────────────────────────┐
│                                                     │
│   pos-frontend        pos-backoffice    ecommerce   │
│   (Cashier POS)       (Admin/Manager)  (Customer)   │
│   localhost:3000      localhost:3001   localhost:3002│
│                                                     │
└──────────────┬──────────────┬──────────────┬────────┘
│   REST/JWT   │              │
▼              ▼              ▼
┌─────────────────────────────────────────────────────┐
│              pos-backend (Spring Boot)              │
│              localhost:8080/api/v1                  │
│                                                     │
│  auth │ users │ stores │ products │ inventory │ ... │
└──────────────────────────┬──────────────────────────┘
│
▼
┌────────────────────────┐
│   MySQL 8.0 (pos_db)   │
└────────────────────────┘
│
▼
┌────────────────────────┐
│   AWS S3 (backups)     │
└────────────────────────┘

---

## Tech Stack (Complete)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Java 21, Spring Boot 3.3.5, Maven | Modular monolith |
| Database | MySQL 8.0 + Flyway migrations | All schema changes via migrations |
| Auth | JWT (access 15min + refresh 7days) + Spring Security | PIN auth for cashiers |
| ORM | Spring Data JPA + Hibernate | `ddl-auto: validate` — DB owns schema |
| Validation | Jakarta Bean Validation | Field-level error responses |
| API Docs | SpringDoc OpenAPI 3 / Swagger UI | `/api/v1/swagger-ui` |
| POS Frontend | React 19, TypeScript, Vite | Tailwind CSS, Zustand, TanStack Query |
| Back Office | React 19, TypeScript, Vite | Same stack as POS |
| Forms | React Hook Form + Zod | Schema-based validation |
| HTTP Client | Axios | Auto token refresh interceptor |
| State | Zustand (auth/cart) + TanStack Query (server state) | |
| Styling | Tailwind CSS | Custom green accent design system |
| UI Style | Modisoft-inspired | Dark sidebar, clean cards, touch-friendly |

---

## User Roles (4 levels)

| Role | Access |
|------|--------|
| `MASTER_ADMIN` | Everything — all stores, all settings, create admins |
| `ADMIN` | Full access to assigned store |
| `MANAGER` | Inventory, pricing (limited), reports, refund approval, cashier management |
| `CASHIER` | POS only — sell, void, basic operations |

**Important:** Cashiers log in via PIN on the POS app. All other roles log in via email+password on the back office app.

---

## Backend Module Map
com.mart/
├── common/
│   ├── audit/          — JPA auditing (createdAt, updatedAt, createdBy, updatedBy)
│   ├── config/         — SecurityConfig, JwtProperties
│   ├── constant/       — RoleConstants
│   ├── exception/      — AppException, GlobalExceptionHandler
│   ├── response/       — ApiResponse<T>, PageResponse<T>, ApiError
│   └── security/       — JwtService, JwtAuthFilter, UserPrincipal
│
└── module/
├── auth/           — Login, PIN login, refresh, logout, RefreshToken entity
├── user/           — User entity, Role entity, CRUD + PIN + password
├── store/          — Store entity, multi-store support
├── product/        — Products, barcodes, multi-unit (carton→pack→unit)
├── category/       — Product categories
├── inventory/      — Stock balances, movement log, adjustments, receiving
├── vendor/         — Vendor management
├── sales/          — POS cart, transactions, sale items
├── payment/        — Cash, digital payment methods
├── refund/         — Refund workflow, manager approval
├── loyalty/        — Customer accounts, points earn/redeem
├── shift/          — Clock in/out, day open/close, cash reconciliation
├── report/         — Sales, inventory, cashier, P&L reports
└── audit/          — Immutable action log (discounts, overrides, refunds)

---

## Database Schema (current — 4 tables)
stores ──< users >── roles
│
└──< refresh_tokens

---

## API Response Standard

Every endpoint returns:
```json
{
  "success": true | false,
  "message": "optional message",
  "data": { ... } | null,
  "error": {
    "message": "...",
    "code": "NOT_FOUND | VALIDATION_ERROR | CONFLICT | ...",
    "fieldErrors": { "field": "message" }
  },
  "timestamp": "2026-01-01T00:00:00Z"
}
```

Paginated responses wrap content in:
```json
{
  "content": [...],
  "page": 0,
  "size": 20,
  "totalElements": 100,
  "totalPages": 5,
  "last": false
}
```

---

## Key Business Rules (critical context for AI assistants)

1. **Completed transactions are immutable** — no editing or deleting sales
2. **Mistakes are corrected via void** (before payment) **or refund** (after payment)
3. **Every critical action is audit logged** — discounts, overrides, refunds, voids
4. **Negative inventory is allowed during a sale** but must be reconciled
5. **Refunds require the original receipt** and manager approval
6. **Discounts over 5% require manager PIN approval** at the POS
7. **Price overrides require manager approval** (max Rs 100 override)
8. **Loyalty points are configurable per product** (default: 5 points)
9. **Cashiers are identified by PIN + store** — not by email
10. **Multi-store is a first-class concern** — every entity is store-scoped

---

## Current Development Status

### Done
- [x] Spring Boot project setup, modular structure
- [x] Common layer (ApiResponse, exceptions, auditing, security)
- [x] Auth module (email login, PIN login, JWT rotation, logout)
- [x] User management module (CRUD, PIN, password, role-based access)
- [x] Flyway schema V1 (stores, roles, users, refresh_tokens)
- [x] Docker Compose for local MySQL dev
- [x] Frontend scaffolded (Vite + React + Tailwind design system)

### In Progress
- [ ] Frontend login page and routing
- [ ] Product & Category module (backend)

### Up Next
- [ ] Product & Category module
- [ ] Inventory module
- [ ] POS frontend — login screen, cashier PIN screen
- [ ] Back office frontend — dashboard, user management UI
- [ ] Sales / cart module
- [ ] Payment module

---

## Development Workflow

- Backend runs on `localhost:8080`
- POS frontend runs on `localhost:3000`
- Back office frontend runs on `localhost:3001` (not created yet)
- MySQL runs in Docker on `localhost:3306`
- All commands run in **WSL2** (Ubuntu on Windows)
- Git repo: `github.com/pracda/retail-shop-management`
- Branch: `master`

### Start dev environment
```bash
# Terminal 1 — start MySQL
cd "/mnt/c/Retail Shop Management/pos-backend"
docker compose up -d

# Terminal 2 — start backend
./mvnw spring-boot:run

# Terminal 3 — start POS frontend
cd "/mnt/c/Retail Shop Management/pos-frontend"
npm run dev
```

---

## What To Tell Any AI Assistant Working On This Repo

- This is a **multi-system ecosystem**, not a single app
- The backend is a **shared API** serving multiple separate frontends
- **Never suggest microservices** — the modular monolith is intentional
- Always use the **`ApiResponse<T>` wrapper** for all controller responses
- Always use **`AppException` factory methods** for error handling
- Database schema is **managed exclusively by Flyway** — never use `ddl-auto: create`
- The **POS frontend must remain offline-capable** — design with that in mind
- **Security is non-negotiable** — every endpoint needs `@PreAuthorize`, no exceptions
- **Audit logging is required** for all critical business actions

Now commit this:
WSL2:
bashcd "/mnt/c/Retail Shop Management"
git add PROJECT_CONTEXT.md
git commit -m "docs: add comprehensive project context for AI assistants and developers"
git push origin master