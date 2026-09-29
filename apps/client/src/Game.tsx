import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD, GROUP_COLORS, JAIL_FINE, type Action, type ClientGameState, type Player } from '@yaaparam/engine';
import type { Net } from './net';
import type { Audio } from './audio';
import { Board, inr } from './Board';
import { Dice } from './Dice';
import { PlayerInspector } from './PlayerInspector';
import { TradeComposer, TradeSummary } from './Trade';

export function Game({ net, audio }: { net: Net; audio: Audio }) {
  const v = net.view!;
  const g = v.game!;
  const me = g.players.find((p) => p.id === v.you);
  const cur = g.players[g.current]!;
  const mine = !!me && !me.bankrupt && cur.id === v.you && g.status === 'playing';
  const [sel, setSel] = useState<number | null>(null);
  const [composing, setComposing] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const isHost = v.you === v.hostId;
  const online = (id: string) => v.members.find((m) => m.id === id)?.connected ?? false;
  const isBot = (id: string) => v.members.find((m) => m.id === id)?.isBot ?? false;
  const name = (id: string) => g.players.find((p) => p.id === id)?.name ?? '?';
  const act = useCallback((a: Action) => {
    if (a.type === 'roll') audio.play('dice');
    if (a.type === 'buy') audio.play('buy');
    return net.act(a);
  }, [net.act, audio]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevStatus = useRef(g.status);
  useEffect(() => {
    if (prevStatus.current !== 'finished' && g.status === 'finished') audio.play('victory');
    prevStatus.current = g.status;
  }, [g.status, audio]);

  const prevJail = useRef(me?.inJail ?? false);
  useEffect(() => {
    const nowJail = me?.inJail ?? false;
    if (!prevJail.current && nowJail) audio.play('jail');
    prevJail.current = nowJail;
  }, [me?.inJail, audio]);

  const inspected = inspecting ? g.players.find((p) => p.id === inspecting) : undefined;

  return (
    <main className="game">
      <Board game={g} onSelect={setSel} selected={sel}>
        <Center g={g} cur={cur} me={me} mine={mine} net={net} name={name} act={act} />
      </Board>

      <aside className="side">
        <section className="card">
          <div className="row between">
            <h3>Room {v.code}</h3>
            <button className="btn tiny ghost" onClick={() => { if (confirm(me?.bankrupt ? 'Leave the room?' : 'Leave and resign from the game?')) net.leave(); }}>
              {me?.bankrupt ? 'Leave' : 'Resign'}
            </button>
          </div>
          <ul className="players">
            {g.players.map((p) => (
              <PlayerRow key={p.id} p={p} active={p.id === cur.id && g.status === 'playing'} you={p.id === v.you}
                offline={!online(p.id) && !p.bankrupt && !isBot(p.id)} isBot={isBot(p.id)}
                onInspect={() => setInspecting(p.id)}
                onTrade={me && !me.bankrupt && !p.bankrupt && p.id !== v.you && g.status === 'playing' ? () => setComposing(p.id) : undefined}
                onRemove={isHost && !online(p.id) && !p.bankrupt && !isBot(p.id) ? () => net.remove(p.id) : undefined} />
            ))}
          </ul>
          {me && !me.bankrupt && g.status === 'playing' && (
            <button className="btn small" disabled={!!g.trade || g.players.filter((p) => !p.bankrupt).length < 2} onClick={() => setComposing('')}>Propose trade</button>
          )}
        </section>

        {sel !== null && <TileCard g={g} id={sel} name={name} />}

        {me && !me.bankrupt && <Assets g={g} me={me} mine={mine} act={act} />}

        <section className="card log">
          <h3>Log</h3>
          <LogList lines={g.log} />
        </section>
      </aside>

      {composing !== null && me && (
        <TradeComposer g={g} you={me.id} initialTo={composing || undefined} onClose={() => setComposing(null)}
          onSubmit={(to, give, get) => act({ type: 'proposeTrade', to, give, get })} />
      )}

      {g.trade && g.trade.to === v.you && (
        <div className="modal"><div className="card modal-card">
          <h3>Trade offer</h3>
          <TradeSummary g={g} t={g.trade} />
          <div className="row end">
            <button className="btn ghost" onClick={() => act({ type: 'cancelTrade' })}>Decline</button>
            <button className="btn primary" onClick={() => act({ type: 'acceptTrade' })}>Accept</button>
          </div>
        </div></div>
      )}

      {inspected && (
        <PlayerInspector g={g} player={inspected} isBot={isBot(inspected.id)} onClose={() => setInspecting(null)}
          onTrade={me && !me.bankrupt && !inspected.bankrupt && inspected.id !== v.you && g.status === 'playing'
            ? () => { setComposing(inspected.id); setInspecting(null); } : undefined} />
      )}
    </main>
  );
}

function LogList({ lines }: { lines: string[] }) {
  return (
    <ol className="loglist" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ol>
  );
}

function PlayerRow({ p, active, you, offline, isBot, onInspect, onTrade, onRemove }: {
  p: Player; active: boolean; you: boolean; offline: boolean; isBot: boolean;
  onInspect: () => void; onTrade?: () => void; onRemove?: () => void;
}) {
  return (
    <li className={`${active ? 'active' : ''} ${p.bankrupt ? 'out' : ''}`}>
      <span className="chip" style={{ background: p.color }} />
      <button type="button" className="grow player-name" onClick={onInspect} title="View portfolio">
        {p.name}{isBot && ' 🤖'}{you && ' (you)'} {p.inJail && '🔒'} {offline && <span className="muted">· offline</span>}
      </button>
      <b>{p.bankrupt ? 'Bankrupt' : inr(p.cash)}</b>
      {onTrade && <button className="btn tiny" onClick={onTrade} title={`Trade with ${p.name}`}>⇄</button>}
      {onRemove && <button className="btn tiny" onClick={onRemove} title="Remove offline player">✕</button>}
    </li>
  );
}

function Center({ g, cur, me, mine, net, name, act }: {
  g: ClientGameState; cur: Player; me?: Player; mine: boolean; net: Net; name: (id: string) => string; act: Net['act'];
}) {
  const tile = BOARD[cur.position]!;
  let body;

  if (g.status === 'finished') {
    body = (
      <>
        <h2 className="win">🏆 {name(g.winner!)} wins!</h2>
        {net.view!.you === net.view!.hostId
          ? <button className="btn primary" onClick={net.rematch}>Play again</button>
          : <p className="muted">Waiting for the host to start a new game…</p>}
      </>
    );
  } else if (!mine) {
    body = <p className="turn">Waiting for <b style={{ color: cur.color }}>{cur.name}</b>…</p>;
  } else if (g.phase === 'awaitBuy' && g.pendingBuy !== null) {
    const t = BOARD[g.pendingBuy]!;
    body = (
      <>
        <p className="turn">Buy <b>{t.name}</b> for {inr(t.price!)}?</p>
        <div className="row action-dock">
          <button className="btn primary" disabled={cur.cash < t.price!} onClick={() => act({ type: 'buy' })}>Buy</button>
          <button className="btn" onClick={() => act({ type: 'decline' })}>Skip</button>
        </div>
      </>
    );
  } else if (g.phase === 'debt' && g.debt) {
    body = (
      <>
        <p className="turn warn">You owe {inr(g.debt.amount)} ({g.debt.reason}).<br />Mortgage or sell buildings to raise cash.</p>
        <div className="row action-dock">
          <button className="btn primary" disabled={cur.cash < g.debt.amount} onClick={() => act({ type: 'payDebt' })}>Pay {inr(g.debt.amount)}</button>
          <button className="btn danger" onClick={() => { if (confirm('Declare bankruptcy? You will be out of the game.')) act({ type: 'bankrupt' }); }}>Bankrupt</button>
        </div>
      </>
    );
  } else if (g.phase === 'preRoll') {
    body = (
      <>
        <p className="turn">{cur.inJail ? 'You are in Jail' : g.extraRoll ? 'Doubles! Roll again' : 'Your turn'}</p>
        <div className="row action-dock">
          <button className="btn primary big" onClick={() => act({ type: 'roll' })}>{cur.inJail ? 'Roll for doubles' : 'Roll dice'}</button>
          {cur.inJail && <button className="btn" disabled={cur.cash < JAIL_FINE} onClick={() => act({ type: 'payJailFine' })}>Pay {inr(JAIL_FINE)}</button>}
          {cur.inJail && cur.jailCards > 0 && <button className="btn" onClick={() => act({ type: 'useJailCard' })}>Use card</button>}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="turn">You are on <b>{tile.name}</b>. Manage properties or end your turn.</p>
        <div className="row action-dock">
          <button className="btn primary" onClick={() => act({ type: 'endTurn' })}>End turn</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="brand">🪔 Yaaparam</div>
      <Dice dice={g.dice} seed={g.log.length} />
      {body}
      {g.trade && g.trade.from === net.view!.you && (
        <div className="notice">Waiting for {name(g.trade.to)} to answer your trade…
          <button className="btn tiny" onClick={() => act({ type: 'cancelTrade' })}>Withdraw</button>
        </div>
      )}
      {me?.bankrupt && <p className="muted">You are out of the game. You can keep watching.</p>}
    </>
  );
}

function TileCard({ g, id, name }: { g: ClientGameState; id: number; name: (id: string) => string }) {
  const t = BOARD[id]!;
  const o = g.owners[id];
  return (
    <section className="card">
      <h3>{t.group && <span className="chip" style={{ background: GROUP_COLORS[t.group] }} />} {t.name}</h3>
      {t.price ? (
        <dl className="rents">
          <dt>Price</dt><dd>{inr(t.price)}</dd>
          {t.kind === 'property' && <>
            <dt>Rent</dt><dd>{inr(t.rents![0]!)}</dd>
            {[1, 2, 3, 4].map((n) => <><dt key={`h${n}`}>{n} house{n > 1 ? 's' : ''}</dt><dd key={`d${n}`}>{inr(t.rents![n]!)}</dd></>)}
            <dt>Hotel</dt><dd>{inr(t.rents![5]!)}</dd>
            <dt>Building cost</dt><dd>{inr(t.houseCost!)}</dd>
          </>}
          {t.kind === 'railway' && <><dt>Rent</dt><dd>{t.rents!.map(inr).join(' / ')}</dd></>}
          {t.kind === 'utility' && <><dt>Rent</dt><dd>40× dice (100× with both)</dd></>}
          <dt>Owner</dt><dd>{o ? `${name(o.owner)}${o.mortgaged ? ' (mortgaged)' : ''}` : 'Bank'}</dd>
        </dl>
      ) : <p className="muted">{t.amount ? `Pay ${inr(t.amount)} to the bank.` : 'Special square.'}</p>}
    </section>
  );
}

function Assets({ g, me, mine, act }: { g: ClientGameState; me: Player; mine: boolean; act: Net['act'] }) {
  const owned = BOARD.filter((t) => g.owners[t.id]?.owner === me.id);
  const can = mine && g.phase !== 'awaitBuy';
  return (
    <section className="card">
      <h3>Your properties {me.jailCards > 0 && <span className="muted">· {me.jailCards}× jail-free</span>}</h3>
      {owned.length === 0 && <p className="muted">Nothing yet. Land on a city to buy it.</p>}
      <ul className="assets">
        {owned.map((t) => {
          const o = g.owners[t.id]!;
          return (
            <li key={t.id} className={o.mortgaged ? 'mortgaged' : ''}>
              <span className="chip" style={{ background: t.group ? GROUP_COLORS[t.group] : '#888' }} />
              <span className="grow">{t.name}{o.houses > 0 && ` · ${o.houses === 5 ? 'hotel' : `${o.houses}🏠`}`}</span>
              {can && t.kind === 'property' && <>
                <button className="btn tiny" title={`Build (${inr(t.houseCost!)})`} onClick={() => act({ type: 'build', tile: t.id })}>＋</button>
                <button className="btn tiny" title="Sell building" disabled={o.houses === 0} onClick={() => act({ type: 'sellHouse', tile: t.id })}>－</button>
              </>}
              {can && (o.mortgaged
                ? <button className="btn tiny" onClick={() => act({ type: 'unmortgage', tile: t.id })}>Redeem</button>
                : <button className="btn tiny" onClick={() => act({ type: 'mortgage', tile: t.id })}>Mortgage</button>)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
