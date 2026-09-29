# Game rules (as implemented)

> **These are placeholder rules.** The owner said to use "normal" property-trading rules until custom rules are supplied. They are implemented with original names, and every number is a tunable constant in `packages/engine/src/board.ts` / `cards.ts`. **When the custom rules arrive, this document and the engine tests change together.**

Currency is the rupee (₹). Amounts are the classic scale ×10.

## Setup
- 2–10 players. Turn order is randomised at game start.
- Everyone starts on **Start** with **₹15,000**.
- 40 squares: 22 cities in 8 colour groups, 4 railway stations, 2 utilities, 2 tax squares, 6 card squares (3 *Samaj Nidhi*, 3 *Kismat*), Start, Jail, Chai Break (free parking, no effect), Go To Jail.

## A turn
1. **Roll** two dice and move clockwise.
2. Passing or landing on **Start** pays **₹2,000**. Landing directly on Start via a card also pays it.
3. Resolve the square (below).
4. **Doubles** give another roll. **Three doubles in a row** send you to Jail (you do not move).
5. **End turn** when done. Between rolling and ending you may build, mortgage and trade.

## Squares
| Square | Effect |
|---|---|
| Unowned property | You may **buy** at list price, or skip. There is **no auction**: a skipped property stays with the bank until someone lands on it. If you can't afford it, you're not offered it. |
| Owned by another player | Pay rent to the owner (none if mortgaged). |
| Your own | Nothing. |
| Income Tax / Luxury Tax | Pay ₹2,000 / ₹1,000 to the bank. |
| Samaj Nidhi / Kismat | Draw the top card, apply it, return it to the bottom (a Get Out of Jail Free card is kept by the player until used). |
| Go To Jail | Move to Jail; your turn ends (even if you rolled doubles). |
| Jail (visiting), Chai Break | Nothing. |

## Rent
- **City, no buildings:** base rent, **doubled** when the owner holds every city in the colour group (the mortgage status of the others is not considered).
- **City with buildings:** the rent for 1–4 houses or a hotel (see the tile card in the game).
- **Railways:** ₹250 / 500 / 1,000 / 2,000 for 1 / 2 / 3 / 4 owned.
- **Utilities:** 40× the dice total (last roll), or 100× if the owner has both.
- Mortgaged properties collect no rent.

## Building
- Only on cities, only when you own **the whole colour group** and **none of it is mortgaged**.
- **Even building:** you can't build on a city that already has more buildings than another in its group; selling must be even too.
- 4 houses, then a hotel (5th step). Building cost is per colour group. Selling a building refunds **half**.
- There is **no limit** on the number of houses/hotels in the bank.

## Mortgages
- Mortgage a property for **half its price**. You can't mortgage while any city in its group has buildings (sell them first).
- Unmortgage by paying the mortgage value **+10%** (rounded up).

## Jail
Enter by: Go To Jail square, three doubles, or a card. While in Jail, on your turn choose one:
- **Roll for doubles**: doubles free you and you move by that roll (but no extra roll).
- **Pay ₹500** before rolling.
- **Use a Get Out of Jail Free card**.

After **three failed rolls** you pay ₹500 and move by your third roll. If you cannot afford the fine you enter debt first; once it is paid the held move is made and your turn continues normally. You can still collect rent, build, trade and mortgage while jailed.

## Debt and bankruptcy
- If you owe more than you have, you enter **debt**: sell buildings and/or mortgage properties, then **Pay**; or declare **bankruptcy**.
- **Bankrupt to a player:** all your cash, properties (buildings removed; mortgages kept) and jail cards go to that creditor.
- **Bankrupt to the bank** (taxes, cards, resign): properties return to the bank unowned and unmortgaged.
- **Last player standing wins.**
- You may **resign** at any time (assets go to the bank). The host can resign an *offline* player.

## Trading
Any active player can propose a trade to another at any time; one trade can be pending at once. A trade may include cash, properties and jail-free cards on both sides. Rules:
- Each side must actually own what it offers (checked again at acceptance).
- Cities in a colour group with **any buildings** can't be traded until the buildings are sold.
- Mortgaged properties may be traded; the new owner simply inherits the mortgage (no transfer fee).
- The recipient accepts or declines; the proposer can withdraw.

## Cards
12 Kismat + 12 Samaj Nidhi cards (`packages/engine/src/cards.ts`): gain money, pay money, advance to a square, go back 3, go to Jail, Get Out of Jail Free, and building repairs. **No card takes money from, or gives money to, other players**, which keeps debt with a single creditor.

## Deliberate simplifications (not in the rules yet)
1. No property auctions.
2. Unlimited houses/hotels.
3. No mortgage-transfer fee on trades.
4. No "advance to nearest railway/utility" cards.
5. A single Get Out of Jail Free card exists (Kismat deck).
6. Chai Break (free parking) has no jackpot.
7. The bank never runs out of money.
