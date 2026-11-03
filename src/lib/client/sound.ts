"use client";

// Lightweight synthesized sound effects — no audio files needed. Everything is
// generated with the Web Audio API so the whole thing stays self-contained.

let ctx: AudioContext | null = null;
let muted = false;

export function initSound() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  muted = localStorage.getItem("poker_muted") === "1";
}

export function isMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("poker_muted") === "1";
}

export function setMuted(value: boolean) {
  muted = value;
  localStorage.setItem("poker_muted", value ? "1" : "0");
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  slideTo?: number
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.02);
}

// Short filtered-noise burst — used for chip/card textures.
function noise(start: number, dur: number, gain: number, hp = 2000) {
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(ctx.currentTime + start);
}

function guard(): boolean {
  if (typeof window === "undefined") return false;
  if (muted || localStorage.getItem("poker_muted") === "1") return false;
  if (!ctx) initSound();
  return !!ctx;
}

export const Sounds = {
  deal() {
    if (!guard()) return;
    noise(0, 0.08, 0.25, 2500);
  },
  flip() {
    if (!guard()) return;
    noise(0, 0.06, 0.2, 3000);
    tone(500, 0, 0.05, "triangle", 0.05);
  },
  check() {
    if (!guard()) return;
    tone(180, 0, 0.09, "sine", 0.18);
    tone(120, 0.02, 0.1, "sine", 0.12);
  },
  chips() {
    if (!guard()) return;
    noise(0, 0.05, 0.28, 4000);
    noise(0.05, 0.05, 0.22, 5000);
    noise(0.1, 0.04, 0.16, 6000);
  },
  call() {
    if (!guard()) return;
    noise(0, 0.05, 0.22, 4000);
    noise(0.06, 0.04, 0.16, 5000);
  },
  fold() {
    if (!guard()) return;
    noise(0, 0.14, 0.18, 1200);
  },
  turn() {
    if (!guard()) return;
    tone(660, 0, 0.12, "sine", 0.16);
    tone(880, 0.1, 0.14, "sine", 0.16);
  },
  allin() {
    if (!guard()) return;
    tone(300, 0, 0.5, "sawtooth", 0.14, 900);
    noise(0, 0.25, 0.2, 3000);
  },
  win() {
    if (!guard()) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, i * 0.09, 0.22, "triangle", 0.18));
  },
  lose() {
    if (!guard()) return;
    tone(300, 0, 0.3, "sine", 0.12, 160);
  },
};
