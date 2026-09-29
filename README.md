# Yaaparam 🪔

An original, browser-based multiplayer Indian property-trading board game. Create a room, share the 5-letter code, and play with 2–10 friends in real time. Buy cities, collect rent, build, trade and bankrupt your friends.

It is inspired only by the general genre of property-trading board games. The rules, board, cards, names and visuals are its own.

> **Rules status:** the rules currently implemented are *standard property-trading rules used as placeholders* ([docs/RULES.md](docs/RULES.md)). The project owner's custom rules will replace or extend them.

## Quick start

Requires Node.js 20+ (developed on 22).

```bash
npm install
npm run dev          # server :3001 + client :5173 (open http://localhost:5173)
```

Open the page in two browser windows (one can be private/incognito), create a room in one and join with the code in the other.

| Command | What it does |
|---|---|
| `npm run dev` | Server (auto-reload) and client (Vite HMR) together |
| `npm test` | All tests (engine, room layer, end-to-end sockets) |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run build` | Production build of client and server |
| `npm start` | Run the production build (serves client and sockets on `$PORT`, default 3001) |
| `npm run check` | Typecheck, test and build, the same as CI |

## Repository layout

```
packages/engine/   Pure TypeScript game rules: board, cards, state machine. No I/O, fully tested.
apps/server/       Node + Express + Socket.IO. Rooms, sessions, broadcasting. Calls the engine.
apps/client/       React + Vite UI. Renders server state and sends intents.
docs/              Architecture, rules, network protocol, deployment, development log.
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md): design, data flow, security model, limitations
- [Game rules](docs/RULES.md): every implemented rule and every deliberate omission
- [Network protocol](docs/PROTOCOL.md): Socket.IO events and payloads
- [Deployment](docs/DEPLOYMENT.md): Docker, generic hosts, environment variables, pre-launch checklist
- [Development log](docs/DEVELOPMENT_LOG.md): step-by-step record of how this was built, and why
- [CLAUDE.md](CLAUDE.md): working agreement for AI-assisted development
