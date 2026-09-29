export type CardEffect =
  | { kind: 'gain'; amount: number }
  | { kind: 'pay'; amount: number }
  | { kind: 'moveTo'; tile: number }
  | { kind: 'moveBack'; steps: number }
  | { kind: 'jail' }
  | { kind: 'jailFree' }
  | { kind: 'repairs'; house: number; hotel: number };

export interface Card { text: string; effect: CardEffect }

export const KISMAT: Card[] = [
  { text: 'Advance to Start. Collect your salary.', effect: { kind: 'moveTo', tile: 0 } },
  { text: 'Board the night train to Howrah Junction.', effect: { kind: 'moveTo', tile: 5 } },
  { text: 'Business trip: advance to Delhi.', effect: { kind: 'moveTo', tile: 34 } },
  { text: 'Weekend getaway: advance to Jaipur.', effect: { kind: 'moveTo', tile: 11 } },
  { text: 'Sea-facing dream: advance to Nariman Point, Mumbai.', effect: { kind: 'moveTo', tile: 39 } },
  { text: 'Diwali bonus from your employer: collect ₹1500.', effect: { kind: 'gain', amount: 1500 } },
  { text: 'Your gully cricket team wins the cup: collect ₹1000.', effect: { kind: 'gain', amount: 1000 } },
  { text: 'Traffic challan: pay ₹300.', effect: { kind: 'pay', amount: 300 } },
  { text: 'Roadblock ahead: go back 3 spaces.', effect: { kind: 'moveBack', steps: 3 } },
  { text: 'Caught without a ticket: go directly to Jail.', effect: { kind: 'jail' } },
  { text: 'A friend in high places: Get Out of Jail Free.', effect: { kind: 'jailFree' } },
  { text: 'Monsoon repairs: pay ₹250 per house and ₹1000 per hotel.', effect: { kind: 'repairs', house: 250, hotel: 1000 } },
];

export const SAMAJ: Card[] = [
  { text: 'Bank error in your favour: collect ₹2000.', effect: { kind: 'gain', amount: 2000 } },
  { text: 'Wedding-season catering profits: collect ₹1000.', effect: { kind: 'gain', amount: 1000 } },
  { text: 'Income tax refund: collect ₹500.', effect: { kind: 'gain', amount: 500 } },
  { text: 'Sold your old scooter: collect ₹450.', effect: { kind: 'gain', amount: 450 } },
  { text: 'Inheritance from a distant uncle: collect ₹1000.', effect: { kind: 'gain', amount: 1000 } },
  { text: 'Runner-up in the rangoli contest: collect ₹100.', effect: { kind: 'gain', amount: 100 } },
  { text: "Doctor's fees: pay ₹500.", effect: { kind: 'pay', amount: 500 } },
  { text: 'School fees: pay ₹1000.', effect: { kind: 'pay', amount: 1000 } },
  { text: 'Hospital bill: pay ₹1000.', effect: { kind: 'pay', amount: 1000 } },
  { text: 'Advance to Start. Collect your salary.', effect: { kind: 'moveTo', tile: 0 } },
  { text: 'Tax raid: go directly to Jail.', effect: { kind: 'jail' } },
  { text: 'Street repairs: pay ₹400 per house and ₹1150 per hotel.', effect: { kind: 'repairs', house: 400, hotel: 1150 } },
];

export const JAIL_FREE_CARD = KISMAT.findIndex((c) => c.effect.kind === 'jailFree');
