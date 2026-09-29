import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BOARD, GROUP_COLORS, type ClientGameState, type Tile } from '@yaaparam/engine';

const pos = (i: number) =>
  i <= 10 ? { row: 11, col: 11 - i, side: 'b' }
  : i <= 20 ? { row: 11 - (i - 10), col: 1, side: 'l' }
  : i <= 30 ? { row: 1, col: 1 + (i - 20), side: 't' }
  : { row: 1 + (i - 30), col: 11, side: 'r' };

// Mirrors .board's grid-template-columns/rows in styles.css (corners are wider).
const TRACK = [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5];
const TRACK_END = TRACK.reduce<number[]>((acc, w) => [...acc, (acc.at(-1) ?? 0) + w], []);
const TRACK_TOTAL = TRACK_END.at(-1)!;
/** Percentage (0-100) of the center of grid line `n` (1-indexed) along the board. */
const center = (n: number) => ((TRACK_END[n - 2] ?? 0) + TRACK[n - 1]! / 2) / TRACK_TOTAL * 100;

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const ICON: Record<string, string> = {
  go: '🏁', tax: '💸', kismat: '🎲', samaj: '🎁', jail: '🔒', parking: '☕', gotojail: '👮', railway: '🚆', utility: '💡',
};
const icon = (t: Tile) => (t.id === 28 ? '🚰' : ICON[t.kind]);

/** Keeps each player's *displayed* tile and hops it forward one tile at a time toward its real position. */
function useHoppingPositions(players: { id: string; position: number; bankrupt: boolean }[]) {
  const shown = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [, tick] = useState(0);
  const key = players.map((p) => `${p.id}:${p.position}:${p.bankrupt}`).join(',');

  useEffect(() => {
    for (const p of players) {
      if (p.bankrupt || timers.current.has(p.id)) continue;
      if (!shown.current.has(p.id)) { shown.current.set(p.id, p.position); continue; } // first sighting: place directly
      if (shown.current.get(p.id) === p.position) continue;
      const step = () => {
        const next = (shown.current.get(p.id)! + 1) % 40;
        shown.current.set(p.id, next);
        tick((n) => n + 1);
        if (next === p.position) timers.current.delete(p.id);
        else timers.current.set(p.id, setTimeout(step, 90));
      };
      timers.current.set(p.id, setTimeout(step, 90));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const t = timers.current;
    return () => { for (const id of t.values()) clearTimeout(id); };
  }, []);

  return shown.current;
}

function Tokens({ game, currentId }: { game: ClientGameState; currentId: string }) {
  const shown = useHoppingPositions(game.players);
  const alive = game.players.filter((p) => !p.bankrupt);
  return (
    <div className="tokens-layer">
      {alive.map((p, i) => {
        const { row, col } = pos(shown.get(p.id) ?? p.position);
        return (
          <i key={p.id} className={`token ${p.id === currentId ? 'active' : ''}`}
            style={{ left: `${center(col)}%`, top: `${center(row)}%`, background: p.color, ['--n' as string]: i % 4 }}
            title={p.name}>{p.name[0]?.toUpperCase()}</i>
        );
      })}
    </div>
  );
}

interface Props {
  game: ClientGameState;
  onSelect: (id: number) => void;
  selected: number | null;
  children: ReactNode;
}

export function Board({ game, onSelect, selected, children }: Props) {
  const currentId = game.players[game.current]?.id ?? '';
  return (
    <div className="board">
      {BOARD.map((t) => {
        const { row, col, side } = pos(t.id);
        const o = game.owners[t.id];
        const corner = [0, 10, 20, 30].includes(t.id);
        return (
          <button key={t.id} type="button"
            className={`tile side-${side} ${corner ? 'corner' : ''} ${o ? 'owned' : ''} ${o?.mortgaged ? 'mortgaged' : ''} ${selected === t.id ? 'selected' : ''}`}
            style={{ gridRow: row, gridColumn: col, ['--owner' as string]: o ? game.players.find((p) => p.id === o.owner)?.color : undefined }}
            onClick={() => onSelect(t.id)} aria-label={t.name}>
            {t.group && (
              <span className="band" style={{ background: GROUP_COLORS[t.group] }}>
                {o && o.houses > 0 && (o.houses === 5
                  ? <i className="hotel" />
                  : Array.from({ length: o.houses }, (_, i) => <i key={i} className="house" />))}
              </span>
            )}
            <span className="body">
              {!t.group && <span className="ico">{icon(t)}</span>}
              <span className="name">{t.name}</span>
              {t.price && <span className="price">{inr(t.price)}</span>}
              {t.amount && <span className="price">Pay {inr(t.amount)}</span>}
            </span>
          </button>
        );
      })}
      <Tokens game={game} currentId={currentId} />
      <div className="center">{children}</div>
    </div>
  );
}
