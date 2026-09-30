/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#f8fafc',
          card: '#ffffff',
          primary: '#15803d', // Clean canteen green for primary actions
          primaryHover: '#166534',
          dark: '#0f172a',
          sidebar: '#1e293b',
        },
        brand: {
          orange: '#ea580c',
          terracotta: '#c2410c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
