import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5110,
    proxy: {
      // Socket.io paths — NO rewrite (server expects /api/v1/... as engine.io path)
      '/api/v1/ai/chat/': {
        target: 'http://localhost:5100',
        ws: true,
      },
      '/api/v1/notifications/ws/': {
        target: 'http://localhost:5100',
        ws: true,
      },
      // Regular HTTP API (including non-WS notification routes) — rewrite /api/v1 prefix to /
      '/api/v1': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/v1/, ''),
      },
    },
  },
});
