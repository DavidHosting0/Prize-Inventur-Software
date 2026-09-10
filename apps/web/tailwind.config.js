/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        sidebar: "var(--sidebar)",
        card: "var(--card)",
        border: "var(--border)",
        primary: "var(--primary)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      screens: {
        mobile: { max: "767px" },
        tablet: { min: "768px", max: "1279px" },
        desktop: { min: "1280px" },
      },
    },
  },
  plugins: [],
};
