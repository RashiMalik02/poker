import type { PublicPlayer, ShowdownResult } from "@/lib/poker/types";
import { PlayingCard } from "./PlayingCard";
import { ChipStack } from "./Chips";
import { TurnTimer } from "./TurnTimer";

export function Seat({
  player,
  isDealer,
  isCurrent,
  isMe,
  showdown,
  turnEndsAt,
  onSit,
}: {
  player: PublicPlayer | null;
  isDealer: boolean;
  isCurrent: boolean;
  isMe: boolean;
  showdown?: ShowdownResult;
  turnEndsAt?: number;
  onSit?: () => void;
}) {
  if (!player) {
    return (
      <button
        onClick={onSit}
        className="group flex h-20 w-28 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 text-xs text-white/40 transition hover:border-gold/60 hover:text-gold hover:bg-black/40"
      >
        <span className="text-xl opacity-60 group-hover:opacity-100">＋</span>
        Open seat
      </button>
    );
  }

  const folded = player.folded;
  const won = !!showdown?.won && showdown.won > 0;
  const broke = player.stack === 0 && !player.inHand;

  return (
    <div className="relative flex flex-col items-center">
      {/* Hole cards */}
      <div className={`mb-1 flex gap-0.5 ${folded ? "opacity-30" : ""}`}>
        {player.holeCards
          ? player.holeCards.map((c, i) => (
              <PlayingCard key={i} card={c} size={isMe ? "md" : "sm"} dim={folded} deal delay={i * 90} />
            ))
          : Array.from({ length: player.cardsFaceDown }).map((_, i) => (
              <PlayingCard key={i} size="sm" faceDown deal delay={i * 90} />
            ))}
      </div>

      <div
        className={`relative w-32 rounded-2xl border px-3 py-2 text-center shadow-lg transition-all
          ${won ? "border-gold bg-gradient-to-b from-amber-500/30 to-emerald-950 shadow-[0_0_25px_rgba(232,193,90,0.6)]" : ""}
          ${!won && isCurrent ? "border-gold bg-gradient-to-b from-emerald-800 to-emerald-950 animate-pulseRing" : ""}
          ${!won && !isCurrent ? "border-white/10 bg-black/60" : ""}
          ${isMe ? "ring-2 ring-gold/70" : ""}
          ${!player.connected ? "grayscale" : ""}`}
      >
        {isDealer && (
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-black shadow ring-2 ring-black/30">
            D
          </span>
        )}
        <div className="truncate text-sm font-semibold">
          {player.name}
          {!player.connected && <span className="ml-1 text-[10px] text-white/40">(away)</span>}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm font-bold text-gold">
          <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-b from-gold to-gold-dark ring-1 ring-black/40" />
          {player.stack.toLocaleString()}
        </div>

        {broke && (
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-red-400">
            out of chips
          </div>
        )}
        {player.sittingOut && !player.inHand && !broke && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">sitting out</div>
        )}
        {player.allIn && <div className="mt-0.5 text-[10px] font-bold text-red-400">ALL IN</div>}
        {folded && <div className="mt-0.5 text-[10px] uppercase text-white/40">folded</div>}
        {player.lastAction && !folded && !player.allIn && (
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/50">
            {player.lastAction}
          </div>
        )}
      </div>

      {isCurrent && turnEndsAt ? <TurnTimer endsAt={turnEndsAt} /> : null}

      {won && (
        <div className="absolute -bottom-6 z-10 animate-dealIn whitespace-nowrap rounded-full bg-gold px-2.5 py-0.5 text-xs font-black text-black shadow-lg">
          +{showdown!.won.toLocaleString()}
        </div>
      )}
      {showdown && !won && (
        <div className="absolute -bottom-5 whitespace-nowrap text-[10px] text-white/50">
          {showdown.handName}
        </div>
      )}

      {/* Current street bet as chips */}
      <div className="mt-2 flex h-6 justify-center">
        {player.bet > 0 && <ChipStack amount={player.bet} size={16} />}
      </div>
    </div>
  );
}
