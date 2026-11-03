"use client";

import { useEffect, useState } from "react";
import type { LeaderEntry } from "@/lib/poker/types";
import { fetchLeaderboard } from "@/lib/client/auth";

export function Leaderboard({
  highlightId,
  refreshKey = 0,
  compact = false,
}: {
  highlightId?: number;
  refreshKey?: number;
  compact?: boolean;
}) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchLeaderboard().then((l) => {
      if (active) {
        setLeaders(l);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gold">🏆 Leaderboard</h3>
        <span className="text-[10px] text-white/30">by total chips</span>
      </div>
      {loading ? (
        <p className="text-xs text-white/30">Loading…</p>
      ) : leaders.length === 0 ? (
        <p className="text-xs text-white/30">No players yet.</p>
      ) : (
        <ol className="space-y-1">
          {leaders.slice(0, compact ? 5 : 20).map((l, i) => (
            <li
              key={l.id}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                l.id === highlightId ? "bg-gold/15 ring-1 ring-gold/40" : i % 2 ? "bg-white/5" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-5 text-center text-xs">{medal[i] ?? i + 1}</span>
                <span className="truncate font-medium">
                  {l.username}
                  {l.isAdmin && <span className="ml-1 text-[10px] text-gold/70">★</span>}
                </span>
              </span>
              <span className="shrink-0 font-bold text-gold">{l.total.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
