# ARCHITECTURE — Prize by Radisson

## Overview

```
pnpm monorepo (Turborepo)
├── apps/web      Next.js 15 (UI + REST API BFF)
├── apps/mobile   Expo stub
├── apps/desktop  Tauri stub
└── packages/
    ├── types         Shared enums, permissions, AccountType, formatMoney
    ├── validators    Zod schemas
    ├── ui            Design tokens + primitives
    ├── api-client    Fetch client for mobile/desktop
    └── tsconfig
```

## Runtime

- **Web/API:** Next.js App Router — pages under `src/app/[locale]`, APIs under `src/app/api/v1`
- **DB:** PostgreSQL + Prisma (`apps/web/prisma`)
- **Auth:** Auth.js (NextAuth v5) credentials → JWT session with `accountType`, `organizationId`, optional `hotelId`, permissions
- **i18n:** next-intl (`de`, `en`)
- **State:** TanStack Query for client data

## Multi-tenancy

```
Organization ("Prize by Radisson")
  └── Hotel (Prize Bern, Prize Zurich, …)
        └── Lager (exactly one active LAGER)
        └── Products, Sales, Inventory, … (hotelId-scoped)
```

### Account types

| Type | Scope | Hotel context |
|------|--------|----------------|
| **HOTEL** | Exactly one hotel via `UserHotel` | Always that hotel; cannot switch |
| **GROUP** | Organization | `hotelId` null = group mode; may enter an authorized hotel |

### Tenant authorization path

```
Request → Auth (JWT/Bearer) → accountType + organizationId
  → HOTEL: hotelId must match assignment
  → GROUP: org match + allow-list or hotels.view_all
  → Permission check → hotel-scoped query (requireHotelContext)
```

Helpers: `apps/web/src/lib/tenant.ts` (`requireHotelContext`, `assertHotelAccess`, `getAccessibleHotelIds`).

Frontend hiding is UX only — every hotel API uses `requireHotelContext`.

### UI shells

- **GROUP:** `/{locale}/group/*` + `GroupShell` (dashboard, hotels, analytics, users, permissions, AI/API config, settings, audit)
- **HOTEL / GROUP-in-hotel:** existing `(app)` + `(terminal)` modules; header shows current hotel; GROUP can “Back to Group”

## Inventory: single Lager

- Each hotel has exactly one active warehouse: code **`LAGER`**, name **Lager**.
- Domain helpers in `lib/warehouse.ts`.
- Transfers disabled (`TRANSFERS_DISABLED` / 410).

## AI / integrations

- Org-level `SystemIntegration` (encrypted secrets via `INTEGRATION_SECRET_KEY` or `AUTH_SECRET`)
- Group UI: `/group/ai-config`, `/group/api-config`
- Delivery-note OCR uses org OCR config with `OPENAI_API_KEY` fallback; results belong to the active hotel

## Domain services

| Module | Location |
|--------|----------|
| Tenant | `lib/tenant.ts` |
| Integrations | `lib/integrations.ts`, `lib/integration-secrets.ts` |
| Warehouse | `lib/warehouse.ts` |
| Stock / Sales / Inventory / Receiving / … | existing `lib/*` |

## POS payment invariant

```
createSale → PENDING (no stock)
confirmPayment success → PAID + stock− on LAGER + movement(SALE) + audit
cancel/fail → no stock change
refund → REFUNDED + stock+ on LAGER + movement(RETURN)
```

Payment methods in use: CARD, TWINT (and existing OFFLINE/CASH enums remain in schema).

## Non-goals

- Charge to room / guest folio
- Multi-warehouse / internal stock transfers
- Full Postgres RLS (app-level filters + constraints)
