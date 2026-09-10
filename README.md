# Prize Hotel — Inventory, F&B & POS Platform

Professional hotel inventory, purchasing, F&B and POS system. Each hotel uses a **single central Lager** (`LAGER`) for all stock — no internal warehouse transfers.

## Stack

- Monorepo: pnpm + Turborepo
- Web/API: Next.js (App Router) + TypeScript
- DB: PostgreSQL + Prisma
- Auth: Auth.js (credentials / sessions)
- i18n: German + English (`next-intl`)

## Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 16 (Docker Compose or local install)

## Setup

```bash
pnpm install
cp .env.example apps/web/.env

# Option A: Docker Postgres
docker compose up -d
# then set DATABASE_URL to postgresql://prize:prize@localhost:5432/prize_hotel

# Option B: Embedded Postgres (no Docker)
pnpm db:embedded
# uses port 54329 — already set in apps/web/.env.example alternative below
```

Default `apps/web/.env` for embedded Postgres:

```
DATABASE_URL="postgresql://prize:prize@127.0.0.1:54329/prize_hotel?schema=public"
AUTH_SECRET="dev-secret-change-me-in-production-please-32chars"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
```

```bash
pnpm db:push
pnpm db:seed
pnpm dev
```

Open http://localhost:3000

### Demo login

- Email: `admin@demo-hotel.ch`
- Password: `Demo123!`

Also: `bar@demo-hotel.ch` / `fb@demo-hotel.ch` (same password)

Keep `pnpm db:embedded` running in a separate terminal when using embedded Postgres.

### Mobile (Expo)

```bash
pnpm --filter @prize/mobile start
```

See `apps/mobile/README.md` (API URL + Bearer login via `/api/v1/auth/mobile-login`).

### Desktop (Tauri 2)

Requires Rust. With the web app on `:3000`:

```bash
pnpm --filter @prize/desktop tauri dev
```

See `apps/desktop/README.md`.

## Inventory model

- One warehouse per hotel: **Lager** (`LAGER`)
- POS, receiving, waste, inventur, and minibar all move stock on that Lager
- Transfers API returns 410 (`TRANSFERS_DISABLED`)

See `REQUIREMENTS.md`, `ARCHITECTURE.md`, and `DATABASE.md`.

## Roadmap status

Phases 1–8 of the platform plan are implemented (see `PROJECT_PLAN.md` / `PROGRESS.md`). Optional AI assistants and PMS integrations remain out of scope unless requested.
