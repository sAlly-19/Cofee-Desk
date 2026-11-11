import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  root: 'src/renderer',
  publicDir: path.resolve(__dirname, 'assets'),
  build: {
    outDir: path.resolve(__dirname, 'dist-electron/renderer'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname)],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
      '@assets': path.resolve(__dirname, './assets'),
    },
  },
});
