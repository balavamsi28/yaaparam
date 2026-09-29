import { useState } from 'react';
import { BOARD, type ClientGameState, type Trade as TradeT, type TradeSide } from '@yaaparam/engine';
import { inr } from './Board';

const tradable = (g: ClientGameState, pid: string) =>
  BOARD.filter((t) => {
    if (g.owners[t.id]?.owner !== pid) return false;
    return !t.group || !BOARD.some((x) => x.group === t.group && (g.owners[x.id]?.houses ?? 0) > 0);
  });

export function describe(side: TradeSide) {
  const parts = [
    ...side.tiles.map((id) => BOARD[id]!.name),
    ...(side.cash ? [inr(side.cash)] : []),
    ...(side.jailCards ? [`${side.jailCards}× Jail-free card`] : []),
  ];
  return parts.length ? parts.join(', ') : 'nothing';
}

export function TradeSummary({ g, t }: { g: ClientGameState; t: TradeT }) {
  const name = (id: string) => g.players.find((p) => p.id === id)!.name;
  return (
    <p className="trade-sum">
      <b>{name(t.from)}</b> gives <em>{describe(t.give)}</em><br />
      <b>{name(t.to)}</b> gives <em>{describe(t.get)}</em>
    </p>
  );
}

function Side({ g, pid, side, set }: { g: ClientGameState; pid: string; side: TradeSide; set: (s: TradeSide) => void }) {
  const p = g.players.find((x) => x.id === pid)!;
  const toggle = (id: number) =>
    set({ ...side, tiles: side.tiles.includes(id) ? side.tiles.filter((x) => x !== id) : [...side.tiles, id] });
  return (
    <div className="trade-side">
      <h4>{p.name} gives</h4>
      <label>Cash (max {inr(p.cash)})
        <input type="number" min={0} max={p.cash} step={100} value={side.cash || ''}
          onChange={(e) => set({ ...side, cash: Math.max(0, Math.min(p.cash, Math.floor(Number(e.target.value) || 0))) })} />
      </label>
      {p.jailCards > 0 && (
        <label>Jail-free cards (max {p.jailCards})
          <input type="number" min={0} max={p.jailCards} value={side.jailCards || ''}
            onChange={(e) => set({ ...side, jailCards: Math.max(0, Math.min(p.jailCards, Math.floor(Number(e.target.value) || 0))) })} />
        </label>
      )}
      <ul className="picklist">
        {tradable(g, pid).map((t) => (
          <li key={t.id}>
            <label><input type="checkbox" checked={side.tiles.includes(t.id)} onChange={() => toggle(t.id)} /> {t.name}{g.owners[t.id]?.mortgaged ? ' (mortgaged)' : ''}</label>
          </li>
        ))}
        {tradable(g, pid).length === 0 && <li className="muted">No tradable properties</li>}
      </ul>
    </div>
  );
}

const empty = (): TradeSide => ({ cash: 0, tiles: [], jailCards: 0 });

export function TradeComposer({ g, you, initialTo, onSubmit, onClose }: {
  g: ClientGameState; you: string; initialTo?: string;
  onSubmit: (to: string, give: TradeSide, get: TradeSide) => void; onClose: () => void;
}) {
  const others = g.players.filter((p) => !p.bankrupt && p.id !== you);
  const [to, setTo] = useState(initialTo ?? others[0]?.id ?? '');
  const [give, setGive] = useState(empty());
  const [get, setGet] = useState(empty());
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="card modal-card">
        <h3>Propose a trade</h3>
        <label>Trade with
          <select value={to} onChange={(e) => { setTo(e.target.value); setGet(empty()); }}>
            {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="trade-grid">
          <Side g={g} pid={you} side={give} set={setGive} />
          {to && <Side g={g} pid={to} side={get} set={setGet} />}
        </div>
        <div className="row end">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!to} onClick={() => { onSubmit(to, give, get); onClose(); }}>Send offer</button>
        </div>
      </div>
    </div>
  );
}
