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
          bg: "#06080f",
          surface: "#0c1120",
          card: "#111827",
          border: "#1e293b",
          accent: "#00f0ff",
          green: "#00e676",
          red: "#ff1744",
          amber: "#ffab00",
          muted: "#64748b",
          "muted-soft": "#475569",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fadeIn 0.8s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "number-tick": "numberTick 0.4s cubic-bezier(0.16,1,0.3,1)",
        "shimmer": "shimmer 2s linear infinite",
        "border-glow": "borderGlow 3s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 240, 255, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 240, 255, 0.4)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        numberTick: {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        borderGlow: {
          "0%": { borderColor: "rgba(0,240,255,0.1)" },
          "100%": { borderColor: "rgba(0,240,255,0.3)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
export default config;
