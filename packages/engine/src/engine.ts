import { BOARD, BOARD_SIZE, GO_SALARY, JAIL_FINE, JAIL_POS, START_CASH, groupTiles } from './board';
import { JAIL_FREE_CARD, KISMAT, SAMAJ, type Card } from './cards';
import type {
  Action, ClientGameState, GameState, Player, Result, Rng, Tile, TradeSide,
} from './types';

export class GameError extends Error {}
function fail(msg: string): never { throw new GameError(msg); }

const shuffle = <T>(arr: T[], rng: Rng): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

export function newGame(
  seats: { id: string; name: string; color: string }[],
  rng: Rng,
): GameState {
  const players: Player[] = shuffle(seats, rng).map((s) => ({
    ...s, cash: START_CASH, position: 0, inJail: false, jailTurns: 0, jailCards: 0, bankrupt: false,
  }));
  const s: GameState = {
    status: 'playing', players, current: 0, phase: 'preRoll', dice: null, doublesCount: 0,
    extraRoll: false, pendingBuy: null, pendingMove: null, debt: null, owners: {}, trade: null,
    winner: null, turnNo: 1, log: [],
    decks: {
      kismat: shuffle(KISMAT.map((_, i) => i), rng),
      samaj: shuffle(SAMAJ.map((_, i) => i), rng),
    },
  };
  log(s, `Game started. ${players[0]!.name} goes first.`);
  return s;
}

export const toClientState = ({ decks: _decks, ...rest }: GameState): ClientGameState => rest;

// ---------- helpers ----------

const cur = (s: GameState) => s.players[s.current]!;
const player = (s: GameState, id: string) => s.players.find((p) => p.id === id);
const active = (s: GameState) => s.players.filter((p) => !p.bankrupt);
const log = (s: GameState, msg: string) => { s.log.push(msg); if (s.log.length > 80) s.log.shift(); };
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const ownsGroup = (s: GameState, pid: string, group: string) =>
  groupTiles(group).every((t) => s.owners[t.id]?.owner === pid);

const countKind = (s: GameState, pid: string, kind: Tile['kind']) =>
  BOARD.filter((t) => t.kind === kind && s.owners[t.id]?.owner === pid).length;

export function rentFor(s: GameState, tileId: number): number {
  const t = BOARD[tileId]!;
  const o = s.owners[tileId];
  if (!o || o.mortgaged) return 0;
  if (t.kind === 'railway') return t.rents![countKind(s, o.owner, 'railway') - 1]!;
  if (t.kind === 'utility') {
    const total = s.dice ? s.dice[0] + s.dice[1] : 0;
    return total * (countKind(s, o.owner, 'utility') === 2 ? 100 : 40);
  }
  if (o.houses > 0) return t.rents![o.houses]!;
  return t.rents![0]! * (ownsGroup(s, o.owner, t.group!) ? 2 : 1);
}

/** Charge the current player. If they cannot afford it, enter the debt phase. */
function charge(s: GameState, amount: number, to: string | 'bank', reason: string): boolean {
  const p = cur(s);
  if (amount <= 0) return true;
  if (p.cash >= amount) {
    p.cash -= amount;
    if (to !== 'bank') player(s, to)!.cash += amount;
    return true;
  }
  s.debt = { to, amount, reason };
  s.phase = 'debt';
  log(s, `${p.name} owes ${inr(amount)} (${reason}) and must raise funds or go bankrupt.`);
  return false;
}

const settle = (s: GameState) => { s.phase = s.extraRoll ? 'preRoll' : 'postRoll'; };
const pending = (s: GameState) => s.phase === 'awaitBuy' || s.phase === 'debt';

function sendToJail(s: GameState) {
  const p = cur(s);
  p.position = JAIL_POS;
  p.inJail = true;
  p.jailTurns = 0;
  s.extraRoll = false;
  log(s, `${p.name} goes to Jail.`);
}

function advance(s: GameState, steps: number) {
  const p = cur(s);
  const to = (p.position + steps + BOARD_SIZE) % BOARD_SIZE;
  if (steps > 0 && to < p.position) {
    p.cash += GO_SALARY;
    log(s, `${p.name} passes Start and collects ${inr(GO_SALARY)}.`);
  }
  p.position = to;
  land(s);
}

function land(s: GameState) {
  const p = cur(s);
  const t = BOARD[p.position]!;
  log(s, `${p.name} lands on ${t.name}.`);
  switch (t.kind) {
    case 'gotojail': sendToJail(s); break;
    case 'tax': charge(s, t.amount!, 'bank', t.name); break;
    case 'kismat': draw(s, 'kismat'); break;
    case 'samaj': draw(s, 'samaj'); break;
    case 'property': case 'railway': case 'utility': {
      const o = s.owners[t.id];
      if (!o) {
        if (p.cash >= t.price!) { s.phase = 'awaitBuy'; s.pendingBuy = t.id; }
        else log(s, `${p.name} cannot afford ${t.name}.`);
      } else if (o.owner !== p.id && !o.mortgaged) {
        const rent = rentFor(s, t.id);
        if (charge(s, rent, o.owner, `rent for ${t.name}`)) {
          log(s, `${p.name} pays ${inr(rent)} rent to ${player(s, o.owner)!.name}.`);
        }
      }
      break;
    }
  }
  if (!pending(s)) settle(s);
}

function draw(s: GameState, deckName: 'kismat' | 'samaj') {
  const deck = s.decks[deckName];
  const id = deck.shift()!;
  const card: Card = (deckName === 'kismat' ? KISMAT : SAMAJ)[id]!;
  const p = cur(s);
  log(s, `${card.text}`);
  const e = card.effect;
  if (e.kind === 'jailFree') p.jailCards++;
  else deck.push(id);
  switch (e.kind) {
    case 'gain': p.cash += e.amount; break;
    case 'pay': charge(s, e.amount, 'bank', 'card'); break;
    case 'moveTo': advance(s, (e.tile - p.position + BOARD_SIZE) % BOARD_SIZE); break;
    case 'moveBack': advance(s, -e.steps); break;
    case 'jail': sendToJail(s); break;
    case 'repairs': {
      let cost = 0;
      for (const o of Object.values(s.owners)) {
        if (o.owner === p.id) cost += o.houses === 5 ? e.hotel : o.houses * e.house;
      }
      charge(s, cost, 'bank', 'repairs');
      break;
    }
  }
}

function endTurn(s: GameState) {
  s.doublesCount = 0;
  s.extraRoll = false;
  s.pendingBuy = null;
  s.pendingMove = null;
  s.debt = null;
  let i = s.current;
  do { i = (i + 1) % s.players.length; } while (s.players[i]!.bankrupt);
  s.current = i;
  s.phase = 'preRoll';
  s.turnNo++;
  log(s, `${cur(s).name}'s turn.`);
}

function releaseAssets(s: GameState, pid: string, to: string | 'bank') {
  for (const [id, o] of Object.entries(s.owners)) {
    if (o.owner !== pid) continue;
    if (to === 'bank') delete s.owners[Number(id)];
    else { o.owner = to; o.houses = 0; }
  }
}

function bankrupt(s: GameState, p: Player, to: string | 'bank') {
  const wasCurrent = cur(s).id === p.id;
  releaseAssets(s, p.id, to);
  if (to !== 'bank') {
    const c = player(s, to)!;
    c.cash += p.cash;
    c.jailCards += p.jailCards;
  }
  p.cash = 0;
  p.jailCards = 0;
  p.bankrupt = true;
  if (s.trade && (s.trade.from === p.id || s.trade.to === p.id)) s.trade = null;
  log(s, `${p.name} is bankrupt and out of the game.`);
  const left = active(s);
  if (left.length === 1) {
    s.status = 'finished';
    s.winner = left[0]!.id;
    s.phase = 'postRoll';
    log(s, `${left[0]!.name} wins the game!`);
  } else if (wasCurrent) endTurn(s);
}

// ---------- validation ----------

const tileIdOf = (v: unknown): number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < BOARD_SIZE ? (v as number) : fail('Invalid tile.');
const moneyOf = (v: unknown): number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1e9 ? (v as number) : fail('Invalid amount.');

function ownedByCurrent(s: GameState, tile: unknown) {
  const id = tileIdOf(tile);
  const o = s.owners[id];
  if (!o || o.owner !== cur(s).id) fail('You do not own that property.');
  return { t: BOARD[id]!, o: o! };
}

const groupOwnerships = (s: GameState, group: string) => groupTiles(group).map((t) => s.owners[t.id]!);

function checkSide(s: GameState, pid: string, side: TradeSide) {
  const p = player(s, pid)!;
  moneyOf(side.cash);
  moneyOf(side.jailCards);
  if (side.cash > p.cash) fail(`${p.name} does not have that much cash.`);
  if (side.jailCards > p.jailCards) fail(`${p.name} does not have that many jail cards.`);
  if (!Array.isArray(side.tiles) || new Set(side.tiles).size !== side.tiles.length) fail('Invalid tiles.');
  for (const raw of side.tiles) {
    const id = tileIdOf(raw);
    const o = s.owners[id];
    if (!o || o.owner !== pid) fail(`${p.name} does not own ${BOARD[id]!.name}.`);
    const g = BOARD[id]!.group;
    if (g && groupOwnerships(s, g).some((x) => x && x.houses > 0)) fail('Sell all buildings in a colour group before trading it.');
  }
}

const sideEmpty = (x: TradeSide) => x.cash === 0 && x.jailCards === 0 && x.tiles.length === 0;

function moveSide(s: GameState, from: string, to: string, side: TradeSide) {
  const a = player(s, from)!;
  const b = player(s, to)!;
  a.cash -= side.cash; b.cash += side.cash;
  a.jailCards -= side.jailCards; b.jailCards += side.jailCards;
  for (const id of side.tiles) s.owners[id]!.owner = to;
}

// ---------- reducer ----------

function run(s: GameState, pid: string, a: Action, rng: Rng) {
  if (s.status === 'finished') fail('The game is over.');
  const me = player(s, pid);
  if (!me || me.bankrupt) fail('You are not in this game.');

  // Trades can happen at any time, by any active player.
  switch (a.type) {
    case 'proposeTrade': {
      if (s.trade) fail('Another trade is already pending.');
      const target = player(s, String(a.to));
      if (!target || target.bankrupt || target.id === pid) fail('Invalid trade partner.');
      checkSide(s, pid, a.give);
      checkSide(s, a.to, a.get);
      if (sideEmpty(a.give) && sideEmpty(a.get)) fail('Empty trade.');
      s.trade = {
        from: pid, to: a.to,
        give: { cash: a.give.cash, tiles: [...a.give.tiles], jailCards: a.give.jailCards },
        get: { cash: a.get.cash, tiles: [...a.get.tiles], jailCards: a.get.jailCards },
      };
      log(s, `${me.name} proposes a trade to ${target!.name}.`);
      return;
    }
    case 'acceptTrade': {
      const t = s.trade;
      if (!t || t.to !== pid) fail('No trade for you to accept.');
      checkSide(s, t!.from, t!.give);
      checkSide(s, t!.to, t!.get);
      moveSide(s, t!.from, t!.to, t!.give);
      moveSide(s, t!.to, t!.from, t!.get);
      s.trade = null;
      log(s, `${me.name} accepted the trade with ${player(s, t!.from)!.name}.`);
      return;
    }
    case 'cancelTrade': {
      const t = s.trade;
      if (!t || (t.from !== pid && t.to !== pid)) fail('No trade to cancel.');
      s.trade = null;
      log(s, `${me.name} ${t!.from === pid ? 'withdrew' : 'declined'} the trade.`);
      return;
    }
  }

  if (a.type === 'resign') {
    bankrupt(s, me!, 'bank'); // resigning never enriches another player
    return;
  }

  if (cur(s).id !== pid) fail('It is not your turn.');
  const p = cur(s);

  switch (a.type) {
    case 'roll': {
      if (s.phase !== 'preRoll') fail('You cannot roll now.');
      const d1 = rng(6) + 1;
      const d2 = rng(6) + 1;
      const dbl = d1 === d2;
      s.dice = [d1, d2];
      log(s, `${p.name} rolls ${d1} + ${d2}.`);
      if (p.inJail) {
        if (dbl) {
          p.inJail = false; p.jailTurns = 0;
          log(s, `${p.name} rolled doubles and leaves Jail.`);
        } else if (++p.jailTurns >= 3) {
          p.inJail = false; p.jailTurns = 0;
          log(s, `${p.name} has served time and pays the fine.`);
          if (!charge(s, JAIL_FINE, 'bank', 'jail fine')) { s.pendingMove = d1 + d2; return; }
        } else {
          s.phase = 'postRoll';
          return;
        }
        s.extraRoll = false;
        advance(s, d1 + d2);
        return;
      }
      s.doublesCount = dbl ? s.doublesCount + 1 : 0;
      if (s.doublesCount === 3) {
        log(s, `${p.name} rolled three doubles in a row.`);
        sendToJail(s);
        settle(s);
        return;
      }
      s.extraRoll = dbl;
      advance(s, d1 + d2);
      return;
    }
    case 'buy': {
      if (s.phase !== 'awaitBuy' || s.pendingBuy === null) fail('Nothing to buy.');
      const t = BOARD[s.pendingBuy!]!;
      if (p.cash < t.price!) fail('Not enough cash.');
      p.cash -= t.price!;
      s.owners[t.id] = { owner: p.id, houses: 0, mortgaged: false };
      s.pendingBuy = null;
      log(s, `${p.name} buys ${t.name} for ${inr(t.price!)}.`);
      settle(s);
      return;
    }
    case 'decline': {
      if (s.phase !== 'awaitBuy') fail('Nothing to decline.');
      s.pendingBuy = null;
      settle(s);
      return;
    }
    case 'endTurn': {
      if (s.phase !== 'postRoll') fail(s.phase === 'preRoll' ? 'You must roll first.' : 'Resolve the pending action first.');
      endTurn(s);
      return;
    }
    case 'payDebt': {
      if (s.phase !== 'debt' || !s.debt) fail('You owe nothing.');
      const d = s.debt!;
      if (p.cash < d.amount) fail('Not enough cash. Mortgage or sell to raise funds, or declare bankruptcy.');
      p.cash -= d.amount;
      if (d.to !== 'bank') player(s, d.to)!.cash += d.amount;
      s.debt = null;
      settle(s); // leave the debt phase first, or a harmless landing below would leave the turn stuck in it
      log(s, `${p.name} pays ${inr(d.amount)}.`);
      if (s.pendingMove !== null) {
        const steps = s.pendingMove;
        s.pendingMove = null;
        s.extraRoll = false;
        advance(s, steps);
      }
      return;
    }
    case 'bankrupt': {
      bankrupt(s, p, s.debt?.to ?? 'bank');
      return;
    }
    case 'payJailFine': {
      if (s.phase !== 'preRoll' || !p.inJail) fail('Not applicable.');
      if (p.cash < JAIL_FINE) fail('Not enough cash.');
      p.cash -= JAIL_FINE; p.inJail = false; p.jailTurns = 0;
      log(s, `${p.name} pays ${inr(JAIL_FINE)} to leave Jail.`);
      return;
    }
    case 'useJailCard': {
      if (s.phase !== 'preRoll' || !p.inJail) fail('Not applicable.');
      if (p.jailCards < 1) fail('You have no Get Out of Jail Free card.');
      p.jailCards--; p.inJail = false; p.jailTurns = 0;
      s.decks.kismat.push(JAIL_FREE_CARD);
      log(s, `${p.name} uses a Get Out of Jail Free card.`);
      return;
    }
  }

  // Property management: current player, outside of the buy prompt.
  if (s.phase === 'awaitBuy') fail('Buy or decline the property first.');
  switch (a.type) {
    case 'build': {
      const { t, o } = ownedByCurrent(s, a.tile);
      if (t.kind !== 'property') fail('You can only build on city properties.');
      if (s.phase === 'debt') fail('Settle your debt first.');
      if (!ownsGroup(s, p.id, t.group!)) fail('You need the whole colour group.');
      const grp = groupOwnerships(s, t.group!);
      if (grp.some((x) => x.mortgaged)) fail('Unmortgage the whole group first.');
      if (o.houses >= 5) fail('Already a hotel.');
      if (o.houses > Math.min(...grp.map((x) => x.houses))) fail('Build evenly across the group.');
      if (p.cash < t.houseCost!) fail('Not enough cash.');
      p.cash -= t.houseCost!;
      o.houses++;
      log(s, `${p.name} builds a ${o.houses === 5 ? 'hotel' : 'house'} on ${t.name}.`);
      return;
    }
    case 'sellHouse': {
      const { t, o } = ownedByCurrent(s, a.tile);
      if (o.houses < 1) fail('No buildings to sell.');
      if (o.houses < Math.max(...groupOwnerships(s, t.group!).map((x) => x.houses))) fail('Sell evenly across the group.');
      o.houses--;
      p.cash += t.houseCost! / 2;
      log(s, `${p.name} sells a building on ${t.name}.`);
      return;
    }
    case 'mortgage': {
      const { t, o } = ownedByCurrent(s, a.tile);
      if (o.mortgaged) fail('Already mortgaged.');
      if (t.group && groupOwnerships(s, t.group).some((x) => x && x.houses > 0)) fail('Sell all buildings in the group first.');
      o.mortgaged = true;
      p.cash += t.price! / 2;
      log(s, `${p.name} mortgages ${t.name}.`);
      return;
    }
    case 'unmortgage': {
      const { t, o } = ownedByCurrent(s, a.tile);
      if (!o.mortgaged) fail('Not mortgaged.');
      if (s.phase === 'debt') fail('Settle your debt first.');
      const cost = Math.ceil((t.price! / 2) * 1.1);
      if (p.cash < cost) fail('Not enough cash.');
      p.cash -= cost;
      o.mortgaged = false;
      log(s, `${p.name} unmortgages ${t.name} for ${inr(cost)}.`);
      return;
    }
  }
  fail('Unknown action.');
}

/** Pure entry point: never mutates `state`; returns the next state or an error message. */
export function applyAction(state: GameState, playerId: string, action: Action, rng: Rng): Result {
  if (!action || typeof action !== 'object') return { ok: false, error: 'Invalid action.' };
  const next = structuredClone(state);
  try {
    run(next, playerId, action, rng);
    return { ok: true, state: next };
  } catch (e) {
    if (e instanceof GameError) return { ok: false, error: e.message };
    throw e;
  }
}
