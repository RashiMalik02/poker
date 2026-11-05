"use client";

import { useMemo, useState } from "react";
import type { GameView } from "@/lib/poker/types";
import { MAX_SEATS } from "@/lib/poker/engine";
import { PlayingCard } from "./PlayingCard";
import { Seat } from "./Seat";
import { PotPile } from "./Chips";
import { ShowdownOverlay } from "./ShowdownOverlay";

// Positions (left%, top%) around an oval; index 0 is bottom-center.
function seatPositions(): { left: number; top: number }[] {
  const cx = 50;
  const cy = 47;
  const rx = 44;
  const ry = 40;
  const pts: { left: number; top: number }[] = [];
  for (let d = 0; d < MAX_SEATS; d++) {
    const theta = (Math.PI / 2) + (d * 2 * Math.PI) / MAX_SEATS;
    pts.push({
      left: cx + rx * Math.cos(theta),
      top: cy + ry * Math.sin(theta),
    });
  }
  return pts;
}

export function Table({
  state,
  myUserId,
  bankroll,
  onSit,
}: {
  state: GameView;
  myUserId: number;
  bankroll: number;
  onSit: (seat: number, buyIn: number) => void;
}) {
  const positions = useMemo(seatPositions, []);
  const [sitSeat, setSitSeat] = useState<number | null>(null);

  const bySeat = useMemo(() => {
    const arr: (GameView["players"][number] | null)[] = new Array(MAX_SEATS).fill(null);
    for (const p of state.players) arr[p.seat] = p;
    return arr;
  }, [state.players]);

  const mySeat = state.players.find((p) => p.userId === myUserId)?.seat ?? 0;
  const amSeated = state.players.some((p) => p.userId === myUserId);

  const showdownBySeat = useMemo(() => {
    const m = new Map<number, GameView["showdown"] extends (infer T)[] | null ? T : never>();
    if (state.showdown) for (const r of state.showdown) m.set(r.seat, r);
    return m;
  }, [state.showdown]);

  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-5xl">
      {/* Felt */}
      <div className="absolute inset-[6%] rounded-[50%] border-[10px] border-[#3a2416] bg-gradient-to-b from-felt-light via-felt to-felt-dark shadow-table">
        <div className="absolute inset-3 rounded-[50%] border border-white/10" />
        <div className="absolute inset-0 flex select-none items-center justify-center text-7xl font-black text-white/5">
          ♠
        </div>
      </div>

      <ShowdownOverlay state={state} />

      {/* Center: board + pot */}
      <div className="absolute left-1/2 top-[40%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
        {state.pot > 0 ? (
          <PotPile amount={state.pot} />
        ) : (
          <div className="text-xs font-semibold uppercase tracking-widest text-white/25">
            {state.handNumber === 0 ? "Waiting for players" : ""}
          </div>
        )}
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => {
            const card = state.board[i];
            // Stagger the flop reveal; turn and river land on their own.
            const delay = i < 3 ? i * 110 : 0;
            return card ? (
              <PlayingCard key={i} card={card} size="lg" deal delay={delay} />
            ) : (
              <div
                key={i}
                className="h-20 w-14 rounded-lg border border-white/10 bg-black/10"
              />
            );
          })}
        </div>
        {state.lastHandSummary && state.stage !== "showdown" && (
          <div className="max-w-md rounded-lg bg-black/60 px-3 py-1 text-center text-xs text-white/80">
            {state.lastHandSummary}
          </div>
        )}
      </div>

      {/* Seats */}
      {positions.map((pos, d) => {
        const seatIndex = (mySeat + d) % MAX_SEATS;
        const player = bySeat[seatIndex];
        return (
          <div
            key={seatIndex}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
          >
            <Seat
              player={player}
              isDealer={state.dealerSeat === seatIndex}
              isCurrent={state.currentToAct === seatIndex}
              isMe={player?.userId === myUserId}
              showdown={showdownBySeat.get(seatIndex) ?? undefined}
              turnEndsAt={state.currentToAct === seatIndex ? state.turnEndsAt : undefined}
              onSit={!amSeated && !player ? () => setSitSeat(seatIndex) : undefined}
            />
          </div>
        );
      })}

      {sitSeat !== null && (
        <BuyInDialog
          bankroll={bankroll}
          onCancel={() => setSitSeat(null)}
          onConfirm={(amount) => {
            onSit(sitSeat, amount);
            setSitSeat(null);
          }}
        />
      )}
    </div>
  );
}

function BuyInDialog({
  bankroll,
  onConfirm,
  onCancel,
}: {
  bankroll: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const MIN = 1000;
  // No table cap anymore — the buy-in is limited only by the player's bankroll.
  const [amount, setAmount] = useState(Math.min(bankroll, 2000));
  const valid = amount >= MIN && amount <= bankroll;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="panel w-80 space-y-4 p-6">
        <h3 className="text-lg font-semibold">Take a seat</h3>
        <p className="text-xs text-white/50">
          Your bankroll: <span className="font-bold text-gold">{bankroll.toLocaleString()}</span>
        </p>
        {bankroll < MIN ? (
          <p className="text-sm text-red-400">
            You need at least {MIN.toLocaleString()} chips to sit down.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Buy-in</span>
              <span className="font-bold text-gold">{amount.toLocaleString()}</span>
            </div>
            <input
              type="number"
              min={MIN}
              max={bankroll}
              step={100}
              value={amount}
              onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
              className="input py-1.5 text-sm"
            />
            <div className="flex items-center justify-between text-[11px] text-white/40">
              <span>Min {MIN.toLocaleString()}</span>
              <button
                type="button"
                className="text-gold hover:underline"
                onClick={() => setAmount(bankroll)}
              >
                All in ({bankroll.toLocaleString()})
              </button>
            </div>
            {!valid && (
              <p className="text-xs text-red-400">
                Enter between {MIN.toLocaleString()} and {bankroll.toLocaleString()} chips.
              </p>
            )}
          </>
        )}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-gold flex-1"
            disabled={bankroll < MIN || !valid}
            onClick={() => onConfirm(amount)}
          >
            Sit
          </button>
        </div>
      </div>
    </div>
  );
}
