/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: "#161A1D",
          card: "#1E2228",
          surface: "#232830",
          text: "#EDEDED",
          muted: "#9CA3AF",
          border: "#2F343D",
          primary: "#A4161A",
          input: "#1E2228",
          hover: "#262C34",
          sidebar: "#1A1E24",
          header: "#1A1E24",
        },
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out",
        slideDown: "slideDown 0.2s ease-out",
        scaleIn: "scaleIn 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
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
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(164, 22, 26, 0.1)" },
          "50%": { boxShadow: "0 0 30px rgba(164, 22, 26, 0.3)" },
        },
      },
    },
  },
  plugins: [],
}
