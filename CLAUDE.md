# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

An original browser-based multiplayer Indian property-trading board game. It is inspired only by the general concept of classic property-trading board games. It has its own rules, mechanics, visual identity, and implementation.

### Product goals
- Browser-based game.
- Multiplayer rooms joined by room code; players can create and join rooms.
- Up to 10 players per room.
- Real-time gameplay.
- Indian-themed board, cities, properties, currency, and events.
- Modern, stylish UI. Simple graphics first; visual polish comes later.
- Custom rules will be supplied by the project owner separately.

## Technical direction
- **Frontend:** React + TypeScript.
- **Backend:** Node.js + TypeScript.
- **Real-time:** Socket.IO / WebSockets.
- **Database:** PostgreSQL, only when persistent storage is actually needed.
- **Version control:** Git.

Nothing is installed yet. Do not add a technology or dependency without a clear reason, and state that reason first.

## Architecture rules
- **The server is authoritative** for game state, turns, dice/random results, money, property ownership, and all other game outcomes.
- Never trust the client to decide an authoritative outcome. The client sends intents (for example "roll", "buy"); the server validates them and returns the resulting state.
- **Keep game rules separate from UI code.** Rules live in a pure, framework-free TypeScript module that can be tested without React, sockets, or a database.
- Write reusable, maintainable TypeScript.
- Prefer simple solutions over unnecessary complexity.

## Working principles
1. Do not build the whole game in one step. Work in small, testable milestones.
2. Before a major architectural change, explain the proposal and why it is needed, then wait for approval.
3. Add tests for important game logic as it is written.
4. Update documentation whenever architecture or rules change.
5. **Do not invent game rules.** If a rule is missing or ambiguous, ask the owner.
6. Do not copy proprietary artwork, assets, code, or distinctive implementation details from existing games. The reference game is general inspiration only.

## Roadmap
Work in this order, and do not skip ahead:
1. Project documentation and architecture.
2. Project skeleton.
3. Lobby / room system.
4. Core game engine.
5. Board and gameplay UI.
6. Real-time multiplayer integration.
7. Custom rules implementation.
8. Testing, balancing, polish, and deployment.

## Current status
Milestones 1-6 are done: docs, skeleton, lobby/rooms, rules-agnostic engine, board/gameplay UI, real-time play, Docker and CI. Since then: room size 2-10, computer opponents (`apps/server/src/bot.ts`), QR/WhatsApp/native sharing, hopping tokens, 3D dice, a player portfolio sheet, Web Audio music and effects, and a mobile-first action dock. The rules implemented are **placeholders** (standard property-trading rules, original theme); see `docs/RULES.md`. Not yet done: the owner's custom rules, choosing a host and deploying, a Docker build check (Docker was not installed on the dev machine), and a first Git commit.

## Layout
- `packages/engine`: pure game rules (`applyAction`, board, cards). All rule changes go here, with tests.
- `apps/server`: Express + Socket.IO; rooms in memory (`rooms.ts`), handlers (`index.ts`), computer players (`bot.ts`).
- `apps/client`: React + Vite UI. Renders server state, sends intents only.
- `docs/`: ARCHITECTURE, RULES, PROTOCOL, DEPLOYMENT, DEVELOPMENT_LOG. Update them with any change.

## Commands
- `npm run dev`: server :3001 + client :5173
- `npm test`: all tests. `npm run typecheck`. `npm run build`. `npm run check` (all three, as CI does).
- `npm start`: run the production build.

## Conventions
- A rule change = engine change + a test + an update to `docs/RULES.md`. Never put rules in the client.
- New client actions or events = update `docs/PROTOCOL.md`.
- Add a line to `docs/DEVELOPMENT_LOG.md` for each notable step.
- Randomness in the engine is always injected (`Rng`); the server uses `crypto.randomInt`.
- Known limitations (in-memory state, single instance, no auctions) are listed in `docs/ARCHITECTURE.md` and `docs/RULES.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
