/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { nuit: '#1B2437', chantier: '#F2B705' },
      fontFamily: { sans: ['Barlow', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
