# @prize/mobile — Prize Hotel (Expo)

Expo TypeScript client for the Prize Hotel web API.

## Prerequisites

- Node 20+
- pnpm workspace root already bootstrapped (`pnpm install` from repo root)
- Web API running (`pnpm dev` → http://localhost:3000)

## Run

```bash
# from monorepo root
pnpm --filter @prize/mobile start

# or platform-specific
pnpm --filter @prize/mobile android
pnpm --filter @prize/mobile ios
pnpm --filter @prize/mobile web
```

## API base URL

Default: `http://192.168.1.25:3000` (change on the login screen under **API settings**).

| Environment | Suggested URL |
|-------------|---------------|
| Physical device (same LAN) | `http://<your-pc-lan-ip>:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |

## Auth

Login calls `POST /api/v1/auth/mobile-login` and stores a Bearer JWT (SecureStore / AsyncStorage on web). All subsequent calls send `Authorization: Bearer <token>`.

Demo credentials (seed): `admin@demo-hotel.ch` / `Demo123!`

## Features

- Login + API URL settings
- Dashboard summary KPIs
- Products list (search)
- Warehouse stock list
- Simple POS: pick products → create sale → pay cash/card
