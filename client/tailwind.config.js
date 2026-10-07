/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f6ff",
          100: "#dce9ff",
          200: "#b9d3ff",
          300: "#8ab4ff",
          400: "#5b8fff",
          500: "#3366ff",
          600: "#234ee0",
          700: "#1a3bb3",
          800: "#162f8a",
          900: "#142a6e",
        },
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f6f8fc",
          border: "#e4e9f2",
        },
        state: {
          free: "#16a34a",
          freeBg: "#dcfce7",
          busy: "#3366ff",
          busyBg: "#e0e9ff",
          off: "#94a3b8",
          offBg: "#f1f5f9",
          urgent: "#f97316",
          urgentBg: "#ffedd5",
          conflict: "#dc2626",
          conflictBg: "#fee2e2",
          leave: "#a855f7",
          leaveBg: "#f3e8ff",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)",
      },
    },
  },
  plugins: [],
};
