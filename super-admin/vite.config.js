import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
    },
  },
  server: {
    port: 5175,
    host: true,
    proxy: {
      '/api': {
        target: 'https://cafe-d-cruze-api.mealbook.in',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
