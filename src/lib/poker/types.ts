// Shared poker types used by both the server engine and the client UI.

export type Suit = "c" | "d" | "h" | "s";

export interface Card {
  rank: number; // 2..14 (11=J, 12=Q, 13=K, 14=A)
  suit: Suit;
}

export type Stage =
  | "waiting" // not enough players / between hands
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export type ActionType = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export interface PlayerAction {
  type: ActionType;
  amount?: number; // total amount the player wants their street bet to become (for bet/raise)
}

// Full server-side player record.
export interface Player {
  userId: number;
  name: string;
  seat: number;
  stack: number; // chips in front of the player at the table
  holeCards: Card[];
  inHand: boolean; // dealt into the current hand
  folded: boolean;
  allIn: boolean;
  bet: number; // chips committed on the current street
  totalCommitted: number; // chips committed over the whole hand (for side pots)
  hasActed: boolean; // has acted since the last raise on this street
  sittingOut: boolean; // present but not in hands (e.g. just joined, or out of chips)
  connected: boolean;
  lastAction?: ActionType;
  pendingBuyIn?: number; // chips to add to stack before the next hand
  leaving?: boolean; // will stand up after the current hand
}

export interface Pot {
  amount: number;
  eligible: number[]; // seat indices eligible to win this pot
}

export interface ShowdownResult {
  seat: number;
  handName: string;
  cards: Card[]; // best 5-card hand
  won: number; // chips won across all pots
}

// ---- Views sent to clients (hole cards redacted for others) ----

export interface PublicPlayer {
  userId: number;
  name: string;
  seat: number;
  stack: number;
  folded: boolean;
  allIn: boolean;
  inHand: boolean;
  bet: number;
  sittingOut: boolean;
  connected: boolean;
  lastAction?: ActionType;
  // Hole cards: present only for the receiving player, or at showdown.
  holeCards: Card[] | null;
  cardsFaceDown: number; // how many face-down cards to render for this player
  leaving?: boolean;
}

export interface GameView {
  code: string;
  stage: Stage;
  players: PublicPlayer[];
  board: Card[];
  pot: number; // total in all pots (for display)
  pots: { amount: number; eligible: number[] }[];
  dealerSeat: number;
  currentToAct: number; // -1 when nobody is to act
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  // Legal action info for the receiving player (null if not their turn).
  toActInfo: {
    seat: number;
    callAmount: number; // chips needed to call
    minRaiseTo: number; // smallest legal "raise to" total
    maxRaiseTo: number; // all-in total
    canCheck: boolean;
  } | null;
  showdown: ShowdownResult[] | null;
  lastHandSummary: string | null;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  ts: number;
  system?: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  bankroll: number;
  isAdmin: boolean;
}

export interface LeaderEntry {
  id: number;
  username: string;
  bankroll: number;
  inPlay: number;
  total: number;
  isAdmin: boolean;
}
