import { BOARD, GROUP_COLORS, type ClientGameState, type Player } from '@nagarseth/engine';
import { inr } from './Board';

/** UI-only estimate (cash + property/building value, mortgages at half price). Not an authoritative rule. */
function netWorth(g: ClientGameState, p: Player): number {
  let total = p.cash;
  for (const t of BOARD) {
    const o = g.owners[t.id];
    if (o?.owner !== p.id || !t.price) continue;
    total += o.mortgaged ? Math.floor(t.price / 2) : t.price + o.houses * (t.houseCost ?? 0);
  }
  return total;
}

export function PlayerInspector({ g, player, isBot, onClose, onTrade }: {
  g: ClientGameState; player: Player; isBot: boolean; onClose: () => void; onTrade?: () => void;
}) {
  const owned = BOARD.filter((t) => g.owners[t.id]?.owner === player.id);
  const groups = new Map<string, typeof owned>();
  for (const t of owned) groups.set(t.group ?? t.kind, [...(groups.get(t.group ?? t.kind) ?? []), t]);

  return (
    <div className="modal sheet-modal" onClick={onClose}>
      <div className="card modal-card sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3><span className="chip" style={{ background: player.color }} /> {player.name}{isBot && ' 🤖'}</h3>
          <button className="btn tiny ghost" onClick={onClose}>✕</button>
        </div>
        <p className="muted">
          {player.bankrupt ? 'Bankrupt' : player.inJail ? '🔒 In jail' : 'Active'}
          {player.jailCards > 0 && ` · ${player.jailCards}× jail-free card`}
        </p>
        <div className="row between inspector-stats">
          <div><span className="muted">Cash in hand</span><b>{inr(player.cash)}</b></div>
          <div><span className="muted">Net worth</span><b>{inr(netWorth(g, player))}</b></div>
        </div>
        {owned.length === 0 ? <p className="muted">No properties yet.</p> : (
          [...groups.entries()].map(([key, tiles]) => (
            <div key={key}>
              <h4 className="group-head">
                <span className="chip" style={{ background: GROUP_COLORS[key] ?? '#888' }} /> {key}
              </h4>
              <ul className="assets">
                {tiles.map((t) => {
                  const o = g.owners[t.id]!;
                  return (
                    <li key={t.id} className={o.mortgaged ? 'mortgaged' : ''}>
                      <span className="grow">{t.name}{o.houses > 0 && ` · ${o.houses === 5 ? 'hotel' : `${o.houses}🏠`}`}</span>
                      {o.mortgaged && <span className="muted">mortgaged</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {onTrade && <button className="btn primary" onClick={onTrade}>Propose trade</button>}
      </div>
    </div>
  );
}
