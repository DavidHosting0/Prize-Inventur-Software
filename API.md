# API — Prize by Radisson

Base path: `/api/v1`  
Auth: session cookie (Auth.js) **or** `Authorization: Bearer <mobile JWT>` from `/auth/mobile-login`. Unauthorized → `401`. Forbidden → `403`.

## Session

JWT / session user includes:

| Field | Type | Notes |
|-------|------|--------|
| `accountType` | `GROUP` \| `HOTEL` | Account kind |
| `organizationId` | string | Always set |
| `hotelId` | string \| **null** | HOTEL: always assigned hotel. GROUP: null = group mode; set when entered a hotel |
| `permissions` | string[] | Role permissions |

## Hotel context & switch

| Method | Path | Notes |
|--------|------|--------|
| GET | `/hotels` | List accessible hotels; returns `accountType`, `canSwitch`, `currentHotelId` |
| POST | `/hotels` | Body `{ hotelId: string \| null }` |

- **HOTEL:** cannot switch (`403` `HOTEL_FORBIDDEN` if `hotelId` ≠ assigned). Cannot clear context.
- **GROUP:** set `hotelId` to enter an authorized hotel, or `null` to return to group mode. Client must call `session.update({ hotelId })` afterward.

Hotel-scoped routes call `requireHotelContext` — GROUP users in group mode (`hotelId` null) get `403` until they enter a hotel.

## Inventory notes

- Each hotel has one central **Lager** (`LAGER`). Stock endpoints and ops that accept `warehouseId` treat it as optional; the server resolves central Lager via `getCentralWarehouse`.
- Transfers are **disabled**.

## Group APIs (`requireGroupAccount`)

All under `/api/v1/group/*`. Require `accountType === GROUP`.

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/group/dashboard` | dashboard.view | Org KPIs across accessible hotels |
| GET | `/group/analytics` | analytics.view | `?days=` (7–90, default 30) |
| GET | `/group/hotels` | hotels.view | Accessible hotels in org |
| POST | `/group/hotels` | hotels.manage | Create hotel + central Lager |
| GET | `/group/users` | users.view | Org users + roles + hotel links |
| GET | `/group/permissions` | permissions.view | Roles by scope + permission codes |
| GET | `/group/audit-logs` | audit.view | Org-scoped; optional `?hotelId=` |
| GET | `/group/integrations` | ai_config.view | Org integrations (secrets masked) |
| PUT | `/group/integrations` | ai_config.manage | Upsert provider/purpose; optional `apiKey` |

## Implemented (hotel-scoped)

Hotel-scoped routes use `requireHotelContext` (unless noted). Paths relative to `/api/v1`.

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET/POST | `/auth/*` | — | NextAuth handlers |
| POST | `/auth/mobile-login` | — | Mobile JWT (`accessToken` + `user`) |
| GET | `/dashboard/summary` | dashboard.view | KPIs + charts |
| GET/POST | `/products` | products.view / create | List + create |
| GET/PATCH/DELETE | `/products/:id` | products.* | Soft-delete via DELETE |
| POST | `/products/:id/image` | products.edit | JPEG/PNG/WebP upload |
| GET | `/products/barcode/:code` | products.view | 404 BARCODE_UNKNOWN |
| GET | `/categories` | session | |
| GET | `/warehouses` | stock.view | Returns central Lager (and any inactive legacy rows) |
| GET/POST | `/stock` | stock.view / adjust | Manual adjust on central Lager |
| GET/POST | `/sales` | pos.sell | Create PENDING; `warehouseId` optional; vouchers/manual/free discounts need `pos.discount` |
| GET/POST | `/sales/:id` | pos.* | actions: pay (`CASH\|CARD\|TWINT\|OFFLINE\|OTHER` + reference), cancel, refund |
| GET | `/pos/bootstrap` | pos.sell | Catalog + voucher presets |
| GET/POST | `/inventory-counts` | inventory.* | Counts against central Lager |
| GET/POST | `/inventory-counts/:id` | inventory.* | actions: count, close |
| GET/POST | `/cash-sessions` | cash.close | |
| GET | `/search?q=` | search.use | |
| GET | `/audit-logs` | audit.view | Hotel-scoped |
| GET/POST | `/suppliers` | suppliers.view / manage | |
| PATCH | `/suppliers/:id` | suppliers.manage | |
| GET/POST | `/goods-receipts` | receiving.* | Receiving into central Lager; `warehouseId` optional |
| GET/POST | `/goods-receipts/:id` | receiving.* | confirm |
| GET/POST | `/delivery-note-scans` | receiving.view / create | List + create scan |
| GET/PATCH | `/delivery-note-scans/:id` | receiving.view / create | Detail / update |
| POST | `/delivery-note-scans/:id/pages` | receiving.create | Upload page image |
| POST | `/delivery-note-scans/:id/process` | receiving.create | OCR (org AI config, `OPENAI_API_KEY` fallback) |
| POST | `/delivery-note-scans/:id/confirm` | receiving.confirm | Confirm → goods receipt |
| GET/POST | `/transfers` | — | **410** `TRANSFERS_DISABLED` (single Lager) |
| GET/POST | `/waste` | waste.* | Against central Lager; `warehouseId` optional |
| GET/POST | `/purchase-orders` | orders.* | + suggestions |
| GET/POST | `/recipes` | recipes.* | |
| GET/POST | `/users` | users.manage | |
| GET/POST | `/breakfast` | inventory.edit | |
| GET/POST | `/minibar` | stock.adjust | **no room charge**; stock from central Lager |
| GET/PATCH | `/notifications` | dashboard.view | |
| GET | `/reports/summary` | reports.view | JSON / CSV |
| GET | `/reports/export` | reports.view | `format=xlsx\|pdf` |
| GET/PATCH | `/settings` | settings.manage | |
| GET/POST | `/hotels` | session | List / switch active hotel (see above) |

## Conventions

- JSON bodies validated with Zod
- Errors: `{ error, code? }`
- Tenant scoping: `organizationId` + `accountType`; hotel ops via `requireHotelContext`
- Stock changes only via `applyStockChange` + `InventoryMovement` on central Lager
