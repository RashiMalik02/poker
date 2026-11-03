# ♠ Royal Poker

No-Limit Texas Hold'em you can play online with your friends. Full stack:
Next.js + a custom Socket.IO game server + SQLite, with a server-authoritative
poker engine (nobody can see your hole cards) and persistent chip bankrolls.

## Features

- **Real-time multiplayer** over WebSockets — up to 9 players per table.
- **Full No-Limit Hold'em rules**: blinds, min-raise enforcement, all-in,
  **side pots**, proper showdown and tie splitting (odd chip to the left of the button).
- **Server-authoritative engine** — the server validates every action and only
  ever sends each player their *own* hole cards.
- **Persistent accounts & chips** — sign in with a username/password, start with
  10,000 chips, buy in and cash out of tables against your bankroll.
- **Private rooms** via a shareable room code + invite link.
- **Table UI**: animated dealing, dealer button, bet chips, pot, raise slider with
  pot-fraction shortcuts, turn timer (auto-check/fold after 40s), and table chat.

## Quick start

```bash
npm install          # native deps (better-sqlite3) build automatically
cp .env.example .env # then edit AUTH_SECRET to a long random string
npm run dev          # http://localhost:3000
```

> On a sandboxed npm that blocks install scripts, run
> `npm approve-scripts better-sqlite3 esbuild fsevents` once after installing.

### Production

```bash
npm run build
AUTH_SECRET="a-long-random-secret" PORT=3000 npm start
```

Deploy on any host that runs a persistent Node process (Railway, Render, Fly.io,
a VPS) — **not** classic serverless, because the game lives in a long-running
WebSocket server. The SQLite file (`poker.db`) is created next to the app; mount
a persistent volume for it in production.

## Playing with friends

1. Everyone opens the site and signs in (new username = new account + 10k chips).
2. One person clicks **Create a new table** and shares the **Invite link**
   (or just the 5-letter room code).
3. Everyone clicks an open seat and chooses a buy-in. Hands auto-deal once two or
   more players are seated.

## How it fits together

| Area | Where |
|------|-------|
| Poker rules & hand ranking | `src/lib/poker/` (`engine.ts`, `handEvaluator.ts`, `cards.ts`) |
| Rooms, timers, bankroll settlement | `src/server/gameManager.ts` |
| Auth & database | `src/server/auth.ts`, `src/server/db.ts` |
| WebSocket + Next server | `server.ts` |
| Login API | `src/app/api/login/route.ts` |
| UI | `src/app/` (lobby + room) and `src/components/` (table, seats, cards, controls, chat) |

## Config

Blinds and buy-in limits live in `DEFAULT_CONFIG` in `src/lib/poker/engine.ts`
(default blinds 25/50, buy-in 1,000–10,000).

## Notes

- Play money only.
- The turn timer auto-checks or folds after 40 seconds so a disconnected or idle
  player can't stall the table.
- A short all-in that is less than a full raise does not re-open betting is
  approximated simply (friendly-game rules); everything resolves with correct
  pots regardless.
