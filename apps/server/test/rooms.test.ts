import { describe, expect, it } from 'vitest';
import * as R from '../src/rooms';
import { botAction } from '../src/bot';

const online = (m: R.Member) => { m.socketId = 's-' + m.id; };

describe('rooms', () => {
  it('creates, joins, starts and never leaks secrets', () => {
    const { room, me: host } = R.createRoom('  Asha  ');
    online(host);
    expect(host.name).toBe('Asha');
    expect(room.code).toMatch(/^[A-Z2-9]{5}$/);
    const { me: guest } = R.joinRoom(room.code.toLowerCase(), 'Ravi');
    online(guest);
    expect(() => R.joinRoom(room.code, 'asha')).toThrow(/taken/);
    expect(() => R.startGame(room, guest.id)).toThrow(/host/);
    R.startGame(room, host.id);
    expect(() => R.joinRoom(room.code, 'Late')).toThrow(/started/);
    const v = JSON.stringify(R.view(room, host.id));
    expect(v).not.toContain(host.token);
    expect(v).not.toContain('decks');
  });

  it('enforces the 10 player cap and needs 2 players', () => {
    const { room, me: host } = R.createRoom('P0');
    online(host);
    expect(() => R.startGame(room, room.hostId)).toThrow(/at least/);
    for (let i = 1; i < 10; i++) online(R.joinRoom(room.code, `P${i}`).me);
    expect(() => R.joinRoom(room.code, 'P10')).toThrow(/full/);
  });

  it('rejects actions from strangers and bad payloads', () => {
    const { room, me: a } = R.createRoom('A');
    const { me: b } = R.joinRoom(room.code, 'B');
    online(a); online(b);
    R.startGame(room, a.id);
    expect(() => R.gameAction(room, 'nobody', { type: 'roll' })).toThrow();
    expect(() => R.gameAction(room, a.id, { type: 'build', tile: 'x' } as never)).toThrow();
    expect(() => R.gameAction(room, a.id, null as never)).toThrow();
  });

  it('adds and removes bots, and honours the chosen room size', () => {
    const { room, me: host } = R.createRoom('Asha', 3);
    online(host);
    expect(room.maxPlayers).toBe(3);
    R.addBot(room, host.id);
    R.addBot(room, host.id);
    expect(room.members.filter((m) => m.isBot)).toHaveLength(2);
    expect(() => R.addBot(room, host.id)).toThrow(/full/);
    expect(() => R.joinRoom(room.code, 'Ravi')).toThrow(/full/);
    const bot = room.members.find((m) => m.isBot)!;
    expect(() => R.removeMember(room, bot.id, bot.id)).toThrow(/host/);
    R.removeMember(room, host.id, bot.id);
    expect(room.members).toHaveLength(2);
    expect(() => R.removeMember(room, host.id, host.id)).toThrow(/host cannot/);
    R.startGame(room, host.id); // bots count as players even though nobody is connected for them
    expect(room.game!.players).toHaveLength(2);
    expect(() => R.addBot(room, host.id)).toThrow(/started/);
  });

  it('bots only ever pick legal actions, so a turn never stalls', () => {
    const { room, me: host } = R.createRoom('Asha', 2);
    online(host);
    R.addBot(room, host.id);
    R.startGame(room, host.id);
    for (let i = 0; i < 3000 && room.game!.status === 'playing'; i++) {
      const cur = room.game!.players[room.game!.current]!;
      R.gameAction(room, cur.id, botAction(room.game!)); // throws if the bot ever picks an illegal action
    }
    // The game may still be running: two bots that never complete a colour group can trade rent forever.
    expect(room.game!.turnNo).toBeGreaterThan(20);
  });

  it('rejoins by token and sweeps stale rooms', () => {
    const { room, me } = R.createRoom('A');
    expect(R.rejoinRoom(room.code, me.token).me.id).toBe(me.id);
    expect(() => R.rejoinRoom(room.code, 'wrong')).toThrow();
    R.sweep(1000, Date.now() + 10_000);
    expect(R.rooms.has(room.code)).toBe(false);
  });
});
