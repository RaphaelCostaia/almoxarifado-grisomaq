import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#22c55e",
          strong: "#16a34a",
          soft: "#22c55e18",
        },
        danger: {
          DEFAULT: "#ef4444",
          soft: "#ef444418",
        },
        warning: {
          DEFAULT: "#f59e0b",
          soft: "#f59e0b18",
        },
        info: {
          DEFAULT: "#3b82f6",
          soft: "#3b82f618",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        widest: "0.18em",
      },
      keyframes: {
        pulseUrgente: {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.55)",
          },
          "50%": {
            boxShadow: "0 0 0 10px rgba(239, 68, 68, 0)",
          },
        },
        liveDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        pulseUrgente: "pulseUrgente 1.4s ease-out 3",
        liveDot: "liveDot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
