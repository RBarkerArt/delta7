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
        // Delta7 OS shell palette (src/os). Legacy tokens above are untouched.
        os: {
          cream: '#F3EDE4',
          'cream-dim': '#E6DDD1',
          ink: '#3A3034',
          'ink-soft': '#7A6E6F',
          line: 'rgba(58, 48, 52, 0.12)',
          rose: '#9B5E5E',
          slate: '#5B5A60',
          olive: '#84806C',
          amber: '#B07F4A',
          mauve: '#8A5F66',
          teal: '#5F7C7A',
          taupe: '#B79F8E',
          plum: '#4A3A44',
          pink: '#B08378',
          clay: '#7E615C',
          dusk: '#6E6168',
        },
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
        'os-sans': ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        'os-mono': ['ui-monospace', '"SF Mono"', '"Cascadia Mono"', '"Segoe UI Mono"', '"Roboto Mono"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
