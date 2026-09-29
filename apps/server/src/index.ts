import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Server, type Socket } from 'socket.io';
import * as R from './rooms';
import { botAction } from './bot';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_DIST = process.env.CLIENT_DIST ?? path.resolve(import.meta.dirname, '../../client/dist');
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

const app = express();
app.disable('x-powered-by');
app.get('/healthz', (_req, res) => void res.type('text').send('ok'));
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: false }));
  app.use((_req, res) => void res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

const http = createServer(app);
const io = new Server(http, {
  maxHttpBufferSize: 16 * 1024,
  cors: process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',') } : undefined,
});

type Ack = (r: { ok: true; [k: string]: unknown } | { ok: false; error: string }) => void;
interface Session { room: R.Room; me: R.Member }
const sessions = new Map<string, Session>();

function broadcast(room: R.Room) {
  for (const m of room.members) if (m.socketId && m.socketId !== 'bot') io.to(m.socketId).emit('room:state', R.view(room, m.id));
}

/** If it's a bot's turn, act for it after a human-paced delay, then check again. */
function scheduleBot(room: R.Room) {
  const game = room.game;
  if (!game || game.status !== 'playing') return;
  const current = game.players[game.current];
  const member = room.members.find((m) => m.id === current?.id);
  if (!current || !member?.isBot || current.bankrupt) return;
  setTimeout(() => {
    if (room.game !== game || game.status !== 'playing') return; // room moved on while we waited
    try {
      R.gameAction(room, current.id, botAction(game));
    } catch {
      // A rejected decision would repeat forever, so fall back to ending the turn, then to resigning.
      try { R.gameAction(room, current.id, { type: 'endTurn' }); }
      catch { try { R.gameAction(room, current.id, { type: 'resign' }); } catch { /* game moved on */ } }
    }
    broadcast(room);
    scheduleBot(room);
  }, 700);
}

function attach(socket: Socket, room: R.Room, me: R.Member) {
  me.socketId = socket.id;
  sessions.set(socket.id, { room, me });
  socket.join(room.code);
  broadcast(room);
}

function detach(socket: Socket) {
  const s = sessions.get(socket.id);
  if (!s) return;
  sessions.delete(socket.id);
  socket.leave(s.room.code);
  if (s.me.socketId !== socket.id) return; // a newer connection already took over this seat
  s.me.socketId = null;
  R.reassignHost(s.room);
  broadcast(s.room);
}

io.on('connection', (socket) => {
  // Crude flood guard: >60 events in 10s disconnects the socket.
  let hits = 0;
  const window = setInterval(() => (hits = 0), 10_000);
  socket.use((_e, next) => (++hits > 60 ? socket.disconnect(true) : next()));

  const on = (event: string, fn: (data: any, s: Session | undefined) => object | void) =>
    socket.on(event, (data: unknown, ack?: Ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const out = fn(data ?? {}, sessions.get(socket.id));
        reply({ ok: true, ...out });
      } catch (e) {
        if (e instanceof R.RoomError) return reply({ ok: false, error: e.message });
        console.error('handler error', event, e);
        reply({ ok: false, error: 'Something went wrong.' });
      }
    });
  const need = (s: Session | undefined) => s ?? (() => { throw new R.RoomError('You are not in a room.'); })();
  const joined = (room: R.Room, me: R.Member) => {
    detach(socket);
    attach(socket, room, me);
    return { code: room.code, token: me.token, playerId: me.id };
  };

  on('room:create', (d) => { const { room, me } = R.createRoom(d.name); return joined(room, me); });
  on('room:join', (d) => { const { room, me } = R.joinRoom(d.code, d.name); return joined(room, me); });
  on('room:rejoin', (d) => { const { room, me } = R.rejoinRoom(d.code, d.token); return joined(room, me); });
  on('room:start', (_d, s) => { const { room, me } = need(s); R.startGame(room, me.id); broadcast(room); scheduleBot(room); });
  on('room:rematch', (_d, s) => { const { room, me } = need(s); R.rematch(room, me.id); broadcast(room); });
  on('room:remove', (d, s) => { const { room, me } = need(s); R.removeOffline(room, me.id, d.playerId); broadcast(room); scheduleBot(room); });
  on('room:addBot', (_d, s) => { const { room, me } = need(s); R.addBot(room, me.id); broadcast(room); });
  on('room:removeMember', (d, s) => { const { room, me } = need(s); R.removeMember(room, me.id, d.playerId); broadcast(room); });
  on('room:leave', (_d, s) => {
    const { room, me } = need(s);
    if (room.game) R.gameAction(room, me.id, { type: 'resign' });
    else R.leaveLobby(room, me.id);
    me.socketId = null;
    sessions.delete(socket.id);
    socket.leave(room.code);
    if (R.rooms.has(room.code)) { broadcast(room); scheduleBot(room); }
  });
  on('game:action', (d, s) => { const { room, me } = need(s); R.gameAction(room, me.id, d); broadcast(room); scheduleBot(room); });

  socket.on('disconnect', () => { clearInterval(window); detach(socket); });
});

setInterval(() => R.sweep(ROOM_TTL_MS), 10 * 60 * 1000).unref();

http.listen(PORT, () => console.log(`Yaaparam server listening on :${PORT}`));

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => { io.close(); http.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
}
