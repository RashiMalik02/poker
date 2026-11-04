// Realistic casino-style poker chips rendered purely with CSS gradients.

const DENOMS: { value: number; base: string; dark: string; edge: string }[] = [
  { value: 1000, base: "#1a1a1a", dark: "#000000", edge: "#e8c15a" }, // black/gold
  { value: 500, base: "#7b2fb8", dark: "#4a1a6e", edge: "#f0e0ff" }, // purple
  { value: 100, base: "#1f6f3f", dark: "#0f4a28", edge: "#eafff0" }, // green
  { value: 25, base: "#1456b8", dark: "#0c3a7e", edge: "#dceaff" }, // blue
  { value: 5, base: "#c0202a", dark: "#7e1016", edge: "#ffe6e6" }, // red
  { value: 1, base: "#e9e9e2", dark: "#b9b9ad", edge: "#6b6b60" }, // white
];

function denomFor(amount: number) {
  for (const d of DENOMS) if (amount >= d.value) return d;
  return DENOMS[DENOMS.length - 1];
}

// How many chips to draw in a stack (biggest denomination that fits).
function stackCount(amount: number): number {
  const d = denomFor(amount);
  return Math.max(1, Math.min(6, Math.round(amount / d.value)));
}

function Chip({ size, d }: { size: number; d: (typeof DENOMS)[number] }) {
  // Edge spots: base color wedges with light dashes around the rim.
  const seg = 60; // 6 spots
  const dash = 15;
  const face = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `
      radial-gradient(circle at 50% 34%, rgba(255,255,255,0.35), rgba(255,255,255,0) 42%),
      repeating-conic-gradient(${d.base} 0 ${seg - dash}deg, ${d.edge} ${seg - dash}deg ${seg}deg)
    `,
    boxShadow: "0 2px 3px rgba(0,0,0,0.55), inset 0 -2px 4px rgba(0,0,0,0.4)",
  } as React.CSSProperties;
  const inner = {
    position: "absolute" as const,
    inset: size * 0.16,
    borderRadius: "50%",
    background: `radial-gradient(circle at 50% 35%, ${d.base}, ${d.dark})`,
    border: `${Math.max(1, size * 0.045)}px dashed rgba(255,255,255,0.35)`,
    boxSizing: "border-box" as const,
  };
  return (
    <div className="relative" style={face}>
      <div style={inner} />
    </div>
  );
}

function Stack({ amount, size }: { amount: number; size: number }) {
  const d = denomFor(amount);
  const n = stackCount(amount);
  const step = Math.max(2.5, size * 0.17);
  const height = size + step * (n - 1);
  return (
    <div className="relative" style={{ width: size, height }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="absolute left-0" style={{ bottom: i * step }}>
          <Chip size={size} d={d} />
        </div>
      ))}
    </div>
  );
}

export function ChipStack({
  amount,
  size = 20,
  label = true,
}: {
  amount: number;
  size?: number;
  label?: boolean;
}) {
  if (amount <= 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Stack amount={amount} size={size} />
      {label && (
        <span className="rounded-full bg-black/75 px-1.5 py-0.5 text-xs font-bold text-gold shadow ring-1 ring-gold/30">
          {amount.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// A cluster of chip stacks for the pot in the middle of the table.
export function PotPile({ amount }: { amount: number }) {
  if (amount <= 0) {
    return <div className="text-xs font-semibold uppercase tracking-widest text-white/25">No pot</div>;
  }
  const offsets = [-20, -7, 7, 20];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex h-10 w-20 items-end justify-center">
        {offsets.map((x, i) => (
          <div key={i} className="absolute bottom-0" style={{ left: `calc(50% + ${x}px)`, transform: "translateX(-50%)" }}>
            <Stack amount={Math.max(1, Math.round(amount / offsets.length))} size={22} />
          </div>
        ))}
      </div>
      <span className="rounded-full bg-black/70 px-3 py-0.5 text-sm font-bold text-gold ring-1 ring-gold/40">
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
