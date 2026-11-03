"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/poker/types";
import { clearAuth, getUser, login, refreshUser } from "@/lib/client/auth";
import { Leaderboard } from "@/components/Leaderboard";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUser(u);
      refreshUser().then((fresh) => fresh && setUser(fresh));
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(username, password);
      setUser(u);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function joinRoom(target: string) {
    const c = target.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(c)) {
      setError("Room code must be 4–8 letters/numbers");
      return;
    }
    router.push(`/room/${c}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 p-6">
      <header className="text-center">
        <div className="mb-2 text-6xl drop-shadow-[0_4px_12px_rgba(232,193,90,0.35)]">♠️</div>
        <h1 className="bg-gradient-to-b from-gold to-gold-dark bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
          ROYAL POKER
        </h1>
        <p className="mt-1 text-sm text-white/50">No-Limit Texas Hold&apos;em with friends</p>
      </header>

      {!user ? (
        <form onSubmit={handleLogin} className="panel w-full max-w-md space-y-4 p-6">
          <h2 className="text-lg font-semibold">Sign in / Create account</h2>
          <p className="text-xs text-white/40">
            New here? Just pick a username and password — you&apos;ll start with 10,000 chips.
          </p>
          <input
            className="input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-gold w-full" disabled={busy}>
            {busy ? "…" : "Enter"}
          </button>
        </form>
      ) : (
        <div className="grid w-full gap-5 md:grid-cols-[1fr_320px]">
          <div className="panel space-y-5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/50">Signed in as</p>
                <p className="text-lg font-semibold">
                  {user.username}
                  {user.isAdmin && (
                    <span className="ml-2 rounded bg-gold/20 px-1.5 text-[10px] font-bold text-gold">
                      ADMIN
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/50">Bankroll</p>
                <p className="text-2xl font-black text-gold">{user.bankroll.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button className="btn-gold w-full py-3 text-base" onClick={() => joinRoom(randomCode())}>
                Create a new table
              </button>
              <div className="flex items-center gap-2 text-xs text-white/30">
                <div className="h-px flex-1 bg-white/10" /> or join a friend{" "}
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="flex gap-2">
                <input
                  className="input uppercase tracking-widest"
                  placeholder="ROOM CODE"
                  value={code}
                  maxLength={8}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom(code)}
                />
                <button className="btn-ghost shrink-0" onClick={() => joinRoom(code)}>
                  Join
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex items-center gap-4 pt-1 text-xs">
              <button
                className="text-white/40 underline hover:text-white/70"
                onClick={() => {
                  clearAuth();
                  setUser(null);
                }}
              >
                Sign out
              </button>
              <button
                className="text-gold/70 underline hover:text-gold"
                onClick={() => router.push("/admin")}
              >
                {user.isAdmin ? "Admin panel" : "Admin access"}
              </button>
            </div>
          </div>

          <Leaderboard highlightId={user.id} />
        </div>
      )}

      <footer className="text-center text-xs text-white/25">
        Play money only · Share your room code with friends to play together
      </footer>
    </main>
  );
}
