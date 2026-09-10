# PROGRESS — Prize by Radisson

Last updated: 2026-09-09

## Completed (full plan)

| Area | Evidence |
|------|----------|
| Phase 1–4 ops | Auth/RBAC, Dashboard, Products CRUD+images, Lager stock, POS, Inventur+scanner, Receiving, POs, Suppliers CRUD, Waste, Recipes, Breakfast, Minibar (no folio), Users, Settings, Search |
| Single Lager | One warehouse `LAGER` / "Lager" per hotel; `getCentralWarehouse`; transfers disabled (`TRANSFERS_DISABLED`, API 410); `stock.transfer` removed; migration `20260909220000_single_lager` |
| Multi-tenant / GROUP | Schema: `AccountType`, `User.organizationId`/`accountType`, `Role.scope`, `SystemIntegration`, `AuditLog` org fields; migration `20260909230000_multi_tenant_org`. Tenant auth (`lib/tenant.ts`: `requireHotelContext`, allow-list / `hotels.view_all`). Group UI + APIs (`/group/*`, `/api/v1/group/*`). Org-level AI/API config (encrypted secrets). Security tests in `tenant.test.ts` |
| Phase 5 reports | Summary API + CSV; `/api/v1/reports/export` Excel+PDF (`verify-exports.ts`) |
| Phase 6 tests/CI | Vitest (incl. `single-lager.test.ts`, `tenant.test.ts`); `.github/workflows/ci.yml` |
| Integrity | Stock `FOR UPDATE`; pay/cancel/refund claims; TX advisory lock; receipt idempotent confirm; hotel/org-scoped FKs |
| Multi-hotel | `/api/v1/hotels` switch; HOTEL locked; GROUP enter/clear hotel context |
| PWA | Manifest, SW, icons, install banner |
| Mobile | Expo app `@prize/mobile` + `POST /api/v1/auth/mobile-login` Bearer JWT |
| Desktop | Tauri 2 `@prize/desktop` webview → localhost:3000 |
| Migrations | `init` + `pos_vouchers_offline` + `single_lager` + `delivery_note_scan` + `multi_tenant_org` |
| Bar POS | Touch-Kasse `/pos`: Terminal/Offline pay, Club/Premium/VIP vouchers, manual discount, free articles |
| Delivery notes | `/api/v1/delivery-note-scans` + OCR via org integration / `OPENAI_API_KEY` fallback |

## How to run

```bash
pnpm db:embedded          # keep alive
pnpm --filter @prize/web exec prisma migrate deploy
pnpm db:seed
pnpm dev                  # http://localhost:3000

pnpm --filter @prize/web test
pnpm --filter @prize/mobile start
pnpm --filter @prize/desktop dev   # requires Rust + web running
```

### Demo logins (after seed)

| Email | Password | Account |
|-------|----------|---------|
| `group.admin@prize-radisson.ch` | `Demo123!` | GROUP |
| `admin@demo-hotel.ch` | `Demo123!` | HOTEL (Bern) |
| `bar@demo-hotel.ch` | `Demo123!` | HOTEL |
| `fb@demo-hotel.ch` | `Demo123!` | HOTEL |

## Goal

Platform plan items (incl. multi-tenant GROUP/HOTEL) are implemented. Optional deeper KI/PMS integrations remain out of scope unless requested.
