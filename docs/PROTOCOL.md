# Network protocol

Transport: Socket.IO over the same origin/port as the web app (path `/socket.io`). Every client → server event takes an optional payload and an **acknowledgement callback** that receives either:

```ts
{ ok: true, ...extra } | { ok: false, error: string }   // error is safe to show to the player
```

The server pushes state with one event, `room:state`. The client never mutates local game state; it sends intents and renders the next `room:state`.

## Client → server

| Event | Payload | Ack extras | Who / when |
|---|---|---|---|
| `room:create` | `{ name, maxPlayers? }` | `{ code, token, playerId }` | anyone; `maxPlayers` 2–10, defaults to 10 |
| `room:join` | `{ code, name }` | `{ code, token, playerId }` | anyone, lobby only, not full, name unique |
| `room:rejoin` | `{ code, token }` | `{ code, token, playerId }` | a returning player; takes over the seat |
| `room:start` | none | | host, lobby, ≥ 2 online players |
| `room:rematch` | none | | host, after the game finished |
| `room:remove` | `{ playerId }` | | host; target must be **offline** (resigns them / removes from lobby) |
| `room:addBot` | none | | host, lobby only, room not full; adds a computer player |
| `room:removeMember` | `{ playerId }` | | host, lobby only; removes any member except the host (used for bots) |
| `room:leave` | none | | any member; in a game this resigns |
| `game:action` | `Action` (below) | | active players; validated by the engine |

`token` is a secret credential for that seat. The client stores it in `localStorage` and never shows it to anyone.

### `Action` (defined in `packages/engine/src/types.ts`)

| `type` | Fields | Notes |
|---|---|---|
| `roll` | | phase `preRoll` |
| `buy` / `decline` | | phase `awaitBuy` |
| `endTurn` | | phase `postRoll` |
| `payDebt` / `bankrupt` | | phase `debt` (`bankrupt` also allowed any time on your turn) |
| `payJailFine` / `useJailCard` | | in jail, before rolling |
| `build` / `sellHouse` / `mortgage` / `unmortgage` | `tile` | your turn, not during the buy prompt |
| `proposeTrade` | `to`, `give`, `get` (`{cash, tiles[], jailCards}`) | any active player, any time |
| `acceptTrade` / `cancelTrade` | | recipient accepts/declines; either side can cancel |
| `resign` | | any active player, any time |

## Server → client

`room:state` carries a `RoomView` (see `packages/engine/src/types.ts`):

```ts
{
  code, hostId,
  you,                      // the recipient's own player id (differs per recipient)
  maxPlayers,               // the room's chosen capacity (2–10)
  phase: 'lobby' | 'playing' | 'finished',
  members: [{ id, name, color, connected, isBot }],
  game: ClientGameState | null   // GameState minus the shuffled decks
}
```

It is sent to every connected member after each successful change, and when someone connects or disconnects.

Bots have no socket. When the current player is a bot the server plays for them (`apps/server/src/bot.ts`), one action every 700 ms, broadcasting `room:state` after each one.

## Errors you should expect

| `error` | Cause |
|---|---|
| `Room not found.` | wrong/expired code |
| `That game has already started.` / `Room is full (max 10).` / `That name is taken in this room.` | join rules |
| `Session expired.` | bad rejoin token (the client then clears its saved session) |
| `It is not your turn.` / `You cannot roll now.` / … | engine validation |
| `Something went wrong.` | an unexpected server error (logged server-side) |
