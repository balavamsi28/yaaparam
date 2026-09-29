import qrcode from 'qrcode-generator';

/** Pure SVG QR code — no canvas, scales crisply at any size. */
export function QrCode({ value, size = 168 }: { value: string; size?: number }) {
  const qr = qrcode(0, 'M'); // type 0 = auto-pick the smallest version that fits
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / n;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c * cell} ${r * cell}h${cell}v${cell}h${-cell}z`;
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="QR code to join the room">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#14112b" />
    </svg>
  );
}
