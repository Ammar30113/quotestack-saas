/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dceafd",
          200: "#bcd4f7",
          300: "#8ab5ef",
          400: "#5f98e7",
          500: "#2f78de",
          600: "#1d5ec4",
          700: "#15499a",
          800: "#123d7e",
          900: "#102f60"
        }
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};
