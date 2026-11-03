import crypto from "crypto";
import path from "path";
import Database from "better-sqlite3";

const dbPath = process.env.POKER_DB ?? path.join(process.cwd(), "poker.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    pass_salt TEXT NOT NULL,
    bankroll INTEGER NOT NULL DEFAULT 10000,
    in_play INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);

// Lightweight migrations for databases created before these columns existed.
const cols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
if (!cols.includes("in_play")) db.exec("ALTER TABLE users ADD COLUMN in_play INTEGER NOT NULL DEFAULT 0");
if (!cols.includes("is_admin")) db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");

export interface UserRow {
  id: number;
  username: string;
  bankroll: number;
  isAdmin: boolean;
}

export interface LeaderRow {
  id: number;
  username: string;
  bankroll: number;
  inPlay: number;
  total: number;
  isAdmin: boolean;
}

const STARTING_BANKROLL = 10000;

// Usernames in ADMIN_USERNAMES are auto-promoted to admin on login.
const ADMIN_USERNAMES = (process.env.ADMIN_USERNAMES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function toUser(row: { id: number; username: string; bankroll: number; is_admin: number }): UserRow {
  return { id: row.id, username: row.username, bankroll: row.bankroll, isAdmin: !!row.is_admin };
}

// Logs in an existing user or creates a new account. Returns the user or an error.
export function loginOrRegister(
  username: string,
  password: string
): { user?: UserRow; error?: string } {
  const name = username.trim();
  if (name.length < 2 || name.length > 20) {
    return { error: "Username must be 2–20 characters" };
  }
  if (!/^[a-zA-Z0-9_ -]+$/.test(name)) {
    return { error: "Username has invalid characters" };
  }
  if (password.length < 4) {
    return { error: "Password must be at least 4 characters" };
  }

  const existing = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(name) as
    | { id: number; username: string; pass_hash: string; pass_salt: string; bankroll: number; is_admin: number }
    | undefined;

  if (existing) {
    const hash = hashPassword(password, existing.pass_salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(existing.pass_hash))) {
      return { error: "Wrong password" };
    }
    maybeAutoAdmin(existing.id, existing.username, existing.is_admin);
    return { user: getUser(existing.id)! };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  const admin = ADMIN_USERNAMES.includes(name.toLowerCase()) ? 1 : 0;
  const info = db
    .prepare(
      "INSERT INTO users (username, pass_hash, pass_salt, bankroll, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(name, hash, salt, STARTING_BANKROLL, admin, Date.now());
  return { user: getUser(Number(info.lastInsertRowid))! };
}

function maybeAutoAdmin(id: number, username: string, current: number) {
  if (!current && ADMIN_USERNAMES.includes(username.toLowerCase())) {
    db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(id);
  }
}

export function getUser(id: number): UserRow | null {
  const row = db
    .prepare("SELECT id, username, bankroll, is_admin FROM users WHERE id = ?")
    .get(id) as { id: number; username: string; bankroll: number; is_admin: number } | undefined;
  return row ? toUser(row) : null;
}

export function getBankroll(id: number): number {
  const row = db.prepare("SELECT bankroll FROM users WHERE id = ?").get(id) as
    | { bankroll: number }
    | undefined;
  return row?.bankroll ?? 0;
}

export function isAdmin(id: number): boolean {
  const row = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(id) as
    | { is_admin: number }
    | undefined;
  return !!row?.is_admin;
}

// Promote the user to admin if they supply the correct ADMIN_SECRET.
export function claimAdmin(id: number, code: string): { ok?: boolean; error?: string } {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return { error: "Admin access is not configured on the server" };
  if (!code || code !== secret) return { error: "Incorrect admin code" };
  db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?").run(id);
  return { ok: true };
}

// Atomically move chips out of a bankroll (e.g. buying into a table).
export function withdrawBankroll(id: number, amount: number): boolean {
  const tx = db.transaction(() => {
    const row = db.prepare("SELECT bankroll FROM users WHERE id = ?").get(id) as
      | { bankroll: number }
      | undefined;
    if (!row || row.bankroll < amount) return false;
    db.prepare("UPDATE users SET bankroll = bankroll - ? WHERE id = ?").run(amount, id);
    return true;
  });
  return tx();
}

export function depositBankroll(id: number, amount: number): void {
  if (amount <= 0) return;
  db.prepare("UPDATE users SET bankroll = bankroll + ? WHERE id = ?").run(amount, id);
}

// Admin action: grant chips to a player's bankroll.
export function grantChips(targetId: number, amount: number): { ok?: boolean; error?: string } {
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Amount must be positive" };
  if (amount > 10_000_000) return { error: "Amount too large" };
  const row = db.prepare("SELECT id FROM users WHERE id = ?").get(targetId);
  if (!row) return { error: "User not found" };
  db.prepare("UPDATE users SET bankroll = bankroll + ? WHERE id = ?").run(Math.floor(amount), targetId);
  return { ok: true };
}

// Keep the denormalized "chips currently at a table" value in sync for the leaderboard.
export function setInPlay(id: number, chips: number): void {
  db.prepare("UPDATE users SET in_play = ? WHERE id = ?").run(Math.max(0, Math.floor(chips)), id);
}

export function listUsers(): LeaderRow[] {
  const rows = db
    .prepare("SELECT id, username, bankroll, in_play, is_admin FROM users ORDER BY (bankroll + in_play) DESC")
    .all() as { id: number; username: string; bankroll: number; in_play: number; is_admin: number }[];
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    bankroll: r.bankroll,
    inPlay: r.in_play,
    total: r.bankroll + r.in_play,
    isAdmin: !!r.is_admin,
  }));
}

export function leaderboard(limit = 20): LeaderRow[] {
  return listUsers().slice(0, limit);
}

export default db;
