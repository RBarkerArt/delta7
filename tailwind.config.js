/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lab-black': '#050505',
        'lab-gray': '#1a1a1a',
        'signal-green': 'rgb(var(--signal-color) / <alpha-value>)', // Dynamic Theme Color
        'signal-amber': '#ffb000',
        'decay-red': '#ff3333',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
