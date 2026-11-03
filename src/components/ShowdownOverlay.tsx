import type { GameView } from "@/lib/poker/types";
import { PlayingCard } from "./PlayingCard";

export function ShowdownOverlay({ state }: { state: GameView }) {
  if (state.stage !== "showdown" || !state.showdown || state.showdown.length === 0) return null;

  const nameFor = (seat: number) =>
    state.players.find((p) => p.seat === seat)?.name ?? `Seat ${seat + 1}`;

  // Winners first (already sorted by amount won), then the rest.
  const rows = state.showdown;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center">
      <div className="animate-dealIn w-[min(92%,30rem)] rounded-2xl border border-gold/40 bg-black/85 p-3 shadow-2xl backdrop-blur">
        <div className="mb-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-gold">
          ♠ Showdown ♠
        </div>
        <div className="space-y-2">
          {rows.map((r) => {
            const won = r.won > 0;
            return (
              <div
                key={r.seat}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                  won ? "bg-gradient-to-r from-gold/25 to-transparent ring-1 ring-gold/50" : "bg-white/5"
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate text-sm font-bold ${won ? "text-gold" : "text-white/80"}`}>
                    {nameFor(r.seat)}
                  </span>
                  <span className="truncate text-xs text-white/60">{r.handName}</span>
                </div>
                <div className="flex gap-0.5">
                  {r.cards.map((c, i) => (
                    <PlayingCard key={i} card={c} size="sm" />
                  ))}
                </div>
                {won && (
                  <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-xs font-black text-black">
                    +{r.won.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
