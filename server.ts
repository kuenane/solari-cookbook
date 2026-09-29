/**
 * Phase 1 fix: this file used to be a second, independent backend - its
 * own hardcoded ledger, its own scoring heuristic, its own Gemini call,
 * disconnected from pipeline.py/LangGraph/NVIDIA NIM entirely (and it was
 * the one the frontend actually talked to). All of that is now deleted.
 *
 * This file's only remaining job: serve the Vite dev middleware (or the
 * built static assets in production) and reverse-proxy `/api/*` to the
 * single FastAPI backend in server.py. There is exactly one backend now.
 */
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const API_TARGET = process.env.SOLARI_API_TARGET || 'http://localhost:8000';

async function proxyToApi(req: express.Request, res: express.Response) {
  try {
    const url = `${API_TARGET}${req.originalUrl}`;
    const init: RequestInit = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = JSON.stringify(req.body ?? {});
    }
    const upstream = await fetch(url, init);

    // SSE endpoints must be streamed through, not buffered.
    if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const reader = upstream.body?.getReader();
      if (!reader) return res.end();
      const decoder = new TextDecoder();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value));
      }
      return res.end();
    }

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err: any) {
    res.status(502).json({ error: `Backend unreachable at ${API_TARGET}: ${err.message}` });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.all('/api/*', proxyToApi);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Solari] Frontend on http://0.0.0.0:${PORT}, proxying /api to ${API_TARGET}`);
  });
}

startServer();
