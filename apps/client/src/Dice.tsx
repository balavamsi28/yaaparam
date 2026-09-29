import { useEffect, useRef, useState } from 'react';

const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 }, 2: { x: -90, y: 0 }, 3: { x: 0, y: -90 },
  4: { x: 0, y: 90 }, 5: { x: 90, y: 0 }, 6: { x: 0, y: 180 },
};
// 3x3 pip grid membership per face value.
const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function Face({ value, transform }: { value: number; transform: string }) {
  const on = PIPS[value] ?? [];
  return (
    <div className="die-face" style={{ transform }}>
      <div className="die-pips">
        {Array.from({ length: 9 }, (_, i) => <i key={i} className={on.includes(i) ? 'on' : ''} />)}
      </div>
    </div>
  );
}

/** A single 3D die that tumbles (extra full spins) to the given face whenever `seed` changes. */
function Die({ value, seed }: { value: number; seed: number }) {
  const spins = useRef(0);
  const base = FACE_ROT[value] ?? FACE_ROT[1]!;
  const [rot, setRot] = useState(base);
  useEffect(() => {
    spins.current += 1;
    const b = FACE_ROT[value] ?? FACE_ROT[1]!;
    setRot({ x: b.x + spins.current * 360, y: b.y + spins.current * 360 });
  }, [seed, value]);

  return (
    <div className="die3d">
      <div className="die-cube" style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}>
        <Face value={1} transform="rotateY(0deg) translateZ(calc(var(--die-size) / 2))" />
        <Face value={6} transform="rotateY(180deg) translateZ(calc(var(--die-size) / 2))" />
        <Face value={3} transform="rotateY(90deg) translateZ(calc(var(--die-size) / 2))" />
        <Face value={4} transform="rotateY(-90deg) translateZ(calc(var(--die-size) / 2))" />
        <Face value={2} transform="rotateX(90deg) translateZ(calc(var(--die-size) / 2))" />
        <Face value={5} transform="rotateX(-90deg) translateZ(calc(var(--die-size) / 2))" />
      </div>
    </div>
  );
}

/** `seed` should change on every roll (e.g. the log length) so repeat values still tumble. */
export function Dice({ dice, seed }: { dice: [number, number] | null; seed: number }) {
  if (!dice) return null;
  return (
    <div className="dice3d-pair" aria-label={`Dice: ${dice[0]} and ${dice[1]}`}>
      <Die value={dice[0]} seed={seed} />
      <Die value={dice[1]} seed={seed} />
    </div>
  );
}
