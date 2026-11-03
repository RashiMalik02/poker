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
        pulseRing: "pulseRing 1.6s infinite",
        chipToPot: "chipToPot 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
