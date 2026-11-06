import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

const LOG_PATH = path.resolve(__dirname, 'scoutraider.log');

function logServerPlugin() {
  return {
    name: 'scoutraider-log-server',
    configureServer() {
      try {
        fs.writeFileSync(LOG_PATH, `--- ScoutRaider Log Started: ${new Date().toISOString()} ---\n`, 'utf-8');
      } catch (e) {
        console.warn('Could not write initial log file', e);
      }

      // Tiny HTTP server on port 5174 to receive log messages from the renderer
      const server = createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              fs.appendFileSync(LOG_PATH, body + '\n', 'utf-8');
            } catch (err) {}
            res.writeHead(200);
            res.end();
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      server.listen(5174, () => {
        console.log(`[ScoutRaider] Log server running → ${LOG_PATH}`);
      });
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), logServerPlugin()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})
