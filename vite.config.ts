import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;

function getPackageChunk(id: string) {
  if (!id.includes('node_modules')) {
    return undefined;
  }

  if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
    return 'react-vendor';
  }

  if (id.includes('/@codemirror/') || id.includes('/@lezer/')) {
    return 'codemirror';
  }

  if (id.includes('/@tauri-apps/')) {
    return 'tauri';
  }

  if (id.includes('/lucide-react/')) {
    return 'icons';
  }

  return 'vendor';
}

export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        floating: './floating.html',
      },
      output: {
        manualChunks: getPackageChunk,
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'floating' ? 'assets/floating-[hash].js' : 'assets/main-[hash].js',
      },
    },
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tauri-apps/api/core', '@tauri-apps/api/event'],
  },
}));