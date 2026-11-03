import type { Card } from "@/lib/poker/types";
import { rankLabel, suitSymbol } from "@/lib/poker/cards";

const SUIT_COLOR: Record<string, string> = {
  h: "text-red-600",
  d: "text-red-600",
  c: "text-neutral-900",
  s: "text-neutral-900",
};

export function PlayingCard({
  card,
  size = "md",
  faceDown = false,
  dim = false,
  deal = false,
}: {
  card?: Card;
  size?: "sm" | "md" | "lg";
  faceDown?: boolean;
  dim?: boolean;
  deal?: boolean;
}) {
  const dims = {
    sm: "w-7 h-10 text-[11px] rounded-md",
    md: "w-11 h-16 text-base rounded-lg",
    lg: "w-14 h-20 text-xl rounded-lg",
  }[size];

  if (faceDown || !card) {
    return (
      <div
        className={`${dims} ${deal ? "animate-dealIn" : ""} relative flex items-center justify-center border border-black/30 bg-gradient-to-br from-rose-700 to-rose-900 shadow-chip`}
      >
        <div className="absolute inset-1 rounded-[4px] border border-white/20 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.08)_0_4px,transparent_4px_8px)]" />
      </div>
    );
  }

  const color = SUIT_COLOR[card.suit];
  return (
    <div
      className={`${dims} ${deal ? "animate-dealIn" : ""} ${dim ? "opacity-45" : ""} relative flex flex-col justify-between bg-white p-1 font-bold shadow-chip leading-none`}
    >
      <div className={`flex flex-col items-start ${color}`}>
        <span>{rankLabel(card.rank)}</span>
        <span className="-mt-0.5">{suitSymbol(card.suit)}</span>
      </div>
      <div className={`self-end rotate-180 ${color}`}>
        <span>{rankLabel(card.rank)}</span>
      </div>
    </div>
  );
}
