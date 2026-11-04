"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/poker/types";

export function SidePanel({
  code,
  messages,
  onChat,
}: {
  code: string;
  messages: ChatMessage[];
  onChat: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Only auto-scroll the chat container itself (never the window), and only
    // when the user is already near the bottom so reading history isn't interrupted.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onChat(text);
    setText("");
  }

  function copyInvite() {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 p-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">Table</div>
          <div className="font-mono text-lg font-bold tracking-widest text-gold">{code}</div>
        </div>
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={copyInvite}>
          {copied ? "Copied!" : "Invite link"}
        </button>
      </div>

      <div ref={listRef} className="scroll-thin flex-1 space-y-1.5 overflow-y-auto p-3 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-white/30">Game log and chat will appear here.</p>
        )}
        {messages.map((m) =>
          m.system ? (
            <p key={m.id} className="text-xs italic text-white/40">
              {m.text}
            </p>
          ) : (
            <p key={m.id} className="break-words">
              <span className="font-semibold text-gold">{m.name}:</span>{" "}
              <span className="text-white/90">{m.text}</span>
            </p>
          )
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3">
        <input
          className="input py-1.5 text-sm"
          placeholder="Say something…"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-ghost shrink-0 px-3 py-1.5 text-sm">Send</button>
      </form>
    </div>
  );
}
