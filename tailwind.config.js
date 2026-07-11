/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        risk: {
          green: "#10b981",
          yellow: "#f59e0b",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
