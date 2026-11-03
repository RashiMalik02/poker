"use client";

import type { AuthUser } from "@/lib/poker/types";

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
