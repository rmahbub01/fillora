import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'cloudflare-max-asset-guard',
      closeBundle() {
        // Cloudflare Workers/Pages has a hard 25 MiB limit per static asset.
        // Heavy ONNX models and WASM binaries are served via Cloudflare Workers & CDN.
        const distDir = path.resolve(__dirname, 'dist');
        const MAX_BYTES = 24 * 1024 * 1024; // 24 MiB safety threshold

        function sweep(dir: string) {
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              sweep(fullPath);
              if (fs.readdirSync(fullPath).length === 0) {
                fs.rmdirSync(fullPath);
              }
            } else if (entry.isFile()) {
              const stat = fs.statSync(fullPath);
              if (stat.size > MAX_BYTES) {
                console.log(`[Cloudflare Guard] Removing oversized asset from dist: ${path.relative(distDir, fullPath)} (${(stat.size / (1024 * 1024)).toFixed(1)} MB)`);
                fs.unlinkSync(fullPath);
              }
            }
          }
        }

        sweep(distDir);
      }
    }
  ],
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    }
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-icons';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  worker: {
    format: 'es'
  }
});
