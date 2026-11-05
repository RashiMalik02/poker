import type { Server, Socket } from "socket.io";
import { PokerTable, DEFAULT_CONFIG, MAX_SEATS } from "@/lib/poker/engine";
import type { PlayerAction } from "@/lib/poker/types";
import { depositBankroll, getBankroll, setInPlay, withdrawBankroll } from "./db";

const NEXT_HAND_DELAY_MS = 4500;

interface RoomTimers {
  turn?: NodeJS.Timeout;
  nextHand?: NodeJS.Timeout;
}

export class GameManager {
  private io: Server;
  private rooms = new Map<string, PokerTable>();
  private timers = new Map<string, RoomTimers>();

  constructor(io: Server) {
    this.io = io;
  }

  getOrCreateRoom(code: string): PokerTable {
    let room = this.rooms.get(code);
    if (!room) {
      room = new PokerTable(code, DEFAULT_CONFIG);
      this.rooms.set(code, room);
      this.timers.set(code, {});
    }
    return room;
  }

  roomExists(code: string): boolean {
    return this.rooms.has(code);
  }

  // Broadcast a redacted view to every connected socket in the room.
  broadcast(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    const sockets = this.io.sockets.adapter.rooms.get(code);
    if (!sockets) return;
    for (const socketId of sockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;
      const userId = socket.data.userId as number | undefined;
      socket.emit("state", room.view(userId ?? -1));
    }
  }

  // Total chips a user currently has sitting at any table (for the leaderboard).
  private totalInPlay(userId: number): number {
    let total = 0;
    for (const room of this.rooms.values()) {
      const p = room.playerByUser(userId);
      if (p) total += p.stack + p.bet;
    }
    return total;
  }

  // Persist the in-play totals for everyone seated in a room.
  private syncInPlay(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    const seen = new Set<number>();
    for (const p of room.seats) {
      if (p && !seen.has(p.userId)) {
        seen.add(p.userId);
        setInPlay(p.userId, this.totalInPlay(p.userId));
      }
    }
  }

  // ---------- actions triggered by socket handlers ----------

  sit(socket: Socket, seat: number, buyIn: number): string | null {
    const { code, userId, username } = socket.data as {
      code: string;
      userId: number;
      username: string;
    };
    const room = this.rooms.get(code);
    if (!room) return "Room not found";

    const bankroll = getBankroll(userId);
    if (buyIn > bankroll) return "Not enough chips in your bankroll";
    // Reserve chips from the bankroll first, then seat.
    if (!withdrawBankroll(userId, buyIn)) return "Not enough chips in your bankroll";
    const err = room.seatPlayer(userId, username, seat, buyIn);
    if (err) {
      depositBankroll(userId, buyIn); // refund on failure
      return err;
    }
    this.maybeStart(code);
    this.syncInPlay(code);
    this.broadcast(code);
    return null;
  }

  stand(socket: Socket): string | null {
    const { code, userId } = socket.data as { code: string; userId: number };
    const room = this.rooms.get(code);
    if (!room) return "Room not found";
    const chips = room.standUp(userId);
    if (chips === null) return "Not seated";
    setInPlay(userId, this.totalInPlay(userId));
    if (chips > 0) depositBankroll(userId, chips);
    this.afterStateChange(code);
    return null;
  }

  rebuy(socket: Socket, amount: number): string | null {
    const { code, userId } = socket.data as { code: string; userId: number };
    const room = this.rooms.get(code);
    if (!room) return "Room not found";
    if (amount <= 0) return "Invalid amount";
    if (!withdrawBankroll(userId, amount)) return "Not enough chips in your bankroll";
    const err = room.addBuyIn(userId, amount);
    if (err) {
      depositBankroll(userId, amount);
      return err;
    }
    this.maybeStart(code);
    this.syncInPlay(code);
    this.broadcast(code);
    return null;
  }

  act(socket: Socket, action: PlayerAction): string | null {
    const { code, userId } = socket.data as { code: string; userId: number };
    const room = this.rooms.get(code);
    if (!room) return "Room not found";
    const err = room.act(userId, action);
    if (err) return err;
    this.afterStateChange(code);
    return null;
  }

  setPause(socket: Socket, paused: boolean): string | null {
    const { code, userId, username } = socket.data as {
      code: string;
      userId: number;
      username: string;
    };
    const room = this.rooms.get(code);
    if (!room) return "Room not found";
    if (!room.playerByUser(userId)) return "Only seated players can pause the game";

    if (paused) {
      room.pause(username);
      // Freeze every pending timer for the table.
      const t = this.timers.get(code);
      if (t?.turn) { clearTimeout(t.turn); t.turn = undefined; }
      if (t?.nextHand) { clearTimeout(t.nextHand); t.nextHand = undefined; }
      this.broadcast(code);
    } else {
      room.resume(username);
      this.broadcast(code);
      // Resume the hand in progress, or queue up the next one.
      if (room.handOver) this.maybeStart(code);
      else this.armTurnTimer(code);
    }
    return null;
  }

  reveal(socket: Socket): string | null {
    const { code, userId } = socket.data as { code: string; userId: number };
    const room = this.rooms.get(code);
    if (!room) return "Room not found";
    const err = room.revealCards(userId);
    if (err) return err;
    this.broadcast(code);
    return null;
  }

  chat(socket: Socket, text: string) {
    const { code, username } = socket.data as { code: string; username: string };
    const room = this.rooms.get(code);
    if (!room) return;
    room.chat(username, text);
    this.broadcast(code);
  }

  onJoin(socket: Socket) {
    const { code, userId } = socket.data as { code: string; userId: number };
    const room = this.getOrCreateRoom(code);
    room.setConnected(userId, true);
    this.broadcast(code);
    this.armTurnTimer(code);
  }

  onDisconnect(socket: Socket) {
    const { code, userId } = socket.data as { code?: string; userId?: number };
    if (!code || userId == null) return;
    const room = this.rooms.get(code);
    if (!room) return;
    room.setConnected(userId, false);
    this.broadcast(code);
    // Clean up empty rooms — return any chips still on the table to bankrolls
    // so they're never lost when everyone leaves.
    if (room.occupiedCount() === 0) {
      const t = this.timers.get(code);
      if (t?.turn) clearTimeout(t.turn);
      if (t?.nextHand) clearTimeout(t.nextHand);
      for (const p of room.seats) {
        if (p) {
          if (p.stack + p.bet > 0) depositBankroll(p.userId, p.stack + p.bet);
          setInPlay(p.userId, 0);
        }
      }
      this.rooms.delete(code);
      this.timers.delete(code);
    }
  }

  // ---------- internal flow ----------

  private afterStateChange(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.handOver) {
      this.settleDepartures(code);
      this.syncInPlay(code);
      this.broadcast(code);
      this.scheduleNextHand(code);
    } else {
      this.broadcast(code);
      this.armTurnTimer(code);
    }
  }

  private settleDepartures(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const dep of room.collectDepartures()) {
      if (dep.chips > 0) depositBankroll(dep.userId, dep.chips);
    }
  }

  private maybeStart(code: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.canStart()) this.scheduleNextHand(code, 1200);
  }

  private scheduleNextHand(code: string, delay = NEXT_HAND_DELAY_MS) {
    const room = this.rooms.get(code);
    const timers = this.timers.get(code);
    if (!room || !timers) return;
    if (timers.nextHand) clearTimeout(timers.nextHand);
    if (!room.canStart()) return;
    timers.nextHand = setTimeout(() => {
      timers.nextHand = undefined;
      if (room.startHand()) {
        this.broadcast(code);
        this.armTurnTimer(code);
        // If the hand resolved instantly (everyone all-in via blinds), chain.
        if (room.handOver) this.afterStateChange(code);
      }
    }, delay);
  }

  // Auto-act for a player who runs out of time (check if possible, else fold).
  private armTurnTimer(code: string) {
    const room = this.rooms.get(code);
    const timers = this.timers.get(code);
    if (!room || !timers) return;
    if (timers.turn) clearTimeout(timers.turn);
    if (room.handOver || room.actingSeat < 0 || room.paused) return;
    const seat = room.actingSeat;
    const player = room.seats[seat];
    if (!player) return;
    // Fire exactly at the engine's turn deadline so the client countdown matches.
    const delay = Math.max(0, room.turnEndsAt - Date.now());
    timers.turn = setTimeout(() => {
      timers.turn = undefined;
      if (room.handOver || room.actingSeat !== seat) return;
      const canCheck = room.currentBet - player.bet <= 0;
      room.act(player.userId, { type: canCheck ? "check" : "fold" });
      this.afterStateChange(code);
    }, delay + 250); // small grace so the client hits 0 first
  }
}

export { MAX_SEATS };
