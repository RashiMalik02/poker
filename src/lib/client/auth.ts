"use client";

import type { AuthUser, LeaderEntry } from "@/lib/poker/types";

const TOKEN_KEY = "poker_token";
const USER_KEY = "poker_user";

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// The auth/login endpoint lives on the backend (same-origin by default, or the
// Render backend in a split deploy).
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BACKEND}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  saveAuth(data.token, data.user);
  return data.user as AuthUser;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Re-fetch the signed-in user so bankroll / admin status stay fresh.
export async function refreshUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${BACKEND}/api/me`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data.user as AuthUser;
    saveAuth(token, user);
    return user;
  } catch {
    return null;
  }
}

export async function fetchLeaderboard(): Promise<LeaderEntry[]> {
  try {
    const res = await fetch(`${BACKEND}/api/leaderboard`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.leaders ?? []) as LeaderEntry[];
  } catch {
    return [];
  }
}

export async function claimAdmin(code: string): Promise<AuthUser> {
  const res = await fetch(`${BACKEND}/api/admin/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed");
  const token = getToken();
  if (token) saveAuth(token, data.user);
  return data.user as AuthUser;
}

export async function fetchAdminUsers(): Promise<LeaderEntry[]> {
  const res = await fetch(`${BACKEND}/api/admin/users`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed");
  return (data.users ?? []) as LeaderEntry[];
}

export async function grantChips(targetId: number, amount: number): Promise<void> {
  const res = await fetch(`${BACKEND}/api/admin/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ targetId, amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed");
}
