import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import type { RoomView } from '@nagarseth/engine';

const PORT = 4100 + Math.floor(Math.random() * 500);
let server: ChildProcess;

beforeAll(async () => {
  server = spawn('npx', ['tsx', 'apps/server/src/index.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
  await new Promise<void>((res, rej) => {
    server.stdout!.on('data', (d) => String(d).includes('listening') && res());
    server.on('exit', () => rej(new Error('server exited')));
    setTimeout(() => rej(new Error('server start timeout')), 15000);
  });
}, 20000);
afterAll(() => { server.kill(); });

const client = () => io(`http://localhost:${PORT}`, { transports: ['websocket'] });
const call = (s: Socket, ev: string, data?: unknown) =>
  new Promise<any>((res) => s.emit(ev, data, res));
const nextState = (s: Socket, pred: (v: RoomView) => boolean = () => true) =>
  new Promise<RoomView>((res) => { const h = (v: RoomView) => { if (pred(v)) { s.off('room:state', h); res(v); } }; s.on('room:state', h); });

describe('socket server', () => {
  it('serves /healthz', async () => {
    expect(await (await fetch(`http://localhost:${PORT}/healthz`)).text()).toBe('ok');
  });

  it('runs a two-player game through the network', async () => {
    const a = client(); const b = client();
    const created = await call(a, 'room:create', { name: 'Asha' });
    expect(created.ok).toBe(true);
    const joined = await call(b, 'room:join', { code: created.code, name: 'Ravi' });
    expect(joined.ok).toBe(true);

    const started = nextState(a, (v) => v.phase === 'playing');
    expect((await call(b, 'room:start')).ok).toBe(false); // non-host
    expect((await call(a, 'room:start')).ok).toBe(true);
    const v = await started;
    const first = v.game!.players[v.game!.current]!.id;
    const [firstSock, otherSock, otherId] = first === created.playerId ? [a, b, joined.playerId] : [b, a, created.playerId];

    expect((await call(otherSock, 'game:action', { type: 'roll' })).ok).toBe(false); // not your turn
    expect((await call(firstSock, 'game:action', { type: 'nonsense' })).ok).toBe(false);
    const rolled = nextState(otherSock, (s) => s.game!.dice !== null);
    expect((await call(firstSock, 'game:action', { type: 'roll' })).ok).toBe(true);
    const after = await rolled;
    expect(after.game!.dice).toHaveLength(2);
    expect(JSON.stringify(after)).not.toContain('decks');
    expect(after.you).toBe(otherId);

    // reconnect with the session token
    b.disconnect();
    const b2 = client();
    expect((await call(b2, 'room:rejoin', { code: created.code, token: joined.token })).ok).toBe(true);
    expect((await call(b2, 'room:rejoin', { code: created.code, token: 'bad' })).ok).toBe(false);
    a.disconnect(); b2.disconnect();
  }, 15000);
});
