import { describe, expect, it } from 'vitest';
import { applyAction, newGame, toClientState, BOARD, START_CASH, GO_SALARY, JAIL_FINE, type Action, type GameState, type Rng } from '../src';

/** rng that plays back die faces (1-6) for rng(6) calls; shuffles use 0. */
const dice = (...faces: number[]): Rng => {
  const q = [...faces];
  return (n) => (n === 6 && q.length ? q.shift()! - 1 : 0);
};
const zero: Rng = () => 0;

function game(n = 3): GameState {
  const s = newGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: '#fff' })), zero);
  return s;
}
const ids = (s: GameState) => s.players.map((p) => p.id);
const act = (s: GameState, pid: string, a: Action, rng: Rng = zero) => {
  const r = applyAction(s, pid, a, rng);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const giveGroup = (s: GameState, pid: string, tiles: number[]) => tiles.forEach((t) => (s.owners[t] = { owner: pid, houses: 0, mortgaged: false }));

describe('turn flow', () => {
  it('moves, offers purchase, and buys', () => {
    let s = game();
    const [a] = ids(s) as [string];
    s = act(s, a, { type: 'roll' }, dice(1, 2)); // -> tile 3 Shillong
    expect(s.players[0]!.position).toBe(3);
    expect(s.phase).toBe('awaitBuy');
    s = act(s, a, { type: 'buy' });
    expect(s.owners[3]!.owner).toBe(a);
    expect(s.players[0]!.cash).toBe(START_CASH - 600);
    expect(s.phase).toBe('postRoll');
    s = act(s, a, { type: 'endTurn' });
    expect(s.current).toBe(1);
  });

  it('rejects out-of-turn actions without mutating state', () => {
    const s = game();
    const before = JSON.stringify(s);
    const r = applyAction(s, ids(s)[1]!, { type: 'roll' }, zero);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('pays salary when passing Start', () => {
    let s = game();
    s.players[0]!.position = 38;
    s = act(s, ids(s)[0]!, { type: 'roll' }, dice(1, 2)); // 38+3 -> 1
    expect(s.players[0]!.position).toBe(1);
    expect(s.players[0]!.cash).toBe(START_CASH + GO_SALARY);
  });

  it('grants an extra roll on doubles and jails on the third', () => {
    let s = game();
    const a = ids(s)[0]!;
    s.players[0]!.position = 4; // 4+2 -> 6 (Kochi), then 6+4 -> 10 (Jail, harmless)
    s = act(s, a, { type: 'roll' }, dice(1, 1));
    expect(s.phase).toBe('awaitBuy');
    s = act(s, a, { type: 'decline' });
    expect(s.phase).toBe('preRoll'); // doubles: roll again
    s.doublesCount = 2;
    s = act(s, a, { type: 'roll' }, dice(3, 3));
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.players[0]!.position).toBe(10);
    expect(s.phase).toBe('postRoll');
  });
});

describe('rent', () => {
  it('doubles on an unimproved full colour group', () => {
    let s = game();
    const [a, b] = ids(s) as [string, string];
    giveGroup(s, b, [1, 3]);
    const cash = s.players[0]!.cash;
    s = act(s, a, { type: 'roll' }, dice(1, 2)); // tile 3, rent 40 * 2
    expect(s.players[0]!.cash).toBe(cash - 80);
    expect(s.players[1]!.cash).toBeGreaterThanOrEqual(START_CASH + 80);
  });

  it('railway rent scales with railways owned', () => {
    const s = game();
    giveGroup(s, 'p1', [5, 15]);
    expect(BOARD[5]!.rents![1]).toBe(500);
  });
});

describe('buildings & mortgages', () => {
  it('requires the full group and builds evenly', () => {
    let s = game();
    const a = ids(s)[0]!;
    giveGroup(s, a, [1]);
    expect(applyAction(s, a, { type: 'build', tile: 1 }, zero).ok).toBe(false);
    giveGroup(s, a, [3]);
    s = act(s, a, { type: 'build', tile: 1 });
    expect(applyAction(s, a, { type: 'build', tile: 1 }, zero).ok).toBe(false); // uneven
    s = act(s, a, { type: 'build', tile: 3 });
    expect(s.owners[1]!.houses).toBe(1);
    expect(s.owners[3]!.houses).toBe(1);
  });

  it('mortgage pays half, unmortgage costs +10%', () => {
    let s = game();
    const a = ids(s)[0]!;
    giveGroup(s, a, [6]);
    s = act(s, a, { type: 'mortgage', tile: 6 });
    expect(s.players[0]!.cash).toBe(START_CASH + 500);
    s = act(s, a, { type: 'unmortgage', tile: 6 });
    expect(s.players[0]!.cash).toBe(START_CASH + 500 - 550);
  });
});

describe('debt and bankruptcy', () => {
  it('enters debt, then bankruptcy transfers assets and ends the game', () => {
    let s = game(2);
    const [a, b] = ids(s) as [string, string];
    giveGroup(s, a, [6]);
    giveGroup(s, b, [8]);
    s.players[0]!.cash = 10;
    s.players[1]!.position = 0;
    s = act(s, a, { type: 'roll' }, dice(4, 4)); // tile 8 owned by b, doubles; rent 60
    expect(s.phase).toBe('debt');
    expect(applyAction(s, a, { type: 'payDebt' }, zero).ok).toBe(false);
    s = act(s, a, { type: 'bankrupt' });
    expect(s.players[0]!.bankrupt).toBe(true);
    expect(s.owners[6]!.owner).toBe(b);
    expect(s.status).toBe('finished');
    expect(s.winner).toBe(b);
  });

  it('can raise funds by mortgaging and then pay', () => {
    let s = game(2);
    const [a, b] = ids(s) as [string, string];
    giveGroup(s, a, [1]);
    giveGroup(s, b, [8]);
    s.players[0]!.cash = 10;
    s = act(s, a, { type: 'roll' }, dice(4, 4));
    expect(s.phase).toBe('debt');
    s = act(s, a, { type: 'mortgage', tile: 1 });
    s = act(s, a, { type: 'payDebt' });
    expect(s.phase).toBe('preRoll'); // doubles -> roll again
    expect(s.players[1]!.cash).toBe(START_CASH + 60);
  });
});

describe('jail', () => {
  it('leaves on doubles; pays the fine on the third failed roll', () => {
    let s = game();
    const a = ids(s)[0]!;
    s.players[0]!.inJail = true; s.players[0]!.position = 10;
    s = act(s, a, { type: 'roll' }, dice(1, 2));
    expect(s.players[0]!.inJail).toBe(true);
    expect(s.phase).toBe('postRoll');
    s.phase = 'preRoll';
    s = act(s, a, { type: 'roll' }, dice(1, 2));
    s.phase = 'preRoll';
    s = act(s, a, { type: 'roll' }, dice(1, 2)); // 3rd failure: fine + move 3 -> tile 13
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.position).toBe(13);
    expect(s.players[0]!.cash).toBeLessThanOrEqual(START_CASH - JAIL_FINE);
  });

  it('is not stuck in the debt phase after paying an unaffordable fine', () => {
    let s = game(2);
    const a = ids(s)[0]!;
    s.players[0]!.inJail = true; s.players[0]!.position = 10; s.players[0]!.jailTurns = 2;
    s.players[0]!.cash = 10;
    giveGroup(s, a, [39, 13]); // 13 is where the held move lands: their own tile, so nothing happens there
    s = act(s, a, { type: 'roll' }, dice(1, 2)); // 3rd failure: fine is unaffordable, move is held
    expect(s.phase).toBe('debt');
    s = act(s, a, { type: 'mortgage', tile: 39 });
    s = act(s, a, { type: 'payDebt' }); // pays, then moves 3 -> tile 13, a harmless tile
    expect(s.players[0]!.position).toBe(13);
    expect(s.phase).toBe('postRoll');
    s = act(s, a, { type: 'endTurn' });
    expect(s.current).toBe(1);
  });

  it('can pay the fine before rolling', () => {
    let s = game();
    const a = ids(s)[0]!;
    s.players[0]!.inJail = true; s.players[0]!.position = 10;
    s = act(s, a, { type: 'payJailFine' });
    expect(s.players[0]!.inJail).toBe(false);
    expect(s.players[0]!.cash).toBe(START_CASH - JAIL_FINE);
  });
});

describe('trading', () => {
  it('swaps cash and property when accepted, validates ownership', () => {
    let s = game();
    const [a, b] = ids(s) as [string, string];
    giveGroup(s, a, [6]);
    const empty = { cash: 0, tiles: [], jailCards: 0 };
    expect(applyAction(s, b, { type: 'proposeTrade', to: a, give: { ...empty, tiles: [6] }, get: empty }, zero).ok).toBe(false);
    s = act(s, a, { type: 'proposeTrade', to: b, give: { ...empty, tiles: [6] }, get: { ...empty, cash: 900 } });
    expect(applyAction(s, a, { type: 'acceptTrade' }, zero).ok).toBe(false); // proposer can't accept
    s = act(s, b, { type: 'acceptTrade' });
    expect(s.owners[6]!.owner).toBe(b);
    expect(s.players.find((p) => p.id === a)!.cash).toBe(START_CASH + 900);
    expect(s.trade).toBeNull();
  });
});

describe('client view', () => {
  it('hides the decks', () => {
    expect('decks' in toClientState(game())).toBe(false);
  });
});

describe('resign', () => {
  it('lets a non-current player leave; their assets return to the bank', () => {
    let s = game(3);
    const [, b] = ids(s) as [string, string];
    giveGroup(s, b, [6]);
    s = act(s, b, { type: 'resign' });
    expect(s.players[1]!.bankrupt).toBe(true);
    expect(s.owners[6]).toBeUndefined();
    expect(s.current).toBe(0);
    expect(s.status).toBe('playing');
  });
  it('advances the turn if the current player resigns', () => {
    let s = game(3);
    s = act(s, ids(s)[0]!, { type: 'resign' });
    expect(s.current).toBe(1);
  });
});
