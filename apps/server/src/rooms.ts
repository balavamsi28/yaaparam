import { randomBytes, randomInt } from 'node:crypto';
import {
  MAX_PLAYERS, MIN_PLAYERS, applyAction, newGame, toClientState,
  type Action, type GameState, type RoomView,
} from '@nagarseth/engine';

export const COLORS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#8e6bd8', '#e76fb0', '#6d9f3c', '#00b4d8', '#9c6644'];
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I/L)
const MAX_ROOMS = 1000;

export interface Member {
  id: string;
  name: string;
  color: string;
  token: string; // secret; never sent to other clients
  socketId: string | null;
  isBot: boolean;
}

export interface Room {
  code: string;
  hostId: string;
  members: Member[];
  maxPlayers: number;
  game: GameState | null;
  touched: number;
}

export class RoomError extends Error {}
const bad = (m: string): never => { throw new RoomError(m); };

export const rng = (n: number) => randomInt(n);
export const rooms = new Map<string, Room>();

export function cleanName(v: unknown): string {
  const n = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 20) : '';
  return n || bad('Please enter a name.');
}

function newMember(room: Room | null, name: string, isBot = false): Member {
  const used = new Set(room?.members.map((m) => m.color));
  return {
    id: randomBytes(6).toString('hex'),
    token: randomBytes(24).toString('hex'),
    name,
    color: COLORS.find((c) => !used.has(c)) ?? COLORS[0]!,
    socketId: isBot ? 'bot' : null,
    isBot,
  };
}

export function createRoom(name: unknown, maxPlayers?: unknown): { room: Room; me: Member } {
  if (rooms.size >= MAX_ROOMS) bad('The server is busy. Try again later.');
  const max = typeof maxPlayers === 'number' && maxPlayers >= MIN_PLAYERS && maxPlayers <= MAX_PLAYERS
    ? maxPlayers : MAX_PLAYERS;
  let code: string;
  do { code = Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''); } while (rooms.has(code));
  const me = newMember(null, cleanName(name));
  const room: Room = { code, hostId: me.id, members: [me], maxPlayers: max, game: null, touched: Date.now() };
  rooms.set(code, room);
  return { room, me };
}

export function getRoom(code: unknown): Room {
  return (typeof code === 'string' && rooms.get(code.trim().toUpperCase())) || bad('Room not found.');
}

export function joinRoom(code: unknown, name: unknown): { room: Room; me: Member } {
  const room = getRoom(code);
  if (room.game) bad('That game has already started.');
  if (room.members.length >= room.maxPlayers) room.members = room.members.filter((m) => m.socketId); // drop ghosts
  if (room.members.length >= room.maxPlayers) bad(`Room is full (max ${room.maxPlayers}).`);
  const n = cleanName(name);
  if (room.members.some((m) => m.name.toLowerCase() === n.toLowerCase())) bad('That name is taken in this room.');
  const me = newMember(room, n);
  room.members.push(me);
  room.touched = Date.now();
  return { room, me };
}

export function rejoinRoom(code: unknown, token: unknown): { room: Room; me: Member } {
  const room = getRoom(code);
  const me = room.members.find((m) => typeof token === 'string' && m.token === token) ?? bad('Session expired.');
  return { room, me: me! };
}

export function leaveLobby(room: Room, id: string) {
  room.members = room.members.filter((m) => m.id !== id);
  if (room.hostId === id && room.members[0]) room.hostId = room.members[0].id;
  if (!room.members.length) rooms.delete(room.code);
}

/** If the host is offline, hand the host role to the first online member. */
export function reassignHost(room: Room) {
  const host = room.members.find((m) => m.id === room.hostId);
  if (host?.socketId) return;
  const next = room.members.find((m) => m.socketId);
  if (next) room.hostId = next.id;
}

const BOT_NAMES = ['Vikram', 'Priya', 'Anand', 'Rohan', 'Meera', 'Arjun', 'Kavya', 'Suresh'];

export function addBot(room: Room, byId: string) {
  if (byId !== room.hostId) bad('Only the host can add bots.');
  if (room.game) bad('Already started.');
  if (room.members.length >= room.maxPlayers) bad(`Room is full (max ${room.maxPlayers}).`);
  const used = new Set(room.members.map((m) => m.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${room.members.length}`;
  room.members.push(newMember(room, name, true));
  room.touched = Date.now();
}

export function removeMember(room: Room, byId: string, targetId: unknown) {
  if (byId !== room.hostId) bad('Only the host can remove players.');
  if (room.game) bad('Already started.');
  const target = room.members.find((m) => m.id === targetId) ?? bad('No such player.');
  if (target.id === room.hostId) bad('The host cannot be removed.');
  leaveLobby(room, target.id);
}

export function startGame(room: Room, byId: string) {
  if (byId !== room.hostId) bad('Only the host can start the game.');
  if (room.game) bad('Already started.');
  room.members = room.members.filter((m) => m.isBot || m.socketId); // offline lobby members are dropped
  if (room.members.length < MIN_PLAYERS) bad(`Need at least ${MIN_PLAYERS} players.`);
  room.game = newGame(room.members.map(({ id, name, color }) => ({ id, name, color })), rng);
}

export function rematch(room: Room, byId: string) {
  if (byId !== room.hostId) bad('Only the host can do that.');
  if (room.game?.status !== 'finished') bad('The game is not over.');
  room.game = null;
  room.members = room.members.filter((m) => m.socketId);
}

export function gameAction(room: Room, byId: string, action: Action) {
  if (!room.game) bad('The game has not started.');
  const r = applyAction(room.game!, byId, action, rng);
  if (!r.ok) bad(r.error);
  if (r.ok) room.game = r.state;
  room.touched = Date.now();
}

/** Host can remove a player who is offline so the game never stalls. */
export function removeOffline(room: Room, byId: string, targetId: unknown) {
  if (byId !== room.hostId) bad('Only the host can remove players.');
  const t = room.members.find((m) => m.id === targetId) ?? bad('No such player.');
  if (t!.socketId) bad('That player is online.');
  if (!room.game) return leaveLobby(room, t!.id);
  const r = applyAction(room.game, t!.id, { type: 'resign' }, rng);
  if (r.ok) room.game = r.state;
}

export function view(room: Room, you: string): RoomView {
  return {
    code: room.code,
    hostId: room.hostId,
    you,
    maxPlayers: room.maxPlayers,
    phase: !room.game ? 'lobby' : room.game.status === 'finished' ? 'finished' : 'playing',
    members: room.members.map((m) => ({ id: m.id, name: m.name, color: m.color, connected: !!m.socketId, isBot: m.isBot })),
    game: room.game ? toClientState(room.game) : null,
  };
}

/** Drop rooms nobody has touched for `maxAgeMs` and that have no one online. */
export function sweep(maxAgeMs: number, now = Date.now()) {
  for (const [code, r] of rooms) {
    if (now - r.touched > maxAgeMs && !r.members.some((m) => m.socketId)) rooms.delete(code);
  }
}
