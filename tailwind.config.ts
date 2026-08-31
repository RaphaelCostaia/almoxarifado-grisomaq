import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta GRISOMAQ (verde/creme observada nas telas atuais)
        creme: {
          50: "#f7f5ee",
          100: "#eee9d6",
          200: "#e2dcc4",
          300: "#cec7ab",
        },
        oliva: {
          50: "#f2f4ec",
          100: "#e1e6d2",
          500: "#6b8a3a",
          600: "#54742c",
          700: "#42591f",
          800: "#334519",
          900: "#243213",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
      },
      animation: {
        pulseUrgente: "pulseUrgente 1.4s ease-out 3",
      },
    },
  },
  plugins: [],
} satisfies Config;
