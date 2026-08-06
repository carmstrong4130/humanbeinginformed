import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Be Informed palette (Apple-clean) */
        page: "#F5F5F7",
        ink: "#1D1D1F",
        inksec: "#6E6E73",
        hairline: "#D2D2D7",
        stategreen: "#2FB05C",
        stategray: "#E8E8ED",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
