import type { Card } from "./types";
import { rankLabel } from "./cards";

// Category ranking, higher is better.
export const CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

const CATEGORY_NAMES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

export interface HandScore {
  category: number;
  // Tiebreaker ranks, most significant first. Compared lexicographically.
  tiebreakers: number[];
  cards: Card[]; // the 5 cards forming the hand
  name: string;
}

function evaluate5(cards: Card[]): HandScore {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Build distinct, descending ranks to detect straights (handle wheel A-5).
  const uniq = Array.from(new Set(ranks)).sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) {
      straightHigh = uniq[0];
    } else if (
      uniq[0] === 14 &&
      uniq[1] === 5 &&
      uniq[2] === 4 &&
      uniq[3] === 3 &&
      uniq[4] === 2
    ) {
      straightHigh = 5; // wheel: ace plays low
    }
  }
  const isStraight = straightHigh > 0;

  // Count rank multiplicities.
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Sort by (count desc, rank desc).
  const grouped = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const shape = grouped.map((g) => g[1]); // e.g. [3,2] for full house
  const byCount = grouped.map((g) => g[0]); // ranks ordered by the sort above

  let category: number;
  let tiebreakers: number[];

  if (isStraight && isFlush) {
    category = CATEGORY.STRAIGHT_FLUSH;
    tiebreakers = [straightHigh];
  } else if (shape[0] === 4) {
    category = CATEGORY.QUADS;
    tiebreakers = [byCount[0], byCount[1]];
  } else if (shape[0] === 3 && shape[1] === 2) {
    category = CATEGORY.FULL_HOUSE;
    tiebreakers = [byCount[0], byCount[1]];
  } else if (isFlush) {
    category = CATEGORY.FLUSH;
    tiebreakers = ranks;
  } else if (isStraight) {
    category = CATEGORY.STRAIGHT;
    tiebreakers = [straightHigh];
  } else if (shape[0] === 3) {
    category = CATEGORY.TRIPS;
    tiebreakers = [byCount[0], ...byCount.slice(1)];
  } else if (shape[0] === 2 && shape[1] === 2) {
    category = CATEGORY.TWO_PAIR;
    // two pairs (high, low) then kicker
    tiebreakers = [byCount[0], byCount[1], byCount[2]];
  } else if (shape[0] === 2) {
    category = CATEGORY.PAIR;
    tiebreakers = [byCount[0], ...byCount.slice(1)];
  } else {
    category = CATEGORY.HIGH_CARD;
    tiebreakers = ranks;
  }

  return {
    category,
    tiebreakers,
    cards,
    name: CATEGORY_NAMES[category],
  };
}

function combinations5(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            result.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
  return result;
}

export function compareScores(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const x = a.tiebreakers[i] ?? 0;
    const y = b.tiebreakers[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// Best 5-card hand out of 5, 6, or 7 cards.
export function evaluateBest(cards: Card[]): HandScore {
  if (cards.length < 5) throw new Error("need at least 5 cards");
  if (cards.length === 5) return describe(evaluate5(cards));
  let best: HandScore | null = null;
  for (const combo of combinations5(cards)) {
    const score = evaluate5(combo);
    if (!best || compareScores(score, best) > 0) best = score;
  }
  return describe(best!);
}

// Add a human-friendly full name (e.g. "Full House, Kings over Tens").
function describe(score: HandScore): HandScore {
  const tb = score.tiebreakers;
  let name = score.name;
  switch (score.category) {
    case CATEGORY.STRAIGHT_FLUSH:
      name = tb[0] === 14 ? "Royal Flush" : `Straight Flush, ${rankLabel(tb[0])} high`;
      break;
    case CATEGORY.QUADS:
      name = `Four of a Kind, ${rankLabel(tb[0])}s`;
      break;
    case CATEGORY.FULL_HOUSE:
      name = `Full House, ${rankLabel(tb[0])}s over ${rankLabel(tb[1])}s`;
      break;
    case CATEGORY.FLUSH:
      name = `Flush, ${rankLabel(tb[0])} high`;
      break;
    case CATEGORY.STRAIGHT:
      name = `Straight, ${rankLabel(tb[0])} high`;
      break;
    case CATEGORY.TRIPS:
      name = `Three of a Kind, ${rankLabel(tb[0])}s`;
      break;
    case CATEGORY.TWO_PAIR:
      name = `Two Pair, ${rankLabel(tb[0])}s and ${rankLabel(tb[1])}s`;
      break;
    case CATEGORY.PAIR:
      name = `Pair of ${rankLabel(tb[0])}s`;
      break;
    case CATEGORY.HIGH_CARD:
      name = `${rankLabel(tb[0])} high`;
      break;
  }
  return { ...score, name };
}
