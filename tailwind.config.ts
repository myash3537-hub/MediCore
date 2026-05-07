import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          975: "#08121f"
        },
        brand: {
          50: "#effaf4",
          100: "#d7f4e3",
          200: "#b4e8cb",
          300: "#84d7a9",
          400: "#49c280",
          500: "#20a663",
          600: "#16834f",
          700: "#156943",
          800: "#145338",
          900: "#11452f"
        },
        accent: {
          50: "#f4fbfb",
          100: "#d7f5f4",
          200: "#afeae8",
          300: "#73d8d7",
          400: "#43bebe",
          500: "#269ea2",
          600: "#1f8084",
          700: "#1f666a",
          800: "#204f54",
          900: "#1d4348"
        },
        warning: "#f59e0b",
        danger: "#dc2626"
      },
      fontFamily: {
        sans: [
          "var(--font-manrope)",
          "sans-serif"
        ],
        display: [
          "var(--font-ibm-plex-sans)",
          "sans-serif"
        ]
      },
      boxShadow: {
        soft: "0 18px 45px rgba(8, 18, 31, 0.08)",
        panel: "0 12px 28px rgba(8, 18, 31, 0.12)"
      },
      backgroundImage: {
        "hero-grid": "linear-gradient(rgba(18, 38, 61, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(18, 38, 61, 0.06) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;

