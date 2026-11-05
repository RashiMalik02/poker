import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { verifyToken } from "./src/server/auth";
import { getUser } from "./src/server/db";
import { GameManager } from "./src/server/gameManager";
import type { PlayerAction } from "./src/lib/poker/types";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

function normalizeCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(c)) return null;
  return c;
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, {
    cors: { origin: true },
    transports: ["websocket", "polling"],
  });
  const manager = new GameManager(io);

  // Authenticate every socket from its handshake token.
  io.use((socket, nextFn) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const code = normalizeCode(socket.handshake.auth?.code);
    const userId = verifyToken(token);
    if (!userId) return nextFn(new Error("unauthorized"));
    if (!code) return nextFn(new Error("bad room code"));
    const user = getUser(userId);
    if (!user) return nextFn(new Error("unknown user"));
    socket.data.userId = userId;
    socket.data.username = user.username;
    socket.data.code = code;
    nextFn();
  });

  io.on("connection", (socket) => {
    const code = socket.data.code as string;
    socket.join(code);
    manager.onJoin(socket);

    const reply = (cb: unknown, err: string | null) => {
      if (typeof cb === "function") cb(err ? { error: err } : { ok: true });
      if (err) socket.emit("errorMessage", err);
    };

    socket.on("sit", ({ seat, buyIn }: { seat: number; buyIn: number }, cb) => {
      reply(cb, manager.sit(socket, Number(seat), Math.floor(Number(buyIn) || 0)));
    });

    socket.on("stand", (_payload, cb) => {
      reply(cb, manager.stand(socket));
    });

    socket.on("rebuy", ({ amount }: { amount: number }, cb) => {
      reply(cb, manager.rebuy(socket, Math.floor(Number(amount) || 0)));
    });

    socket.on("action", (action: PlayerAction, cb) => {
      if (!action || typeof action.type !== "string") return reply(cb, "Bad action");
      reply(cb, manager.act(socket, action));
    });

    socket.on("pause", ({ paused }: { paused: boolean }, cb) => {
      reply(cb, manager.setPause(socket, !!paused));
    });

    socket.on("reveal", (_payload, cb) => {
      reply(cb, manager.reveal(socket));
    });

    socket.on("chat", ({ text }: { text: string }) => {
      if (typeof text === "string") manager.chat(socket, text);
    });

    socket.on("disconnect", () => {
      manager.onDisconnect(socket);
    });
  });

  server.listen(port, () => {
    console.log(`♠ Poker running at http://localhost:${port}`);
  });
});
