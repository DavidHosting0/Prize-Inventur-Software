# REQUIREMENTS — Prize by Radisson Inventory

## Multi-tenancy (GROUP vs HOTEL)

| Rule | Detail |
|------|--------|
| **Organization** | All hotels and users belong to one Organization (e.g. Prize by Radisson). |
| **HOTEL accounts** | Exactly one `UserHotel`. Session `hotelId` always that hotel. Cannot switch or clear hotel context. |
| **GROUP accounts** | Org-scoped. Access = `UserHotel` allow-list **or** all org hotels (`hotels.view_all` / admin). `hotelId` null = group UI; may enter an authorized hotel. |
| **Tenant isolation** | API checks `organizationId` + account type. Cross-org access forbidden. Hotel-scoped routes use `requireHotelContext`. |
| **UI** | GROUP → `/{locale}/group/*`. HOTEL / GROUP-in-hotel → existing app/terminal shells. |

## Inventory model

- **One warehouse per hotel:** code `LAGER`, display name **Lager**.
- All stock lives on that central Lager. `StockLevel.warehouseId` still exists but always points at LAGER.
- `warehouseId` is optional on sales, goods receipts, waste, stock adjust, and inventory counts — the backend resolves the central Lager via `getCentralWarehouse` (`apps/web/src/lib/warehouse.ts`).
- **Internal stock transfers are disabled.** `createStockTransfer` throws `TRANSFERS_DISABLED`; `/api/v1/transfers` returns HTTP **410**.
- Permission `stock.transfer` is removed from `PERMISSIONS`.
- Seed creates only LAGER. Migration `20260909220000_single_lager` consolidates legacy multi-warehouse data.

## AI / integrations

- Configured at **organization (group) level** via `SystemIntegration` (encrypted secrets).
- Group UI: AI config + API config; APIs under `/api/v1/group/integrations`.
- Delivery-note OCR uses org OCR config; results and stock impact stay on the **active hotel**.

## Absolute product rules

1. No room charge / guest folio
2. Stock decreases only after sale status `PAID`
3. Every stock change → `InventoryMovement`
4. Server-side permissions
5. Tenant isolation by `organizationId` + hotel access rules (`hotelId` where applicable)
