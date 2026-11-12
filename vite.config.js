import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { execFile } from 'child_process'
import os from 'os'

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

function weasyprintDevPlugin() {
  return {
    name: 'scoutraider-weasyprint-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const isPdfRender = (
          req.url === '/api/render/html-to-pdf' ||
          req.url === '/render/html-to-pdf' ||
          req.url?.startsWith('/api/render/html-to-pdf') ||
          req.url?.startsWith('/render/html-to-pdf')
        ) && req.method === 'POST';

        if (!isPdfRender) {
          return next();
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const html = data.html || '';
            const title = data.title || 'carnet';

            const tmpDir = os.tmpdir();
            const id = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const tmpHtml = path.join(tmpDir, `sr_dev_${id}.html`);
            const tmpPdf = path.join(tmpDir, `sr_dev_${id}.pdf`);

            fs.writeFileSync(tmpHtml, html, 'utf-8');

            const candidates = [
              { cmd: 'weasyprint', args: [tmpHtml, tmpPdf] },
              { cmd: 'python', args: ['-m', 'weasyprint', tmpHtml, tmpPdf] },
              { cmd: path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'Scripts', 'weasyprint.exe'), args: [tmpHtml, tmpPdf] },
              { cmd: path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'), args: ['-m', 'weasyprint', tmpHtml, tmpPdf] },
              { cmd: 'python3', args: ['-m', 'weasyprint', tmpHtml, tmpPdf] }
            ];

            let success = false;
            let lastErr = null;

            for (const c of candidates) {
              try {
                await new Promise((resolve, reject) => {
                  execFile(c.cmd, c.args, { timeout: 120000, windowsHide: true }, (err) => {
                    if (err) return reject(err);
                    resolve();
                  });
                });
                if (fs.existsSync(tmpPdf)) {
                  success = true;
                  break;
                }
              } catch (e) {
                lastErr = e;
              }
            }

            if (success && fs.existsSync(tmpPdf)) {
              const pdfBytes = fs.readFileSync(tmpPdf);
              try { fs.unlinkSync(tmpHtml); fs.unlinkSync(tmpPdf); } catch {}
              res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
                'Content-Length': pdfBytes.length
              });
              res.end(pdfBytes);
              return;
            }

            try { if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml); } catch {}
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Compilation WeasyPrint échouée: ${lastErr ? lastErr.message : 'Exécutable introuvable'}`);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Erreur requête: ${err.message}`);
          }
        });
      });
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), logServerPlugin(), weasyprintDevPlugin()],
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
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/render': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/diffraction': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/modules': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    }
  }
})
