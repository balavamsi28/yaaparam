import type { Tile } from './types';

export const START_CASH = 15000;
export const GO_SALARY = 2000;
export const JAIL_FINE = 500;
export const JAIL_POS = 10;
export const BOARD_SIZE = 40;
export const MAX_PLAYERS = 10;
export const MIN_PLAYERS = 2;

export const GROUP_COLORS: Record<string, string> = {
  brown: '#8d5a3b', sky: '#7fd0f0', pink: '#e0669f', orange: '#f28c28',
  red: '#d63b3b', yellow: '#f2c230', green: '#2e9d5b', navy: '#2c4a9a',
};

type P = [number, string, string, number, number, number[]];
const props: P[] = [
  [1, 'Guwahati', 'brown', 600, 500, [20, 100, 300, 900, 1600, 2500]],
  [3, 'Shillong', 'brown', 600, 500, [40, 200, 600, 1800, 3200, 4500]],
  [6, 'Kochi', 'sky', 1000, 500, [60, 300, 900, 2700, 4000, 5500]],
  [8, 'Mysuru', 'sky', 1000, 500, [60, 300, 900, 2700, 4000, 5500]],
  [9, 'Puducherry', 'sky', 1200, 500, [80, 400, 1000, 3000, 4500, 6000]],
  [11, 'Jaipur', 'pink', 1400, 1000, [100, 500, 1500, 4500, 6250, 7500]],
  [13, 'Udaipur', 'pink', 1400, 1000, [100, 500, 1500, 4500, 6250, 7500]],
  [14, 'Jodhpur', 'pink', 1600, 1000, [120, 600, 1800, 5000, 7000, 9000]],
  [16, 'Lucknow', 'orange', 1800, 1000, [140, 700, 2000, 5500, 7500, 9500]],
  [18, 'Amritsar', 'orange', 1800, 1000, [140, 700, 2000, 5500, 7500, 9500]],
  [19, 'Chandigarh', 'orange', 2000, 1000, [160, 800, 2200, 6000, 8000, 10000]],
  [21, 'Ahmedabad', 'red', 2200, 1500, [180, 900, 2500, 7000, 8750, 10500]],
  [23, 'Pune', 'red', 2200, 1500, [180, 900, 2500, 7000, 8750, 10500]],
  [24, 'Hyderabad', 'red', 2400, 1500, [200, 1000, 3000, 7500, 9250, 11000]],
  [26, 'Chennai', 'yellow', 2600, 1500, [220, 1100, 3300, 8000, 9750, 11500]],
  [27, 'Kolkata', 'yellow', 2600, 1500, [220, 1100, 3300, 8000, 9750, 11500]],
  [29, 'Bengaluru', 'yellow', 2800, 1500, [240, 1200, 3600, 8500, 10250, 12000]],
  [31, 'Gurugram', 'green', 3000, 2000, [260, 1300, 3900, 9000, 11000, 12750]],
  [32, 'Noida', 'green', 3000, 2000, [260, 1300, 3900, 9000, 11000, 12750]],
  [34, 'Delhi', 'green', 3200, 2000, [280, 1500, 4500, 10000, 12000, 14000]],
  [37, 'Bandra, Mumbai', 'navy', 3500, 2000, [350, 1750, 5000, 11000, 13000, 15000]],
  [39, 'Nariman Point, Mumbai', 'navy', 4000, 2000, [500, 2000, 6000, 14000, 17000, 20000]],
];

const special: Tile[] = [
  { id: 0, name: 'Start', kind: 'go' },
  { id: 2, name: 'Samaj Nidhi', kind: 'samaj' },
  { id: 4, name: 'Income Tax', kind: 'tax', amount: 2000 },
  { id: 5, name: 'Howrah Junction', kind: 'railway', price: 2000, rents: [250, 500, 1000, 2000] },
  { id: 7, name: 'Kismat', kind: 'kismat' },
  { id: 10, name: 'Jail', kind: 'jail' },
  { id: 12, name: 'Bharat Electricity Board', kind: 'utility', price: 1500 },
  { id: 15, name: 'Chhatrapati Shivaji Terminus', kind: 'railway', price: 2000, rents: [250, 500, 1000, 2000] },
  { id: 17, name: 'Samaj Nidhi', kind: 'samaj' },
  { id: 20, name: 'Chai Break', kind: 'parking' },
  { id: 22, name: 'Kismat', kind: 'kismat' },
  { id: 25, name: 'New Delhi Station', kind: 'railway', price: 2000, rents: [250, 500, 1000, 2000] },
  { id: 28, name: 'Jal Board Waterworks', kind: 'utility', price: 1500 },
  { id: 30, name: 'Go To Jail', kind: 'gotojail' },
  { id: 33, name: 'Samaj Nidhi', kind: 'samaj' },
  { id: 35, name: 'Chennai Central', kind: 'railway', price: 2000, rents: [250, 500, 1000, 2000] },
  { id: 36, name: 'Kismat', kind: 'kismat' },
  { id: 38, name: 'Luxury Tax', kind: 'tax', amount: 1000 },
];

export const BOARD: Tile[] = [
  ...special,
  ...props.map(([id, name, group, price, houseCost, rents]): Tile =>
    ({ id, name, kind: 'property', group, price, houseCost, rents })),
].sort((a, b) => a.id - b.id);

export const groupTiles = (group: string) => BOARD.filter((t) => t.group === group);
