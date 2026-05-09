/**
 * Logger — File logger for ScoutRaider.
 * - In dev (Vite):     sends logs to http://localhost:5174 (tiny Node server in vite.config.js)
 * - In Electron prod:  sends logs via IPC (window.electronAPI.writeLog)
 * - Always:            also prints to the browser console.
 *
 * Log file:   scoutraider.log  (project root in dev, userData in prod)
 * Format:     [ISO timestamp] [LEVEL] message
 */

declare global {
    interface Window {
        electronAPI: any;
    }
}

const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI?.writeLog;
const DEV_LOG_URL = 'http://localhost:5174';

function _send(level: string, msg: string) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] ${msg}`;

    if (IS_ELECTRON) {
        window.electronAPI.writeLog(level, msg);
    } else {
        // Fire-and-forget to the Vite log server
        fetch(DEV_LOG_URL, {
            method: 'POST',
            body: line,
        }).catch(() => { /* silent if server not running */ });
    }
    return line;
}

export class Logger {
    static info(msg: string) {
        console.log(_send('info', msg));
    }

    static warn(msg: string, err?: any) {
        const fullMsg = err ? `${msg} | ${String(err?.message ?? err)}` : msg;
        console.warn(_send('warn', fullMsg));
    }

    static error(msg: string, err?: any) {
        const fullMsg = err ? `${msg} | ${String(err?.message ?? err)}` : msg;
        console.error(_send('error', fullMsg));
    }
}

