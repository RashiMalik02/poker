import type { PublicPlayer, ShowdownResult } from "@/lib/poker/types";
import { PlayingCard } from "./PlayingCard";

function ChipStack({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-gold shadow-chip ring-1 ring-gold/40">
      <span className="h-3 w-3 rounded-full bg-gradient-to-b from-gold to-gold-dark ring-1 ring-black/40" />
      {amount.toLocaleString()}
    </div>
  );
}

export function Seat({
  player,
  isDealer,
  isCurrent,
  isMe,
  showdown,
  onSit,
}: {
  player: PublicPlayer | null;
  isDealer: boolean;
  isCurrent: boolean;
  isMe: boolean;
  showdown?: ShowdownResult;
  onSit?: () => void;
}) {
  if (!player) {
    return (
      <button
        onClick={onSit}
        className="group flex h-20 w-28 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 text-xs text-white/40 transition hover:border-gold/60 hover:text-gold"
      >
        <span className="text-lg opacity-60 group-hover:opacity-100">+</span>
        Open seat
      </button>
    );
  }

  const folded = player.folded;
  const won = showdown?.won && showdown.won > 0;

  return (
    <div className="relative flex flex-col items-center">
      {/* Cards */}
      <div className={`mb-1 flex gap-0.5 ${folded ? "opacity-30" : ""}`}>
        {player.holeCards
          ? player.holeCards.map((c, i) => (
              <PlayingCard key={i} card={c} size={isMe ? "md" : "sm"} dim={folded} deal />
            ))
          : Array.from({ length: player.cardsFaceDown }).map((_, i) => (
              <PlayingCard key={i} size="sm" faceDown deal />
            ))}
      </div>

      <div
        className={`relative w-32 rounded-2xl border px-3 py-2 text-center shadow-lg transition
          ${isCurrent ? "border-gold bg-gradient-to-b from-emerald-800 to-emerald-950 animate-pulseRing" : "border-white/10 bg-black/60"}
          ${isMe ? "ring-2 ring-gold/70" : ""}
          ${!player.connected ? "grayscale" : ""}`}
      >
        {isDealer && (
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-black shadow">
            D
          </span>
        )}
        <div className="truncate text-sm font-semibold">
          {player.name}
          {!player.connected && <span className="ml-1 text-[10px] text-white/40">(away)</span>}
        </div>
        <div className="text-sm font-bold text-gold">{player.stack.toLocaleString()}</div>

        {player.sittingOut && !player.inHand && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">
            {player.stack > 0 ? "sitting out" : "no chips"}
          </div>
        )}
        {player.allIn && <div className="mt-0.5 text-[10px] font-bold text-red-400">ALL IN</div>}
        {folded && <div className="mt-0.5 text-[10px] uppercase text-white/40">folded</div>}
        {player.lastAction && !folded && !player.allIn && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/50">
            {player.lastAction}
          </div>
        )}
      </div>

      {won ? (
        <div className="absolute -bottom-6 whitespace-nowrap rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-black shadow">
          +{showdown!.won.toLocaleString()}
        </div>
      ) : null}
      {showdown && (
        <div className="absolute -bottom-6 whitespace-nowrap text-[10px] text-white/60">
          {!won && showdown.handName}
        </div>
      )}

      {/* Current street bet */}
      <div className="mt-1.5 h-5">
        <ChipStack amount={player.bet} />
      </div>
    </div>
  );
}
