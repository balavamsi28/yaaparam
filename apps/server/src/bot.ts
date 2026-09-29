import { BOARD, JAIL_FINE, type Action, type GameState } from '@yaaparam/engine';

/** A deliberately small, deterministic baseline opponent. */
export function botAction(game: GameState): Action {
  const player = game.players[game.current]!;
  if (game.phase === 'preRoll') {
    if (player.inJail && player.jailCards > 0) return { type: 'useJailCard' };
    if (player.inJail && player.cash >= JAIL_FINE + 1_000) return { type: 'payJailFine' };
    return { type: 'roll' };
  }
  if (game.phase === 'awaitBuy') {
    const tile = game.pendingBuy === null ? undefined : BOARD[game.pendingBuy];
    return tile && player.cash >= tile.price! + 1_000 ? { type: 'buy' } : { type: 'decline' };
  }
  if (game.phase === 'debt') {
    if (player.cash >= game.debt!.amount) return { type: 'payDebt' };
    const mine = BOARD.filter((t) => game.owners[t.id]?.owner === player.id);
    // Buildings must go first (a group with houses cannot be mortgaged), most-built tile first to sell evenly.
    const built = mine.filter((t) => game.owners[t.id]!.houses > 0)
      .sort((a, b) => game.owners[b.id]!.houses - game.owners[a.id]!.houses)[0];
    if (built) return { type: 'sellHouse', tile: built.id };
    const free = mine.find((t) => !game.owners[t.id]!.mortgaged);
    return free ? { type: 'mortgage', tile: free.id } : { type: 'bankrupt' };
  }
  // postRoll: build on a complete, unmortgaged group while cash is comfortable, then end the turn.
  const build = BOARD.find((t) => {
    if (t.kind !== 'property' || player.cash < t.houseCost! + 1_500) return false;
    const group = BOARD.filter((x) => x.group === t.group).map((x) => game.owners[x.id]);
    if (!group.every((o) => o?.owner === player.id && !o.mortgaged)) return false;
    const houses = game.owners[t.id]!.houses;
    return houses < 5 && houses === Math.min(...group.map((o) => o!.houses));
  });
  return build ? { type: 'build', tile: build.id } : { type: 'endTurn' };
}
