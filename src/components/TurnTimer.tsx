"use client";

import { useEffect, useState } from "react";

const TURN_TOTAL_MS = 30_000;

// A shrinking countdown bar for the player whose turn it is.
export function TurnTimer({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const frac = Math.max(0, Math.min(1, remaining / TURN_TOTAL_MS));
  const secs = Math.ceil(remaining / 1000);
  const danger = remaining <= 10_000;

  return (
    <div className="mt-1 flex w-28 items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/60">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
            danger ? "bg-red-500" : "bg-gold"
          }`}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <span className={`w-5 text-right text-[11px] font-bold tabular-nums ${danger ? "text-red-400" : "text-gold"}`}>
        {secs}
      </span>
    </div>
  );
}
