/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '10': 'repeat(10, minmax(0, 1fr))',
        '12': 'repeat(12, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))',
        '18': 'repeat(18, minmax(0, 1fr))',
        '20': 'repeat(20, minmax(0, 1fr))',
        '24': 'repeat(24, minmax(0, 1fr))',
        '32': 'repeat(32, minmax(0, 1fr))',
      }
    },
  },
  plugins: [],
}
