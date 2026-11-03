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
    created_at INTEGER NOT NULL
  );
`);

export interface UserRow {
  id: number;
  username: string;
  bankroll: number;
}

const STARTING_BANKROLL = 10000;

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
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

  const existing = db
    .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
    .get(name) as
    | { id: number; username: string; pass_hash: string; pass_salt: string; bankroll: number }
    | undefined;

  if (existing) {
    const hash = hashPassword(password, existing.pass_salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(existing.pass_hash))) {
      return { error: "Wrong password" };
    }
    return { user: { id: existing.id, username: existing.username, bankroll: existing.bankroll } };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  const info = db
    .prepare(
      "INSERT INTO users (username, pass_hash, pass_salt, bankroll, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(name, hash, salt, STARTING_BANKROLL, Date.now());
  return {
    user: { id: Number(info.lastInsertRowid), username: name, bankroll: STARTING_BANKROLL },
  };
}

export function getUser(id: number): UserRow | null {
  const row = db.prepare("SELECT id, username, bankroll FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
  return row ?? null;
}

export function getBankroll(id: number): number {
  const row = db.prepare("SELECT bankroll FROM users WHERE id = ?").get(id) as
    | { bankroll: number }
    | undefined;
  return row?.bankroll ?? 0;
}

// Atomically move chips out of a bankroll (e.g. buying into a table). Returns
// false if there aren't enough chips.
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

export default db;
