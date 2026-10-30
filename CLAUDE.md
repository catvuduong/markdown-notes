# markdown-notes

Frontend-only monorepo (npm workspaces): `apps/web` (Next.js) and `e2e/` (Playwright). No backend, no database.

## Rules for automated tasks
- Work only inside this repo, on the branch you are given. Never push, never touch `main`, never edit `.github/workflows` or deploy config unless the task says so.
- Never read, print or create secrets. Do not add `.env` files with real values.
- Keep changes small and focused on the task. Cover every behaviour with an e2e test in `e2e/` (stable `data-testid`s). Persist user data in the browser (localStorage) unless the task says otherwise.
- The home page (`/`) is screenshotted as the portfolio thumbnail: make it look finished and meaningful at 1280x720.
- Before finishing run `npm run verify` (lint, build, e2e) and fix failures. Do not disable or delete tests.

## Commands
- `npm install` — install all workspaces
- `npm run verify` — full local check, same as CI
