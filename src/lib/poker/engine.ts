import type {
  Card,
  ChatMessage,
  GameView,
  Player,
  PlayerAction,
  PublicPlayer,
  ShowdownResult,
  Stage,
} from "./types";
import { freshDeck, shuffle } from "./cards";
import { compareScores, evaluateBest, HandScore } from "./handEvaluator";

export const MAX_SEATS = 9;

// Time each player has to act before they're auto-checked/folded.
export const TURN_MS = 30_000;

export interface TableConfig {
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
}

export const DEFAULT_CONFIG: TableConfig = {
  smallBlind: 25,
  bigBlind: 50,
  minBuyIn: 1000,
  maxBuyIn: Number.POSITIVE_INFINITY, // unlimited — only bounded by the player's bankroll
};

/**
 * One poker table / room. Fully server-authoritative: it validates every
 * action and only ever exposes redacted views to clients.
 */
export class PokerTable {
  code: string;
  config: TableConfig;
  seats: (Player | null)[] = new Array(MAX_SEATS).fill(null);
  deck: Card[] = [];
  board: Card[] = [];
  stage: Stage = "waiting";
  dealerSeat = -1;
  actingSeat = -1;
  turnEndsAt = 0; // epoch ms the current player's turn auto-resolves
  currentBet = 0;
  minRaise = 0;
  pot = 0; // chips already collected into the pot from previous streets
  handNumber = 0;
  handOver = true;
  paused = false; // when true, no new hands start and the turn clock is frozen
  showdownResults: ShowdownResult[] | null = null;
  lastHandSummary: string | null = null;
  revealedSeats: Set<number> = new Set();
  messages: ChatMessage[] = [];

  constructor(code: string, config: TableConfig = DEFAULT_CONFIG) {
    this.code = code;
    this.config = config;
  }

  // ---------- seating ----------

  seatPlayer(userId: number, name: string, seat: number, buyIn: number): string | null {
    if (seat < 0 || seat >= MAX_SEATS) return "Invalid seat";
    if (this.seats[seat]) return "Seat taken";
    if (this.seats.some((p) => p && p.userId === userId)) return "Already seated";
    const amount = Math.floor(buyIn);
    const { minBuyIn, maxBuyIn } = this.config;
    if (amount < minBuyIn || amount > maxBuyIn) {
      return Number.isFinite(maxBuyIn)
        ? `Buy-in must be between ${minBuyIn} and ${maxBuyIn}`
        : `Buy-in must be at least ${minBuyIn}`;
    }
    this.seats[seat] = {
      userId,
      name,
      seat,
      stack: amount,
      holeCards: [],
      inHand: false,
      folded: false,
      allIn: false,
      bet: 0,
      totalCommitted: 0,
      hasActed: false,
      sittingOut: true, // joins on the next hand
      connected: true,
    };
    this.system(`${name} sat down with ${amount} chips.`);
    return null;
  }

  // Returns chips to return to the player's bankroll, or null if not seated.
  standUp(userId: number): number | null {
    const idx = this.seats.findIndex((p) => p && p.userId === userId);
    if (idx === -1) return null;
    const player = this.seats[idx]!;
    // If they're in a live hand, mark folded so the hand can resolve, and
    // defer the actual removal until the hand is over.
    if (!this.handOver && player.inHand && !player.folded) {
      player.folded = true;
      player.leaving = true;
      this.system(`${player.name} is leaving after this hand.`);
      this.maybeAdvanceAfterFold();
      return 0; // chips returned when the hand resolves
    }
    const chips = player.stack;
    this.seats[idx] = null;
    this.system(`${player.name} left the table.`);
    return chips;
  }

  setConnected(userId: number, connected: boolean) {
    const p = this.playerByUser(userId);
    if (p) p.connected = connected;
  }

  addBuyIn(userId: number, amount: number): string | null {
    const p = this.playerByUser(userId);
    if (!p) return "Not seated";
    if (amount <= 0) return "Invalid amount";
    if (
      Number.isFinite(this.config.maxBuyIn) &&
      p.stack + (p.pendingBuyIn ?? 0) + amount > this.config.maxBuyIn
    ) {
      return `Table max is ${this.config.maxBuyIn} chips`;
    }
    if (this.handOver || !p.inHand) {
      p.stack += amount;
    } else {
      p.pendingBuyIn = (p.pendingBuyIn ?? 0) + amount;
      this.system(`${p.name} added ${amount} chips (applied next hand).`);
    }
    return null;
  }

  playerByUser(userId: number): Player | null {
    return this.seats.find((p) => p && p.userId === userId) ?? null;
  }

  occupiedCount(): number {
    return this.seats.filter((p) => p !== null).length;
  }

  readyPlayers(): Player[] {
    return this.seats.filter(
      (p): p is Player => !!p && p.stack > 0 && !p.leaving
    );
  }

  // ---------- hand lifecycle ----------

  canStart(): boolean {
    return this.handOver && !this.paused && this.readyPlayers().length >= 2;
  }

  // ---------- pause / show cards ----------

  // Freeze the table: no new hands start and the active turn clock stops.
  pause(byName: string): boolean {
    if (this.paused) return false;
    this.paused = true;
    this.system(`${byName} paused the game.`);
    return true;
  }

  // Unfreeze; give whoever is to act a fresh turn clock.
  resume(byName: string): boolean {
    if (!this.paused) return false;
    this.paused = false;
    if (!this.handOver && this.actingSeat >= 0) {
      this.turnEndsAt = Date.now() + TURN_MS;
    }
    this.system(`${byName} resumed the game.`);
    return true;
  }

  // Voluntarily show your hole cards to the whole table for the current hand.
  revealCards(userId: number): string | null {
    const seat = this.seats.findIndex((p) => p && p.userId === userId);
    if (seat === -1) return "Not seated";
    const p = this.seats[seat]!;
    if (!p.inHand || p.holeCards.length === 0) return "No cards to show";
    if (this.revealedSeats.has(seat)) return null;
    this.revealedSeats.add(seat);
    this.system(`${p.name} showed their cards.`);
    return null;
  }

  startHand(): boolean {
    if (!this.canStart()) return false;

    // Apply pending buy-ins and reset per-hand state.
    for (const p of this.seats) {
      if (!p) continue;
      if (p.pendingBuyIn) {
        p.stack += p.pendingBuyIn;
        p.pendingBuyIn = 0;
      }
      p.holeCards = [];
      p.folded = false;
      p.allIn = false;
      p.bet = 0;
      p.totalCommitted = 0;
      p.hasActed = false;
      p.lastAction = undefined;
      p.inHand = p.stack > 0 && !p.leaving;
      p.sittingOut = !p.inHand;
    }

    this.board = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = this.config.bigBlind;
    this.showdownResults = null;
    this.revealedSeats.clear();
    this.handOver = false;
    this.handNumber += 1;
    this.deck = shuffle(freshDeck());

    // Advance the button to the next in-hand seat.
    this.dealerSeat = this.nextInHandSeat(
      this.dealerSeat === -1 ? MAX_SEATS - 1 : this.dealerSeat
    );

    const inHand = this.inHandSeats();
    const headsUp = inHand.length === 2;

    let sbSeat: number;
    let bbSeat: number;
    if (headsUp) {
      sbSeat = this.dealerSeat;
      bbSeat = this.nextInHandSeat(this.dealerSeat);
    } else {
      sbSeat = this.nextInHandSeat(this.dealerSeat);
      bbSeat = this.nextInHandSeat(sbSeat);
    }

    // Deal two hole cards to each player (one at a time, button-last style).
    for (let round = 0; round < 2; round++) {
      let s = this.nextInHandSeat(this.dealerSeat);
      for (let i = 0; i < inHand.length; i++) {
        this.seats[s]!.holeCards.push(this.deck.pop()!);
        s = this.nextInHandSeat(s);
      }
    }

    this.postBlind(sbSeat, this.config.smallBlind);
    this.postBlind(bbSeat, this.config.bigBlind);
    this.currentBet = this.config.bigBlind;
    this.minRaise = this.config.bigBlind;

    this.stage = "preflop";
    // First to act preflop is left of the big blind (which is the button heads-up).
    this.setActing(this.firstToActFrom(this.nextInHandSeat(bbSeat)));
    this.lastHandSummary = null;
    this.system(`Hand #${this.handNumber} dealt. Blinds ${this.config.smallBlind}/${this.config.bigBlind}.`);

    // Edge case: blinds put everyone all-in already.
    if (this.actingSeat === -1) this.runOutAndShowdown();
    return true;
  }

  private postBlind(seat: number, amount: number) {
    const p = this.seats[seat];
    if (!p) return;
    const put = Math.min(amount, p.stack);
    p.stack -= put;
    p.bet += put;
    p.totalCommitted += put;
    if (p.stack === 0) p.allIn = true;
  }

  // ---------- actions ----------

  // Returns an error string, or null on success.
  act(userId: number, action: PlayerAction): string | null {
    if (this.handOver) return "No hand in progress";
    if (this.paused) return "Game is paused";
    const seat = this.seats.findIndex((p) => p && p.userId === userId);
    if (seat === -1) return "Not seated";
    if (seat !== this.actingSeat) return "Not your turn";
    const p = this.seats[seat]!;
    if (p.folded || p.allIn) return "You cannot act";

    const toCall = this.currentBet - p.bet;

    switch (action.type) {
      case "fold": {
        p.folded = true;
        p.lastAction = "fold";
        break;
      }
      case "check": {
        if (toCall > 0) return "Cannot check facing a bet";
        p.lastAction = "check";
        break;
      }
      case "call": {
        if (toCall <= 0) return "Nothing to call";
        this.commit(p, Math.min(toCall, p.stack));
        p.lastAction = "call";
        break;
      }
      case "bet":
      case "raise":
      case "allin": {
        const raiseTo =
          action.type === "allin"
            ? p.bet + p.stack
            : Math.floor(action.amount ?? 0);
        const err = this.validateRaise(p, raiseTo);
        if (err) return err;
        const increment = raiseTo - this.currentBet;
        const put = raiseTo - p.bet;
        this.commit(p, put);
        // A full raise reopens the action for everyone else.
        if (increment >= this.minRaise) {
          this.minRaise = increment;
          for (const other of this.seats) {
            if (other && other !== p && !other.folded && !other.allIn) {
              other.hasActed = false;
            }
          }
        }
        this.currentBet = Math.max(this.currentBet, raiseTo);
        p.lastAction = p.bet > 0 && toCall === 0 && action.type === "bet" ? "bet" : "raise";
        if (this.currentBet === p.bet && action.type === "bet") p.lastAction = "bet";
        break;
      }
      default:
        return "Unknown action";
    }

    p.hasActed = true;
    if (p.allIn && p.lastAction !== "fold") p.lastAction = "allin";

    this.maybeAdvanceAfterFold();
    return null;
  }

  // A player may only raise if the action was (re)opened to them — i.e. they
  // haven't yet acted since the last full-sized bet or raise. This enforces the
  // incomplete-raise rule: a short all-in that is less than a full raise does
  // not give players who already acted the right to re-raise.
  private canReopen(p: Player): boolean {
    return !p.hasActed;
  }

  private validateRaise(p: Player, raiseTo: number): string | null {
    const allInTo = p.bet + p.stack;
    const isAllIn = raiseTo >= allInTo;
    if (raiseTo > allInTo) return "You don't have that many chips";
    if (this.currentBet > 0 && !this.canReopen(p)) {
      return "You can only call or fold — the raise was incomplete";
    }
    if (this.currentBet === 0) {
      // Opening bet.
      if (!isAllIn && raiseTo < this.config.bigBlind) {
        return `Minimum bet is ${this.config.bigBlind}`;
      }
    } else {
      const minLegal = this.currentBet + this.minRaise;
      if (!isAllIn && raiseTo < minLegal) {
        return `Minimum raise is to ${minLegal}`;
      }
      if (raiseTo <= this.currentBet) return "Raise must exceed the current bet";
    }
    return null;
  }

  private commit(p: Player, amount: number) {
    const put = Math.min(amount, p.stack);
    p.stack -= put;
    p.bet += put;
    p.totalCommitted += put;
    if (p.stack === 0) p.allIn = true;
  }

  // After any action (or a fold on leaving), decide what happens next.
  private maybeAdvanceAfterFold() {
    const contenders = this.seats.filter((p) => p && p.inHand && !p.folded);
    if (contenders.length === 1) {
      this.awardToLastStanding(contenders[0]!);
      return;
    }
    const next = this.firstToActFrom(this.nextInHandSeat(this.actingSeat));
    if (next === -1) {
      // Betting round is complete.
      this.advanceStreet();
    } else {
      this.setActing(next);
    }
  }

  private setActing(seat: number) {
    this.actingSeat = seat;
    this.turnEndsAt = seat >= 0 ? Date.now() + TURN_MS : 0;
  }

  private advanceStreet() {
    // Collect this street's bets into the pot.
    for (const p of this.seats) {
      if (p) {
        this.pot += p.bet;
        p.bet = 0;
        p.hasActed = false;
      }
    }
    this.currentBet = 0;
    this.minRaise = this.config.bigBlind;

    if (this.stage === "river") {
      this.showdown();
      return;
    }

    this.dealNextStreet();

    // If fewer than two players can still act, run it out to showdown.
    if (this.countCanAct() < 2) {
      this.runOutAndShowdown();
      return;
    }

    this.setActing(this.firstToActFrom(this.nextInHandSeat(this.dealerSeat)));
    if (this.actingSeat === -1) this.runOutAndShowdown();
  }

  private dealNextStreet() {
    if (this.stage === "preflop") {
      this.deck.pop(); // burn
      this.board.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
      this.stage = "flop";
    } else if (this.stage === "flop") {
      this.deck.pop();
      this.board.push(this.deck.pop()!);
      this.stage = "turn";
    } else if (this.stage === "turn") {
      this.deck.pop();
      this.board.push(this.deck.pop()!);
      this.stage = "river";
    }
  }

  private runOutAndShowdown() {
    while (this.stage !== "river") {
      this.dealNextStreet();
    }
    this.showdown();
  }

  private countCanAct(): number {
    return this.seats.filter((p) => p && p.inHand && !p.folded && !p.allIn).length;
  }

  // ---------- resolution ----------

  private awardToLastStanding(winner: Player) {
    // Pull remaining street bets into the pot first.
    for (const p of this.seats) {
      if (p) {
        this.pot += p.bet;
        p.bet = 0;
      }
    }
    winner.stack += this.pot;
    this.lastHandSummary = `${winner.name} wins ${this.pot} chips (everyone folded).`;
    this.system(this.lastHandSummary);
    this.pot = 0;
    this.finishHand();
  }

  private showdown() {
    this.stage = "showdown";
    const pots = this.computePots();

    // Evaluate hands for everyone still in.
    const scores = new Map<number, HandScore>();
    for (let s = 0; s < MAX_SEATS; s++) {
      const p = this.seats[s];
      if (p && p.inHand && !p.folded) {
        scores.set(s, evaluateBest([...p.holeCards, ...this.board]));
        this.revealedSeats.add(s);
      }
    }

    const winnings = new Map<number, number>();
    const results = new Map<number, ShowdownResult>();
    for (const [seat, score] of scores) {
      results.set(seat, {
        seat,
        handName: score.name,
        cards: score.cards,
        won: 0,
      });
    }

    for (const pot of pots) {
      const eligible = pot.eligible.filter((s) => scores.has(s));
      if (eligible.length === 0) continue;
      let best: HandScore | null = null;
      let winners: number[] = [];
      for (const s of eligible) {
        const sc = scores.get(s)!;
        const cmp = best ? compareScores(sc, best) : 1;
        if (cmp > 0) {
          best = sc;
          winners = [s];
        } else if (cmp === 0) {
          winners.push(s);
        }
      }
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      // Odd chip goes to the first winner left of the button.
      const ordered = this.orderFromButton(winners);
      for (const s of ordered) {
        let amt = share;
        if (remainder > 0) {
          amt += 1;
          remainder -= 1;
        }
        winnings.set(s, (winnings.get(s) ?? 0) + amt);
      }
    }

    const summaryParts: string[] = [];
    for (const [seat, amt] of winnings) {
      const p = this.seats[seat]!;
      p.stack += amt;
      const r = results.get(seat)!;
      r.won = amt;
      summaryParts.push(`${p.name} wins ${amt} with ${r.handName}`);
    }

    this.showdownResults = Array.from(results.values()).sort((a, b) => b.won - a.won);
    this.lastHandSummary = summaryParts.join(" · ");
    if (this.lastHandSummary) this.system(this.lastHandSummary);
    this.pot = 0;
    this.finishHand();
  }

  // Build main + side pots from each player's total commitment this hand.
  private computePots(): { amount: number; eligible: number[] }[] {
    const contribs: { seat: number; amount: number; folded: boolean }[] = [];
    for (let s = 0; s < MAX_SEATS; s++) {
      const p = this.seats[s];
      if (p && p.totalCommitted > 0) {
        contribs.push({ seat: s, amount: p.totalCommitted, folded: p.folded || !p.inHand });
      }
    }
    const pots: { amount: number; eligible: number[] }[] = [];
    while (contribs.some((c) => c.amount > 0)) {
      const min = Math.min(...contribs.filter((c) => c.amount > 0).map((c) => c.amount));
      let amount = 0;
      const eligible: number[] = [];
      for (const c of contribs) {
        if (c.amount > 0) {
          amount += min;
          c.amount -= min;
          if (!c.folded) eligible.push(c.seat);
        }
      }
      // Merge with previous pot if the eligible set is identical.
      const key = eligible.slice().sort((a, b) => a - b).join(",");
      const prev = pots[pots.length - 1];
      if (prev && prev.eligible.slice().sort((a, b) => a - b).join(",") === key) {
        prev.amount += amount;
      } else {
        pots.push({ amount, eligible });
      }
    }
    return pots;
  }

  private orderFromButton(seats: number[]): number[] {
    const order: number[] = [];
    let s = this.nextInHandSeat(this.dealerSeat);
    for (let i = 0; i < MAX_SEATS; i++) {
      if (seats.includes(s)) order.push(s);
      s = this.nextSeat(s);
    }
    // Fallback for any not captured (shouldn't happen).
    for (const x of seats) if (!order.includes(x)) order.push(x);
    return order;
  }

  private finishHand() {
    this.handOver = true;
    this.setActing(-1);
  }

  // Remove players who asked to leave; caller returns their chips to bankroll.
  collectDepartures(): { userId: number; chips: number; name: string }[] {
    const gone: { userId: number; chips: number; name: string }[] = [];
    for (let s = 0; s < MAX_SEATS; s++) {
      const p = this.seats[s];
      if (p && p.leaving) {
        gone.push({ userId: p.userId, chips: p.stack, name: p.name });
        this.seats[s] = null;
      }
    }
    return gone;
  }

  // ---------- seat traversal helpers ----------

  private inHandSeats(): number[] {
    const out: number[] = [];
    for (let s = 0; s < MAX_SEATS; s++) if (this.seats[s]?.inHand) out.push(s);
    return out;
  }

  private nextSeat(from: number): number {
    return (from + 1) % MAX_SEATS;
  }

  // Next seat (cyclically after `from`) that is dealt into the current hand.
  private nextInHandSeat(from: number): number {
    for (let i = 1; i <= MAX_SEATS; i++) {
      const s = (from + i) % MAX_SEATS;
      if (this.seats[s]?.inHand) return s;
    }
    return from;
  }

  // Starting at `from`, the first seat that still needs to act, or -1.
  private firstToActFrom(from: number): number {
    for (let i = 0; i < MAX_SEATS; i++) {
      const s = (from + i) % MAX_SEATS;
      const p = this.seats[s];
      if (p && this.needsToAct(p)) return s;
    }
    return -1;
  }

  private needsToAct(p: Player): boolean {
    if (!p.inHand || p.folded || p.allIn) return false;
    return !p.hasActed || p.bet < this.currentBet;
  }

  // ---------- chat ----------

  chat(name: string, text: string) {
    const clean = text.trim().slice(0, 300);
    if (!clean) return;
    this.pushMessage({ id: rid(), name, text: clean, ts: Date.now() });
  }

  private system(text: string) {
    this.pushMessage({ id: rid(), name: "", text, ts: Date.now(), system: true });
  }

  private pushMessage(m: ChatMessage) {
    this.messages.push(m);
    if (this.messages.length > 60) this.messages.shift();
  }

  // ---------- view ----------

  view(forUserId: number): GameView {
    const players: PublicPlayer[] = [];
    for (let s = 0; s < MAX_SEATS; s++) {
      const p = this.seats[s];
      if (!p) continue;
      const showHole = p.userId === forUserId || this.revealedSeats.has(s);
      players.push({
        userId: p.userId,
        name: p.name,
        seat: p.seat,
        stack: p.stack,
        folded: p.folded,
        allIn: p.allIn,
        inHand: p.inHand,
        bet: p.bet,
        sittingOut: p.sittingOut,
        connected: p.connected,
        lastAction: p.lastAction,
        holeCards: showHole ? p.holeCards : null,
        cardsFaceDown: p.inHand && !p.folded && !showHole ? p.holeCards.length : 0,
        revealed: this.revealedSeats.has(s),
        leaving: p.leaving,
      });
    }

    const me = this.playerByUser(forUserId);
    let toActInfo: GameView["toActInfo"] = null;
    if (!this.handOver && this.actingSeat >= 0 && me && me.seat === this.actingSeat) {
      const toCall = this.currentBet - me.bet;
      const maxRaiseTo = me.bet + me.stack;
      const minRaiseTo = Math.min(
        maxRaiseTo,
        this.currentBet === 0 ? this.config.bigBlind : this.currentBet + this.minRaise
      );
      // Can only raise if the action is open to them and they have chips past a call.
      const canRaise =
        maxRaiseTo > this.currentBet && (this.currentBet === 0 || this.canReopen(me));
      toActInfo = {
        seat: me.seat,
        callAmount: Math.max(0, Math.min(toCall, me.stack)),
        minRaiseTo,
        maxRaiseTo,
        canCheck: toCall <= 0,
        canRaise,
      };
    }

    const livePots = this.handOver ? [] : this.computePotsPreview();

    return {
      code: this.code,
      stage: this.stage,
      players,
      board: this.board,
      pot: this.pot + this.seats.reduce((sum, p) => sum + (p?.bet ?? 0), 0),
      pots: livePots,
      dealerSeat: this.dealerSeat,
      paused: this.paused,
      currentToAct: this.handOver ? -1 : this.actingSeat,
      turnEndsAt: this.handOver || this.paused ? 0 : this.turnEndsAt,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      smallBlind: this.config.smallBlind,
      bigBlind: this.config.bigBlind,
      handNumber: this.handNumber,
      toActInfo,
      showdown: this.showdownResults,
      lastHandSummary: this.lastHandSummary,
      messages: this.messages,
    };
  }

  private computePotsPreview(): { amount: number; eligible: number[] }[] {
    // A display-only snapshot of pots including current street bets.
    const saved = this.seats.map((p) => (p ? p.totalCommitted : 0));
    const pots = this.computePots();
    void saved;
    return pots;
  }
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}
