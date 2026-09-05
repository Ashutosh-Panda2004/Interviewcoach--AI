import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
      server: {
        port: 1234,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [react()],
      build: {
        outDir: 'dist/client',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
});
