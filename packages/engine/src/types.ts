export type TileKind =
  | 'go' | 'property' | 'railway' | 'utility' | 'tax'
  | 'kismat' | 'samaj' | 'jail' | 'parking' | 'gotojail';

export interface Tile {
  id: number;
  name: string;
  kind: TileKind;
  group?: string;
  price?: number;
  houseCost?: number;
  /** property: [base, 1 house .. 4 houses, hotel]; railway: rent by railways owned (1..4) */
  rents?: number[];
  amount?: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  jailCards: number;
  bankrupt: boolean;
}

export type Phase = 'preRoll' | 'awaitBuy' | 'debt' | 'postRoll';

export interface Ownership {
  owner: string;
  /** 0-4 houses, 5 = hotel */
  houses: number;
  mortgaged: boolean;
}

export interface Debt {
  to: string | 'bank';
  amount: number;
  reason: string;
}

export interface TradeSide {
  cash: number;
  tiles: number[];
  jailCards: number;
}

export interface Trade {
  from: string;
  to: string;
  give: TradeSide; // from -> to
  get: TradeSide; // to -> from
}

export interface GameState {
  status: 'playing' | 'finished';
  players: Player[];
  current: number;
  phase: Phase;
  dice: [number, number] | null;
  doublesCount: number;
  extraRoll: boolean;
  pendingBuy: number | null;
  pendingMove: number | null;
  debt: Debt | null;
  owners: Record<number, Ownership>;
  trade: Trade | null;
  winner: string | null;
  turnNo: number;
  log: string[];
  /** Server-only. Stripped by toClientState. */
  decks: { kismat: number[]; samaj: number[] };
}

export type ClientGameState = Omit<GameState, 'decks'>;

export type Action =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'endTurn' }
  | { type: 'payDebt' }
  | { type: 'bankrupt' }
  | { type: 'resign' }
  | { type: 'payJailFine' }
  | { type: 'useJailCard' }
  | { type: 'build'; tile: number }
  | { type: 'sellHouse'; tile: number }
  | { type: 'mortgage'; tile: number }
  | { type: 'unmortgage'; tile: number }
  | { type: 'proposeTrade'; to: string; give: TradeSide; get: TradeSide }
  | { type: 'acceptTrade' }
  | { type: 'cancelTrade' };

/** Uniform random integer in [0, n). Injected so the server can use crypto and tests can be deterministic. */
export type Rng = (n: number) => number;

export type Result = { ok: true; state: GameState } | { ok: false; error: string };

/** What the server sends each client (per-recipient: `you` differs). */
export interface RoomView {
  code: string;
  hostId: string;
  you: string;
  maxPlayers: number;
  phase: 'lobby' | 'playing' | 'finished';
  members: { id: string; name: string; color: string; connected: boolean; isBot: boolean }[];
  game: ClientGameState | null;
}
