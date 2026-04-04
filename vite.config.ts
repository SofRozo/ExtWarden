import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup:              resolve(__dirname, 'popup.html'),
        options:            resolve(__dirname, 'options.html'),
        'service-worker':   resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script':   resolve(__dirname, 'src/content/content-script.ts'),
      },
      output: {
        // Service worker and content script must NOT be hashed
        entryFileNames: chunk =>
          ['service-worker', 'content-script'].includes(chunk.name)
            ? '[name].js'
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
