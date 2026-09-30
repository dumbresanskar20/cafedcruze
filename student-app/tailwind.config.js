/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#ea580c',
          amber: '#f59e0b',
          warmBg: '#fffbf5',
          cream: '#fef3c7',
          terracotta: '#9a3412',
          dark: '#1c1917',
          green: '#15803d',
          surface: '#ffffff',
        },
      },
      fontFamily: {
        display: ['Outfit', 'Poppins', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        warm: '0 10px 30px -5px rgba(234, 88, 12, 0.15)',
        cardHover: '0 20px 35px -10px rgba(154, 52, 18, 0.2)',
      },
    },
  },
  plugins: [],
};
