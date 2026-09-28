/**
 * Tiny local board for marketplace Call upon demos.
 * Serves GET/POST /api/hooks* with an in-memory KV.
 * Astro proxies here during `npm run dev`.
 */
import http from 'node:http';
import { handleHooksRequest } from '../cloudflare/hooks-board.js';

const PORT = Number(process.env.HOOKS_API_PORT || 8788);

function memoryKv(start = {}) {
  const store = { ...start };
  return {
    async get(key) {
      return store[key] ?? null;
    },
    async put(key, value) {
      store[key] = value;
    },
  };
}

const seed = {
  'hooks-v1': JSON.stringify({
    hooks: [
      {
        id: 'h-alex',
        name: 'Alex',
        place: 'Berlin',
        note: 'Spare 28mm tires. Looking for a calm ride.',
        email: 'alex@example.com',
        offers: [],
        at: '2026-09-27T16:40:34.302Z',
      },
      {
        id: 'h-hanna',
        name: 'Hanna',
        place: 'Berlin Kreuzberg',
        note: 'Sunday climb. Coffee after.',
        email: 'hanna@example.com',
        offers: [],
        at: '2026-09-27T16:41:10.000Z',
      },
    ],
    calls: [],
  }),
};

const env = { STATS: memoryKv(seed) };

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || `127.0.0.1:${PORT}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(url, {
      method: req.method || 'GET',
      headers: req.headers,
      body: body.length && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
    });
    const response = (await handleHooksRequest(request, env)) || new Response('Not found', { status: 404 });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`local hooks api on http://127.0.0.1:${PORT}`);
});
