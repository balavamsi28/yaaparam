# Deployment

> The hosting platform has not been chosen yet (decided after the game is complete). The app is deliberately **host-agnostic**: one Node process serves the web app and the WebSockets. This page covers everything needed on any host.

## What you are deploying
- **One Node.js 20+ process**, listening on `$PORT` (default `3001`).
- It serves the built client (`apps/client/dist`) **and** the Socket.IO endpoint from the same origin, so there is no CORS setup.
- Health check: `GET /healthz` → `200 ok`.
- **State is in memory**: run **exactly one instance**. A restart or redeploy ends games in progress (see [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations-deliberate-documented)).

## Requirements for the host
1. **WebSocket support** (most platforms have it; some proxies need an `Upgrade` header pass-through, and long idle timeouts, ≥ 60 s).
2. **HTTPS** at the edge (the platform or a reverse proxy). The app itself speaks plain HTTP.
3. **Single instance** (no autoscaling above 1) until state is externalised.
4. Region near your players (India) for low latency.

## Option A: Docker (recommended)
```bash
docker build -t nagar-seth .
docker run -p 8080:8080 nagar-seth        # http://localhost:8080
```
The image is a two-stage build: build with dev dependencies, then a slim runtime with production dependencies only, running as the non-root `node` user, with a `HEALTHCHECK`. It listens on `8080` (`PORT` can be overridden).

> Docker wasn't installed on the development machine, so the `Dockerfile` itself has **not been built here**. Its riskiest step, the production-only install `npm ci --omit=dev -w @nagarseth/server`, was reproduced in a scratch folder and the resulting server started and served the app. Run one `docker build` before relying on it.

## Option B: Any Node host (no Docker)
| Setting | Value |
|---|---|
| Node version | 20 or newer |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/healthz` |
| Instances | 1 |

## Environment variables (all optional)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` (`8080` in Docker) | HTTP/WebSocket port. Most platforms set this for you. |
| `CORS_ORIGIN` | unset | Comma-separated origins; only if the client is served from a *different* origin than the server. |
| `CLIENT_DIST` | `apps/client/dist` | Where the built client lives. |

There are no secrets and no database credentials to configure.

## Pre-launch checklist
- [ ] `npm run check` passes (typecheck, tests, build). CI runs it on every push.
- [ ] Chosen host, with WebSockets on, HTTPS on, **1 instance**.
- [ ] `GET /healthz` returns 200 after deploy.
- [ ] Two real devices on different networks: create a room, join by code, play a few turns, refresh mid-game (you should keep your seat).
- [ ] A 10-player smoke test.
- [ ] A platform-level rate limit / DDoS shield on the public URL.
- [ ] Custom rules from the owner implemented and balanced (see [RULES.md](RULES.md)).
- [ ] Decision on persistence: is losing games on redeploy acceptable? If not, see the upgrade path in ARCHITECTURE.md.

## Operating notes
- Logs go to stdout/stderr. Unexpected errors are logged as `handler error <event>`.
- Deploys drop in-progress games: deploy when players are few, or add persistence first.
- Memory use is tiny (a game is a few KB of JSON); the cap is 1000 rooms, rooms idle for 2 h with nobody online are swept.
