# @prize/desktop — Prize Hotel (Tauri 2)

Native desktop shell that loads the Prize Hotel web app in a WebView.

## Prerequisites

1. **Rust** — install from https://rustup.rs/ (`rustc --version` should work)
2. **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Desktop development with C++)
3. Web API running on port 3000:

```bash
pnpm --filter @prize/web dev
```

## Run

From the monorepo root (after `pnpm install`):

```bash
pnpm --filter @prize/desktop tauri dev
# or
pnpm --filter @prize/desktop dev
```

In development the WebView opens `http://localhost:3000` (`src-tauri/tauri.conf.json` → `build.devUrl`).

## Production build

```bash
pnpm --filter @prize/desktop tauri build
```

Bundled `frontendDist` is `apps/desktop/dist` (fallback page). Point `frontendDist` / window URL at your deployed host when packaging for production.

## Notes

- First `tauri dev` downloads Rust crates (needs network).
- This app does not re-implement business UI; it wraps the existing Next.js web client.
