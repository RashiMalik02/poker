import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
      },
      colors: {
        felt: {
          DEFAULT: "#0b6b3a",
          dark: "#064d29",
          light: "#1a8f54",
        },
        gold: {
          DEFAULT: "#e8c15a",
          dark: "#b8922f",
        },
      },
      boxShadow: {
        table: "inset 0 0 120px rgba(0,0,0,0.55), 0 30px 60px rgba(0,0,0,0.5)",
        chip: "0 2px 6px rgba(0,0,0,0.4)",
      },
      keyframes: {
        dealIn: {
          "0%": { opacity: "0", transform: "translateY(-40px) scale(0.8)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        flipIn: {
          "0%": { opacity: "0", transform: "perspective(600px) rotateY(85deg) translateY(-18px) scale(0.9)" },
          "60%": { opacity: "1" },
          "100%": { opacity: "1", transform: "perspective(600px) rotateY(0deg) translateY(0) scale(1)" },
        },
        winGlow: {
          "0%,100%": { boxShadow: "0 0 0 rgba(232,193,90,0)" },
          "50%": { boxShadow: "0 0 18px rgba(232,193,90,0.9)" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(232,193,90,0.7)" },
          "70%": { boxShadow: "0 0 0 12px rgba(232,193,90,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(232,193,90,0)" },
        },
        chipToPot: {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-30px)" },
        },
      },
      animation: {
        dealIn: "dealIn 0.35s ease-out both",
        flipIn: "flipIn 0.45s cubic-bezier(0.2,0.8,0.2,1) both",
        pulseRing: "pulseRing 1.6s infinite",
        chipToPot: "chipToPot 0.6s ease-out forwards",
        winGlow: "winGlow 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
