# Architecture

## Goals
Browser-based, real-time, 2–10 players per room, joined by room code. **Server-authoritative**: the browser never decides an outcome. Simple to host: one Node process serves both the web app and the WebSocket endpoint.

## Components

```
 Browser (React)                         Node server                        Engine (pure TS)
 ┌──────────────┐  intents (game:action) ┌───────────────────────┐  applyAction()  ┌────────────────┐
 │ Home/Lobby/  │ ─────────────────────► │ Socket.IO handlers    │ ──────────────► │ rules, board,  │
 │ Game UI      │                        │ rooms.ts (room store) │ ◄────────────── │ cards, state   │
 │              │ ◄───────────────────── │ crypto RNG            │   next state    │ machine        │
 └──────────────┘  room:state (view)     └───────────────────────┘                 └────────────────┘
```

| Package | Responsibility | Depends on |
|---|---|---|
| `packages/engine` | The rules. `newGame`, `applyAction`, `toClientState`, board and card data. Deterministic given an injected RNG. | nothing |
| `apps/server` | Rooms, seats, session tokens, host powers, broadcasting, static file serving, health check. | engine, express, socket.io |
| `apps/client` | Rendering and input only. Imports engine *types and board data* to draw the board. | engine (types/data), react, socket.io-client |

Rules never live in UI code. A rule change is an engine change plus tests; the UI only renders what the state says.

## The engine

`applyAction(state, playerId, action, rng) → { ok, state } | { ok, error }`

- **Pure**: it clones the state (`structuredClone`) and never mutates its input. A rejected action leaves the game untouched (this is tested).
- **Validating**: every action is checked for turn, phase, ownership, cash, and well-formed fields. Bad input returns an error string; it never throws to the caller.
- **Randomness is injected** (`Rng = (n) => int in [0,n)`). The server passes `crypto.randomInt`; tests pass scripted dice.

### Turn state machine (`state.phase`)

```
preRoll ──roll──► (move, resolve tile)
                    ├─ unowned & affordable ─► awaitBuy ──buy/decline──┐
                    ├─ can't pay              ─► debt ──payDebt──────────┤
                    └─ otherwise ─────────────────────────────────────────┤
                                                                          ▼
                                          doubles? ── yes ─► preRoll (roll again)
                                                   └─ no  ─► postRoll ──endTurn──► next player's preRoll
```

Also: `debt` can be resolved by `bankrupt`; jail is handled inside `roll`, `payJailFine`, `useJailCard`; trades and `resign` are allowed at any time by any active player; property management (`build`, `sellHouse`, `mortgage`, `unmortgage`) is for the current player outside the buy prompt.

### State visibility
The full `GameState` includes the shuffled card decks. `toClientState` strips them, and the server only ever sends that. Everything else in the game is public information, as in the physical board game. Session tokens (`Member.token`) live only in server memory and in the owner's browser, and are never included in a `RoomView`.

## The server

- `rooms.ts`: an in-memory `Map<code, Room>`. A `Room` holds members (`id`, `name`, `color`, secret `token`, current `socketId`, `isBot`), its chosen `maxPlayers` (2–10) and an optional `GameState`. Pure functions, unit-tested without sockets.
- `bot.ts`: `botAction(game) → Action`, a pure function picking one legal action for the current player. `index.ts` runs it on a 700 ms timer whenever the current player is a bot, through the same `gameAction` path a human uses — bots get no privileges and no hidden information. If a decision is ever rejected the server falls back to `endTurn`, then `resign`, so a bot can never freeze a table.
- `index.ts`: wires Socket.IO events to room functions. Each handler is wrapped so that *expected* errors (`RoomError`) become `{ok:false, error}` acks and *unexpected* errors are logged and reported generically. A malformed payload can never crash the process.
- After every successful mutation the server sends each connected member their own `RoomView` (`you` differs per recipient).

### Identity and reconnection
There are no accounts. Joining returns a random **session token** (stored in the browser's `localStorage`). On reconnect, the client sends `room:rejoin {code, token}` and gets the same seat back. A refresh, a dropped connection, or a laptop sleeping does not lose your seat. A newer connection takes over the seat; the stale connection's disconnect is ignored.

### Room lifecycle
1. `lobby`: members join/leave; the host starts (needs ≥ 2 online players; offline members are dropped at start).
2. `playing`: the game runs. Disconnected players keep their seat and can return.
3. `finished`: one active player remains. The host can start a rematch (back to `lobby`).
4. Rooms with nobody online and no activity for 2 hours are swept (every 10 minutes). At most 1000 rooms.

Stalled games: if a player goes offline the game waits for them. The host can **remove an offline player** (`room:remove`), which resigns them, so no game is stuck forever.

### Hardening in place
- Names trimmed, whitespace collapsed, capped at 20 chars; unique per room (case-insensitive).
- Room codes: 5 chars from a 31-char alphabet without look-alikes (~28M combinations), drawn with `crypto.randomInt`.
- Dice and shuffles use `crypto.randomInt`, never `Math.random`.
- Socket payload cap of 16 KB; per-socket flood guard (over 60 events / 10 s disconnects).
- Numeric fields (tile ids, cash) are validated as integers in range in the engine.
- `x-powered-by` disabled; CORS off unless `CORS_ORIGIN` is set.
- Graceful shutdown on SIGTERM/SIGINT.

## The client
React 19 + Vite. One hook, `useNet` (`net.ts`), owns the socket, the current `RoomView`, the saved session and toast messages. Components are plain props-in/events-out: `Home`, `Lobby`, `Game` (with `Board`, `Dice`, `Trade`, `PlayerInspector`). No state library: the server is the single source of truth, so client state is essentially "the last `RoomView`".

Board geometry: 40 tiles on an 11×11 CSS grid; `pos(id)` in `Board.tsx` maps a tile id to a row/column/side. Tile sizing uses container query units so the board scales from phone to desktop.

Presentation-only pieces (they never decide anything):
- **Tokens** are one absolutely-positioned overlay, not children of tiles, so `useHoppingPositions` can walk a token one tile every 90 ms toward the position the server reported.
- **`Dice.tsx`** is a CSS 3D cube; a spin counter keyed off the log length makes a repeated value still tumble.
- **`audio.ts`** synthesises the music and effects with the Web Audio API — a pentatonic loop over a tabla-ish pulse. No audio files, so no extra bandwidth. Muting and volume are kept in `localStorage`.
- **`QrCode.tsx`** renders the room's join link as inline SVG (`qrcode-generator` does the encoding).
- **`PlayerInspector.tsx`** shows a player's portfolio and a net-worth estimate. That estimate is a UI convenience, not a rule.

## Technology choices (and why)
| Choice | Reason |
|---|---|
| TypeScript everywhere | One language; shared types between server and client prevent protocol drift. |
| npm workspaces | Three packages, no extra tooling needed. |
| Socket.IO | Rooms, acks, automatic reconnection and long-polling fallback for restrictive networks. |
| Express 5 | Only used for static files and `/healthz`. |
| React + Vite | Requested stack; fast builds. |
| esbuild (server bundle) | Bundles the workspace engine into `dist/index.js` so production doesn't need TypeScript or path aliases. |
| Vitest | One runner for all packages, TypeScript out of the box. |
| `qrcode-generator` (2 KB) | QR encoding is Reed–Solomon plus mask selection; a hand-rolled version would fail silently on some codes. Everything else in the client is hand-written. |
| **No PostgreSQL yet** | Nothing requires persistence yet (no accounts, no history). Adding it would add operations burden with no user benefit. See below. |

## Known limitations (deliberate, documented)
1. **State is in memory.** A server restart ends all games. One server instance only: rooms are not shared across processes. *Upgrade path:* persist `GameState` (it is plain JSON) to PostgreSQL after each action for restart recovery; add the Socket.IO Redis adapter plus sticky sessions to scale horizontally.
2. **No accounts or history.** Identity is per-room. *Upgrade path:* auth and a `games`/`results` table in PostgreSQL.
3. **No turn timer**; a slow or AFK player holds up the table (the host can remove them only when *offline*).
4. **Crude rate limiting** (per socket, not per IP). Put a reverse proxy or platform rate limiter in front for real abuse protection.
5. **No auctions, chat or spectators.** See [RULES.md](RULES.md) for the rule-level omissions.
6. Accessibility is partial: buttons and dialogs are keyboard-usable and labelled, but the board is not screen-reader-optimised.
7. **Bots are a baseline opponent.** They buy when comfortable, build on complete groups, and raise cash under debt, but they never trade. Two bots that each hold parts of every colour group can therefore play indefinitely — a human at the table breaks the deadlock by trading. *Upgrade path:* give `botAction` a trade proposer.
