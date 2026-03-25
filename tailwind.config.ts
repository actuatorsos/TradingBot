import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        apex: {
          bg: "#0a0e17",
          surface: "#111827",
          card: "#1a2236",
          border: "#1e293b",
          accent: "#00f0ff",
          green: "#00e676",
          red: "#ff1744",
          amber: "#ffab00",
          muted: "#64748b",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.5s ease-out",
        "fade-in": "fadeIn 0.6s ease-out",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 240, 255, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 240, 255, 0.4)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
