import { useState } from 'react';
import type { Net } from './net';

export function Home({ net }: { net: Net }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('yaaparam.name') ?? ''; } catch { return ''; } });
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [size, setSize] = useState(6);
  const [busy, setBusy] = useState(false);

  const go = async (fn: () => Promise<unknown>) => {
    try { localStorage.setItem('yaaparam.name', name); } catch { /* ignore */ }
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const ok = name.trim().length > 0 && net.connected && !busy;

  const playVsComputer = async () => {
    const r = await net.create(name, 2);
    if (!r.ok) return;
    const b = await net.addBot();
    if (b.ok) await net.start();
  };

  return (
    <main className="home">
      <div className="hero">
        <div className="diya" aria-hidden>🪔</div>
        <h1>Yaaparam</h1>
        <p>Buy cities. Build empires. Bankrupt your friends.<br />A multiplayer property-trading game across India.</p>
      </div>
      <div className="card home-card">
        <label>Your name
          <input value={name} maxLength={20} placeholder="e.g. Asha" onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <button className="btn primary big" disabled={!ok} onClick={() => go(playVsComputer)}>🤖 Play vs Computer</button>
        <div className="or"><span>or host a room</span></div>
        <label>Room size
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} players</option>)}
          </select>
        </label>
        <button className="btn primary" disabled={!ok} onClick={() => go(() => net.create(name, size))}>Create a room</button>
        <div className="or"><span>or join with a code</span></div>
        <div className="row">
          <input className="code" value={code} maxLength={5} placeholder="ROOM"
            onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn" disabled={!ok || code.length !== 5} onClick={() => go(() => net.join(code, name))}>Join</button>
        </div>
      </div>
      <p className="foot">2–10 players · play in your browser · no sign-up</p>
    </main>
  );
}
