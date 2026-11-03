"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { GameView, PlayerAction } from "@/lib/poker/types";
import { getToken } from "./auth";

export interface GameApi {
  state: GameView | null;
  connected: boolean;
  error: string | null;
  sit: (seat: number, buyIn: number) => void;
  stand: () => void;
  rebuy: (amount: number) => void;
  act: (action: PlayerAction) => void;
  chat: (text: string) => void;
  clearError: () => void;
}

export function useGame(code: string): GameApi {
  const [state, setState] = useState<GameView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError("not-authenticated");
      return;
    }
    // In a split deploy the backend lives on another origin (e.g. Render).
    // When NEXT_PUBLIC_BACKEND_URL is unset we connect same-origin.
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const socket = backend
      ? io(backend, { auth: { token, code }, transports: ["websocket", "polling"] })
      : io({ auth: { token, code }, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => setError(err.message));
    socket.on("state", (view: GameView) => setState(view));
    socket.on("errorMessage", (msg: string) => {
      setError(msg);
      window.clearTimeout((socket as unknown as { _errT?: number })._errT);
      (socket as unknown as { _errT?: number })._errT = window.setTimeout(
        () => setError(null),
        3500
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  const sit = useCallback((seat: number, buyIn: number) => {
    socketRef.current?.emit("sit", { seat, buyIn });
  }, []);
  const stand = useCallback(() => socketRef.current?.emit("stand", {}), []);
  const rebuy = useCallback((amount: number) => socketRef.current?.emit("rebuy", { amount }), []);
  const act = useCallback((action: PlayerAction) => socketRef.current?.emit("action", action), []);
  const chat = useCallback((text: string) => socketRef.current?.emit("chat", { text }), []);
  const clearError = useCallback(() => setError(null), []);

  return { state, connected, error, sit, stand, rebuy, act, chat, clearError };
}
