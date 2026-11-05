"use client";

import { useEffect, useState } from "react";
import type { GameView, PlayerAction } from "@/lib/poker/types";

export function Controls({
  state,
  onAct,
}: {
  state: GameView;
  onAct: (a: PlayerAction) => void;
}) {
  const info = state.toActInfo;
  const [raiseTo, setRaiseTo] = useState(info?.minRaiseTo ?? 0);

  useEffect(() => {
    if (info) setRaiseTo(info.minRaiseTo);
  }, [info?.minRaiseTo, info?.seat, state.handNumber, state.stage]);

  if (state.paused) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-amber-200/80">
        Game is paused.
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-white/40">
        {state.currentToAct === -1
          ? "Waiting for the next hand…"
          : "Waiting for your turn…"}
      </div>
    );
  }

  const { callAmount, canCheck, minRaiseTo, maxRaiseTo } = info;
  const canRaise = info.canRaise && maxRaiseTo >= minRaiseTo;
  const pot = state.pot;
  const isAllInRaise = raiseTo >= maxRaiseTo;

  const quick = (fraction: number) => {
    const target = Math.round((state.currentBet + pot * fraction) / state.bigBlind) * state.bigBlind;
    setRaiseTo(Math.max(minRaiseTo, Math.min(maxRaiseTo, target)));
  };

  return (
    <div className="space-y-3">
      {canRaise && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Raise to</span>
            <span className="font-bold text-gold">
              {raiseTo.toLocaleString()} {isAllInRaise && "(all-in)"}
            </span>
          </div>
          <input
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            step={state.bigBlind}
            value={raiseTo}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-gold"
          />
          <div className="flex gap-2 text-xs">
            <button className="btn-ghost flex-1 py-1" onClick={() => quick(0.5)}>
              ½ Pot
            </button>
            <button className="btn-ghost flex-1 py-1" onClick={() => quick(0.75)}>
              ¾ Pot
            </button>
            <button className="btn-ghost flex-1 py-1" onClick={() => quick(1)}>
              Pot
            </button>
            <button className="btn-ghost flex-1 py-1" onClick={() => setRaiseTo(maxRaiseTo)}>
              Max
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-danger flex-1" onClick={() => onAct({ type: "fold" })}>
          Fold
        </button>
        {canCheck ? (
          <button className="btn-call flex-1" onClick={() => onAct({ type: "check" })}>
            Check
          </button>
        ) : (
          <button className="btn-call flex-1" onClick={() => onAct({ type: "call" })}>
            Call {callAmount.toLocaleString()}
          </button>
        )}
        {canRaise && (
          <button
            className="btn-gold flex-1"
            onClick={() =>
              onAct(
                isAllInRaise
                  ? { type: "allin" }
                  : { type: state.currentBet === 0 ? "bet" : "raise", amount: raiseTo }
              )
            }
          >
            {state.currentBet === 0 ? "Bet" : "Raise to"} {raiseTo.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}
