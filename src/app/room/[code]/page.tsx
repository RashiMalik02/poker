"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/poker/types";
import { getUser } from "@/lib/client/auth";
import { useGame } from "@/lib/client/useGame";
import { Table } from "@/components/Table";
import { Controls } from "@/components/Controls";
import { SidePanel } from "@/components/SidePanel";

export default function RoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/");
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  const game = useGame(code);

  useEffect(() => {
    if (game.error === "not-authenticated") router.replace("/");
  }, [game.error, router]);

  const me = useMemo(
    () => game.state?.players.find((p) => p.userId === user?.id),
    [game.state, user?.id]
  );
  const [rebuyOpen, setRebuyOpen] = useState(false);

  if (!ready || !user) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-3 p-3 lg:p-5">
      <div className="flex items-center justify-between">
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => router.push("/")}>
          ← Lobby
        </button>
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${game.connected ? "bg-emerald-400" : "bg-red-500"}`}
            title={game.connected ? "connected" : "disconnected"}
          />
          <span className="text-sm text-white/60">{user.username}</span>
        </div>
      </div>

      {game.error && game.error !== "not-authenticated" && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm text-red-200">
          {game.error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {game.state ? (
            <Table
              state={game.state}
              myUserId={user.id}
              bankroll={user.bankroll}
              onSit={game.sit}
            />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center text-white/40">
              {game.connected ? "Loading table…" : "Connecting…"}
            </div>
          )}

          {/* Action bar */}
          <div className="panel p-4">
            {game.state && me ? (
              <div className="space-y-3">
                <Controls state={game.state} onAct={game.act} />
                <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                  <span className="text-white/50">
                    Blinds {game.state.smallBlind}/{game.state.bigBlind} · Stack{" "}
                    <span className="font-bold text-gold">{me.stack.toLocaleString()}</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => setRebuyOpen((v) => !v)}
                    >
                      Add chips
                    </button>
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => game.stand()}
                    >
                      Stand up
                    </button>
                  </div>
                </div>
                {rebuyOpen && (
                  <RebuyRow
                    onRebuy={(amt) => {
                      game.rebuy(amt);
                      setRebuyOpen(false);
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-white/40">
                Pick an open seat to join the game.
              </div>
            )}
          </div>
        </div>

        <div className="h-[70vh] lg:h-auto">
          <SidePanel code={code} messages={game.state?.messages ?? []} onChat={game.chat} />
        </div>
      </div>
    </main>
  );
}

function RebuyRow({ onRebuy }: { onRebuy: (amount: number) => void }) {
  const [amount, setAmount] = useState(2000);
  return (
    <div className="flex items-center gap-2 border-t border-white/10 pt-3">
      <input
        type="number"
        min={100}
        step={100}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="input py-1.5 text-sm"
      />
      <button className="btn-gold shrink-0 px-4 py-1.5 text-sm" onClick={() => onRebuy(amount)}>
        Add from bankroll
      </button>
    </div>
  );
}
