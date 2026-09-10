# PROJECT PLAN — Prize by Radisson Inventory & POS

## Objective

Build a production-quality hotel Inventory, POS, Purchasing, F&B and Reporting platform with shared backend, web client first, then mobile (Expo) and desktop (Tauri). **No charge-to-room.** Each hotel has a **single central Lager** (code `LAGER`) — no multi-warehouse transfers. Multi-tenant org model: **GROUP** (org-wide) and **HOTEL** (single-hotel) accounts.

## Phased roadmap

| Phase | Scope | Status |
|-------|--------|--------|
| 1 | Architecture, DB, Auth, Design, Products, Stock, POS, Inventur, Barcode | **Done** |
| 2 | Goods receiving, Purchasing, Suppliers manage | **Done** |
| 3 | Product CRUD UI, stock adjust, notifications, users/settings | **Done** |
| 4 | Recipes, Breakfast, Minibar, Food waste | **Done** |
| 5 | Reports + CSV/Excel/PDF exports | **Done** |
| 6 | Automated tests + GitHub CI | **Done** |
| 7 | PWA + Expo mobile + Tauri desktop | **Done** (install UX + apps) |
| 8 | Multi-hotel switcher | **Done** |
| — | Single central Lager (transfers disabled, stock consolidated) | **Done** |
| — | Multi-tenant org / GROUP accounts (schema, auth, group UI/APIs, AI config, tenant tests) | **Done** |

Phases 1–8 plus single-Lager and multi-tenant org work are complete. Remaining items are optional product follow-ups.

## Absolute rules

1. No room charge
2. Stock decreases only after `PAID`
3. Every stock change → `InventoryMovement`
4. Server-side permissions
5. Tenant isolation (`organizationId` + HOTEL/GROUP hotel access)
6. No fake demo
7. No shift management
8. One active Lager per hotel; transfers disabled (`TRANSFERS_DISABLED` / API 410)

## Optional / follow-ups

- KI forecasting beyond breakfast heuristics / delivery-note OCR
- PMS / accounting integrations
- Richer offline PWA caching of authenticated pages
