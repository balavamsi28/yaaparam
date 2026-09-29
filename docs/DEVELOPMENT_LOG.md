# Development log

A step-by-step record of how the project was built, in order, including decisions, dead ends and fixes. Dates are 2026-09-29.

## Step 0: Inspect the workspace
Checked the directory before building anything. Result: empty except `.git/`; valid Git repo; branch `main`; no commits; no config files; no remotes.

## Step 1: Working agreement (`CLAUDE.md`)
Wrote `CLAUDE.md` from the owner's brief: product goals, stack (React + TS, Node + TS, Socket.IO, PostgreSQL *only if needed*), server-authoritative rule, incremental workflow, "don't invent rules", "don't copy proprietary assets".

## Step 2: Clarify blockers before the big build
Owner asked to "install required skills and plugins" and deliver the full, production-level game. Blockers raised:
1. **Custom rules not provided** (conflicts with "don't invent rules").
2. "Skills and plugins" was ambiguous.
3. **Hosting target unknown.**
4. "Everything at once" conflicts with the incremental workflow.

**Owner's decisions:** use normal property-trading rules as placeholders; build everything; decide hosting after the game is complete. → Rules are documented as *placeholders* ([RULES.md](RULES.md)); the build is host-agnostic (Docker + env config).

**Skills/plugins:** none were installed. The project's needs are npm libraries, not Claude Code plugins, and adding unneeded plugins conflicts with the "no dependency without a reason" rule. Every dependency is listed below with its reason.

## Step 3: Toolchain check
Node 22.7, npm 10.8, Git 2.50. Docker is **not** installed (consequence: the Dockerfile could not be built locally; see Step 13).

## Step 4: Workspace skeleton
npm workspaces monorepo: `packages/engine`, `apps/server`, `apps/client`. Shared `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`) with a path alias `@yaaparam/engine → packages/engine/src`. `.gitignore`. Root scripts: `dev`, `test`, `typecheck`, `build`, `start`, `check`.

Dependencies and why:
| Package | Where | Why |
|---|---|---|
| typescript, @types/node | root dev | language / types |
| vitest | root dev | tests for all packages |
| tsx | root dev | run TS server in dev and e2e test |
| esbuild | root dev | bundle the server (incl. the workspace engine) for production |
| concurrently | root dev | `npm run dev` runs server + client together |
| express | server | static files + `/healthz` (small, ubiquitous) |
| socket.io | server | real-time rooms, acks, reconnection, polling fallback |
| react, react-dom | client | requested UI stack |
| socket.io-client | client | matching client |
| vite, @vitejs/plugin-react | client dev | dev server and production build |

## Step 5: Game engine (`packages/engine`)
Designed as a pure function `applyAction(state, playerId, action, rng)`; state cloned per action; errors returned, never thrown to callers; RNG injected.
- `types.ts`, `board.ts` (40 original Indian squares, 8 colour groups, tunable constants), `cards.ts` (24 original cards), `engine.ts` (turn state machine).
- Design choices: cards never involve other players, so debt has a single creditor (avoids multi-creditor bankruptcy complexity). Decks are hidden from clients. A `pendingMove` field handles "third failed jail roll but can't afford the fine" (pay first, then move).

## Step 6: Engine tests
14 tests first (turn flow, rent doubling, salary, doubles/three-doubles, even building, mortgages, debt→bankruptcy→winner, mortgage-to-raise-cash, jail paths, trade), later 2 more for `resign`. Scripted dice make them deterministic.

Issues found and fixed:
- `tsc` reported `'me' is possibly undefined`: the `fail()` helper was an arrow function typed `never`, which TypeScript doesn't use for narrowing. **Fix:** declared it as a `function` declaration.
- Two early tests were muddled (they depended on random card effects). Rewrote them to place players directly.
- TypeScript 7 rejects `baseUrl` in tsconfig; removed it (the `paths` alias works without it).

## Step 7: Engine addition: `resign`
So a player who leaves, or a host removing an offline player, can never stall a game. Refactored `bankrupt()` to take the player and creditor, so it works for non-current players. Resigning always gives assets to the bank (never enriches another player).

## Step 8: Server (`apps/server`)
- `rooms.ts`: pure room functions (create/join/rejoin/start/rematch/action/remove/sweep/view).
- `index.ts`: Socket.IO handlers, acks, static serving, `/healthz`, flood guard, graceful shutdown.
- Moved the `RoomView` type into the engine package so server and client share one definition.

Issues found and fixed:
- Original design removed a player from the lobby on any disconnect, so **a page refresh in the lobby kicked you out**, and a stale tab's disconnect could evict a rejoined player. **Fix:** lobby disconnects keep the seat (marked offline); offline members are dropped at game start or when the room is full; `detach` ignores disconnects from superseded connections; the host role moves to an online member if the host drops.

## Step 9: Server tests
4 room-layer tests (validation, cap, tokens not leaked, sweep). One test bug found: it left the host offline, so the ghost-pruning correctly removed them; fixed the test. Added an **end-to-end test** that boots the real server on a random port and plays through two real Socket.IO clients (create, join, start, rejects non-host start and out-of-turn roll, roll broadcast without decks, rejoin by token, bad token rejected).

## Step 10: Client (`apps/client`)
Home (create/join, invite link `?room=CODE`), Lobby (code, copy link, players, host start), Game (board, dice, contextual actions, players, tile inspector, property management, trade composer and offer dialog, log). Dark indigo + saffron theme, container-query board that scales phone → desktop, reduced-motion support, focus outlines.

Dependency hiccup: rewriting `apps/client/package.json` after an install dropped the runtime dependencies; caught by the typechecker (`Cannot find module 'socket.io-client'`) and reinstalled.

## Step 11: Visual verification
Drove the production build with headless Chrome (`playwright-core`, installed only in a scratch folder outside the repo): two browser contexts create/join a room, start, and play several turns; screenshots at 1400×900 and 390×844. No console errors. One layout nit found (Join button wrapped under the code input) and fixed.

## Step 12: Build, CI, container
- `npm run build`: client `tsc` + Vite, server esbuild bundle (28 KB; the engine is bundled in, so the runtime needs only express and socket.io).
- `Dockerfile` (two-stage, non-root, healthcheck), `.dockerignore`, `.env.example`, GitHub Actions `ci.yml` running `npm run check`.

## Step 13: Verifying what could be verified
- `npm run check`: typecheck clean, 22/22 tests, build OK. `npm audit` (via install): 0 vulnerabilities.
- Docker isn't installed, so the image was **not** built. The production-only install (`npm ci --omit=dev -w @yaaparam/server --include-workspace-root=false`) was reproduced in a scratch folder and the server started and served both `/healthz` and the app.

## Step 14: Documentation
README, ARCHITECTURE, RULES, PROTOCOL, DEPLOYMENT, this log; `CLAUDE.md` updated with the real commands, layout and status.

## Step 15: Bots, sharing, mobile-first polish
- **Rooms**: capacity is chosen at creation (2–10). `addBot`/`removeMember` let the host fill or trim the lobby.
- **Bots** (`apps/server/src/bot.ts`): one pure function returning a legal action; the server plays it every 700 ms through the normal `gameAction` path. Rejected decisions fall back to `endTurn`, then `resign`, so a bot cannot freeze a table.
- **Client**: "Play vs Computer" one-tap start; lobby QR code (`qrcode-generator`, the one new dependency) plus copy/WhatsApp/native-share; tokens that hop tile by tile from an overlay layer; 3D CSS dice; a player portfolio sheet with a net-worth estimate; Web Audio music and effects (no audio files) with mute and volume; turn actions docked to the bottom of the screen on phones.
- **Engine bug found by the bot soak test**: `payDebt` cleared the debt but left `phase === 'debt'`, so a held jail move that landed somewhere harmless left the turn stuck — no legal action remained except bankruptcy. Fixed (`settle` before the held move) with a regression test.
- Verified: `npm run check` (typecheck, 25 tests, build), plus a live socket run where a bot took its turn and handed play back.

## Not done / next
- Owner's custom rules (rules here are placeholders).
- Choose a host and deploy ([DEPLOYMENT.md](DEPLOYMENT.md)); run the pre-launch checklist.
- Renamed from "Nagar Seth" to Yaaparam; first commit exists, GitHub push pending.
- Bots never trade, so a bot-only table can play forever (documented in ARCHITECTURE.md).
- Candidates: auctions, turn timer, chat, persistence (PostgreSQL), accounts, richer art.
