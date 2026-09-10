# DATABASE — Prize by Radisson

## Engine

PostgreSQL 16+ via Prisma. Local: Docker Compose or embedded Postgres (`pnpm db:embedded` on port 54329).

## Core model (implemented)

- **Tenant:** Organization ("Prize by Radisson"), Hotel (`currency`, `locale`, `timezone`, `posSettings` voucher presets)
- **Auth:** User (`organizationId`, `accountType`), Role (`scope`), Permission, RolePermission, UserHotel
- **Integrations:** SystemIntegration (org-level; encrypted secrets)
- **Catalog:** ProductCategory, Product, Supplier, SupplierProduct
- **Stock:** Warehouse (one active **Lager** / `LAGER` per hotel), StockLevel (`quantity`, `reservedQty`), InventoryMovement
- **POS:** Sale (`discountType`, `voucherCode`, `discountReason`), SaleItem (`isComplimentary`), Payment (`CASH|CARD|TWINT|OFFLINE|OTHER`), Refund, CashRegister, CashSession
- **Counts:** InventoryCount, InventoryCountItem
- **Ops:** PurchaseOrder, PurchaseOrderItem, GoodsReceipt, GoodsReceiptItem, Recipe, RecipeItem, Waste, BreakfastRecord, MinibarRecord, DeliveryNoteScan
- **Transfers (historical):** StockTransfer, StockTransferItem — schema retained; create path disabled
- **Audit / alerts:** AuditLog (`organizationId`, `accountType`, optional `hotelId`), Notification

## Multi-tenancy

### AccountType enum

`GROUP` | `HOTEL`

### User

- `organizationId` (required FK → Organization)
- `accountType` (`AccountType`, default `HOTEL`)
- Indexes on `organizationId`, `accountType`

### Role.scope

- `Role.scope: AccountType` — `GROUP` roles vs `HOTEL` operational roles (default `HOTEL`)

### Hotel access

| Account | UserHotel | Access |
|---------|-----------|--------|
| **HOTEL** | Exactly one | Locked to that hotel; cannot switch |
| **GROUP** | Allow-list (`UserHotel` rows) **or** all org hotels via `hotels.view_all` / admin role | `hotelId` null = group mode; may enter an authorized hotel |

Helpers: `getAccessibleHotelIds`, `assertHotelAccess`, `requireHotelContext` in `apps/web/src/lib/tenant.ts`.

### SystemIntegration

Org-level AI/API config (not hotel-scoped):

- `organizationId`, `provider`, `purpose` (unique together)
- `model`, `enabled`, `settings` (JSON, non-secret)
- `secretCiphertext` / `secretIv` / `secretAuthTag` — AES-GCM encrypted secrets (never returned to clients)
- Encryption key: `INTEGRATION_SECRET_KEY` or fallback `AUTH_SECRET`

### AuditLog

- `organizationId` (nullable FK), `accountType` (nullable), `hotelId` (nullable)
- Indexes: `(hotelId, createdAt)`, `(organizationId, createdAt)`

## Single Lager inventory

- Seed creates only warehouse code `LAGER` (name "Lager").
- `StockLevel.warehouseId` remains; after migration, product stock is unambiguous (one row on LAGER).
- Operational FKs (`Sale`, `GoodsReceipt`, `InventoryCount`, movements) resolve to central Lager.
- Consolidation migration: `apps/web/prisma/migrations/20260909220000_single_lager/migration.sql`
  - Ensures LAGER exists (promotes/renames MAIN when needed)
  - Sums stock from other warehouses onto LAGER
  - Deactivates non-LAGER warehouses
  - Repoints open operational documents to LAGER

## Money & stock rules

- Money: `Decimal` — never float
- Currency: per Hotel (ISO 4217)
- Stock changes **only** via `applyStockChange` in a transaction
- Movement types: SALE, PURCHASE, INVENTORY_ADJUSTMENT, TRANSFER (legacy), WASTE, RETURN, MANUAL_ADJUSTMENT

## Indexes (key)

`hotelId`, `barcode`, `sku`, `sale(hotelId,status,createdAt)`, `stockLevel(productId,warehouseId)` unique, `auditLog(hotelId,createdAt)`, `auditLog(organizationId,createdAt)`, `user(organizationId)`, `user(accountType)`, `systemIntegration(organizationId)`

## Migrations

Versioned under `apps/web/prisma/migrations/`:

| Migration | Purpose |
|-----------|---------|
| `20260909160000_init` | Base schema |
| `20260909192000_pos_vouchers_offline` | POS vouchers / offline pay |
| `20260909220000_single_lager` | Consolidate to one LAGER per hotel |
| `20260909223000_delivery_note_scan` | Delivery-note OCR scans |
| `20260909230000_multi_tenant_org` | AccountType, User.organizationId/accountType, Role.scope, AuditLog org fields, SystemIntegration |

Use `prisma migrate deploy` for environments; `db push` only for local experimentation.

## Known schema debt

- Some older models may still carry free-form status strings — promote to enums when touching those modules
- `StockTransfer` tables remain for audit; no new transfers are created
