/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sa: {
          bg: '#090d16',
          card: '#0f172a',
          cardHover: '#1e293b',
          border: '#1e293b',
          borderLight: '#334155',
          primary: '#6366f1', // Indigo primary
          primaryHover: '#4f46e5',
          accent: '#10b981', // Emerald accent
          warning: '#f59e0b', // Amber warning
          danger: '#ef4444', // Red danger
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
