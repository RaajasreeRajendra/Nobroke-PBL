/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          green: '#22c55e',
          lightGreen: '#f0fdf4',
          text: '#1f2937',
          muted: '#6b7280',
          bg: '#f8fafc',
          danger: '#ef4444',
          dangerLight: '#fef2f2',
          warning: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
