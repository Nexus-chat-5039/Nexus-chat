/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: "rgb(var(--nexus-bg) / <alpha-value>)",
          card: "rgb(var(--nexus-card) / <alpha-value>)",
          surface: "rgb(var(--nexus-surface) / <alpha-value>)",
          text: "rgb(var(--nexus-text) / <alpha-value>)",
          muted: "rgb(var(--nexus-muted) / <alpha-value>)",
          border: "rgb(var(--nexus-border) / <alpha-value>)",
          primary: "rgb(var(--nexus-primary) / <alpha-value>)",
          "primary-light": "rgb(var(--nexus-primary-light) / <alpha-value>)",
          input: "rgb(var(--nexus-input) / <alpha-value>)",
          hover: "rgb(var(--nexus-hover) / <alpha-value>)",
          sidebar: "rgb(var(--nexus-sidebar) / <alpha-value>)",
          header: "rgb(var(--nexus-header) / <alpha-value>)",
        },
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out forwards",
        slideDown: "slideDown 0.2s ease-out forwards",
        scaleIn: "scaleIn 0.2s ease-out forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        bounce: "bounce 0.6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(164, 22, 26, 0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(164, 22, 26, 0.25)" },
        },
        bounce: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      borderWidth: {
        3: "3px",
      },
    },
  },
  plugins: [],
}
