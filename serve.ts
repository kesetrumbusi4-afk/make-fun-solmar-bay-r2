// Tiny static server for local play-testing only (not part of the entry).
// Serves game/ from the repository root: node serve.ts, then open
// http://localhost:8081/ — the game itself is plain static files.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const PORT = Number(process.env.PORT ?? 8081);
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? '/game/index.html' : decodeURIComponent(req.url.split('?')[0]);
    const file = join(process.cwd(), path);
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Solmar Bay test server: http://localhost:${PORT}/`);
});
