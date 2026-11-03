"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser, LeaderEntry } from "@/lib/poker/types";
import {
  claimAdmin,
  fetchAdminUsers,
  getUser,
  grantChips,
  refreshUser,
} from "@/lib/client/auth";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<LeaderEntry[]>([]);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [grantAmounts, setGrantAmounts] = useState<Record<number, number>>({});
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await fetchAdminUsers());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace("/");
      return;
    }
    refreshUser().then((fresh) => {
      const current = fresh ?? u;
      setUser(current);
      setReady(true);
      if (current.isAdmin) load();
    });
  }, [router, load]);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const updated = await claimAdmin(code);
      setUser(updated);
      if (updated.isAdmin) load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleGrant(targetId: number, amount: number) {
    if (!amount || amount <= 0) return;
    setError("");
    try {
      await grantChips(targetId, amount);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready || !user) return null;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => router.push("/")}>
          ← Lobby
        </button>
        <h1 className="text-xl font-extrabold text-gold">Admin</h1>
      </div>

      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">{error}</p>}

      {!user.isAdmin ? (
        <form onSubmit={handleClaim} className="panel space-y-3 p-6">
          <h2 className="font-semibold">Enter admin code</h2>
          <p className="text-xs text-white/40">
            Enter the admin access code to manage chips and players.
          </p>
          <input
            className="input"
            type="password"
            placeholder="Admin code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn-gold w-full">Unlock admin</button>
        </form>
      ) : (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h2 className="font-semibold">Players &amp; chips</h2>
            <button className="btn-ghost px-3 py-1 text-xs" onClick={load}>
              Refresh
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {users.map((u) => {
              const broke = u.total === 0;
              const amt = grantAmounts[u.id] ?? 5000;
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{u.username}</span>
                      {u.isAdmin && <span className="text-[10px] text-gold">ADMIN</span>}
                      {broke && (
                        <span className="rounded bg-red-500/20 px-1.5 text-[10px] font-bold text-red-300">
                          BROKE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/50">
                      Bankroll {u.bankroll.toLocaleString()} · In play {u.inPlay.toLocaleString()} ·
                      Total <span className="font-bold text-gold">{u.total.toLocaleString()}</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={amt}
                    onChange={(e) =>
                      setGrantAmounts((m) => ({ ...m, [u.id]: Number(e.target.value) }))
                    }
                    className="input w-24 py-1.5 text-sm"
                  />
                  <button
                    className="btn-gold px-3 py-1.5 text-sm"
                    onClick={() => handleGrant(u.id, amt)}
                  >
                    Grant
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
