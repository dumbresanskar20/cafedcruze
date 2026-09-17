import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to enforce exact Android APK MIME type and attachment headers
// preventing Android browsers from misinterpreting the binary stream as a .zip file
const apkHeadersPlugin = () => ({
  name: 'apk-headers-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = req.url ? req.url.split('?')[0] : '';
      if (pathname.endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="Cafe-D-Cruze-Restaurant.apk"');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = req.url ? req.url.split('?')[0] : '';
      if (pathname.endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment; filename="Cafe-D-Cruze-Restaurant.apk"');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), apkHeadersPlugin()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
    },
  },
  server: {
    port: 5189,
    host: true,
  },
});
