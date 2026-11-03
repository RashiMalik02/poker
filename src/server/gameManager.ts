import type { Server, Socket } from "socket.io";
import { PokerTable, DEFAULT_CONFIG, MAX_SEATS } from "@/lib/poker/engine";
import type { PlayerAction } from "@/lib/poker/types";
import { depositBankroll, getBankroll, withdrawBankroll } from "./db";

const TURN_SECONDS = 40;
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
    this.broadcast(code);
    return null;
  }

  stand(socket: Socket): string | null {
    const { code, userId } = socket.data as { code: string; userId: number };
    const room = this.rooms.get(code);
    if (!room) return "Room not found";
    const chips = room.standUp(userId);
    if (chips === null) return "Not seated";
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
    // Clean up empty rooms.
    if (room.occupiedCount() === 0) {
      const t = this.timers.get(code);
      if (t?.turn) clearTimeout(t.turn);
      if (t?.nextHand) clearTimeout(t.nextHand);
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
    if (room.handOver || room.actingSeat < 0) return;
    const seat = room.actingSeat;
    const player = room.seats[seat];
    if (!player) return;
    timers.turn = setTimeout(() => {
      timers.turn = undefined;
      if (room.handOver || room.actingSeat !== seat) return;
      const canCheck = room.currentBet - player.bet <= 0;
      room.act(player.userId, { type: canCheck ? "check" : "fold" });
      this.afterStateChange(code);
    }, TURN_SECONDS * 1000);
  }
}

export { MAX_SEATS };
