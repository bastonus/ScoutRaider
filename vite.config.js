import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { createServer } from 'http'

const LOG_PATH = path.resolve('./scoutraider.log');

// Clear log on startup
fs.writeFileSync(LOG_PATH, `--- ScoutRaider Log Started: ${new Date().toISOString()} ---\n`, 'utf-8');

function logServerPlugin() {
  return {
    name: 'scoutraider-log-server',
    configureServer() {
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
            fs.appendFileSync(LOG_PATH, body + '\n', 'utf-8');
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
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  }
})
