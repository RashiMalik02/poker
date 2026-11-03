// Physical-looking chip stacks rendered purely with CSS.

const DENOMS: { value: number; from: string; to: string; ring: string }[] = [
  { value: 1000, from: "#f2d06b", to: "#b8922f", ring: "#7a5e14" }, // gold
  { value: 500, from: "#b06bf2", to: "#6c2fb8", ring: "#3f1a6e" }, // purple
  { value: 100, from: "#3a3a3a", to: "#111", ring: "#000" }, // black
  { value: 25, from: "#4fd27a", to: "#1f8f4f", ring: "#0f5a2f" }, // green
  { value: 5, from: "#f26b6b", to: "#b82f2f", ring: "#6e1414" }, // red
  { value: 1, from: "#f5f5f0", to: "#c9c9c0", ring: "#999" }, // white
];

// Break an amount into representative chips (biggest first), capped for display.
function chipsFor(amount: number): { from: string; to: string; ring: string }[] {
  const out: { from: string; to: string; ring: string }[] = [];
  let remaining = amount;
  for (const d of DENOMS) {
    let count = Math.floor(remaining / d.value);
    remaining -= count * d.value;
    count = Math.min(count, 5);
    for (let i = 0; i < count && out.length < 10; i++) out.push(d);
  }
  if (out.length === 0) out.push(DENOMS[DENOMS.length - 1]);
  return out.reverse(); // smallest on top
}

function Disc({
  from,
  to,
  ring,
  size,
  offset,
}: {
  from: string;
  to: string;
  ring: string;
  size: number;
  offset: number;
}) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 rounded-full"
      style={{
        width: size,
        height: size,
        bottom: offset,
        background: `radial-gradient(circle at 50% 35%, ${from}, ${to})`,
        border: `2px dashed ${ring}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
      }}
    />
  );
}

export function ChipStack({
  amount,
  size = 18,
  label = true,
}: {
  amount: number;
  size?: number;
  label?: boolean;
}) {
  if (amount <= 0) return null;
  const chips = chipsFor(amount);
  const step = Math.max(3, size * 0.22);
  const height = size + step * (chips.length - 1);
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative" style={{ width: size, height }}>
        {chips.map((c, i) => (
          <Disc key={i} {...c} size={size} offset={i * step} />
        ))}
      </div>
      {label && (
        <span className="rounded-full bg-black/70 px-1.5 py-0.5 text-xs font-bold text-gold shadow">
          {amount.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// A loose pile of chips for the pot.
export function PotPile({ amount }: { amount: number }) {
  if (amount <= 0) {
    return <div className="text-xs font-semibold uppercase tracking-widest text-white/30">No pot</div>;
  }
  const positions = [
    { x: -14, y: 0 },
    { x: 14, y: 0 },
    { x: 0, y: -4 },
    { x: -7, y: 4 },
    { x: 7, y: 4 },
  ];
  const chips = chipsFor(amount);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-8 w-16">
        {positions.map((p, i) => {
          const stack = chips.slice(i, i + 3);
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{ transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))` }}
            >
              <div className="relative h-5 w-5">
                {(stack.length ? stack : [chips[0]]).map((c, j) => (
                  <Disc key={j} {...c} size={18} offset={j * 3} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <span className="rounded-full bg-black/60 px-3 py-0.5 text-sm font-bold text-gold ring-1 ring-gold/40">
        {amount.toLocaleString()}
      </span>
    </div>
  );
}
