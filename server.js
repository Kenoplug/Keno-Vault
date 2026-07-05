// Keno Vault — Zero-dependency local dev server
// Usage: node server.js
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT   = 3000;
const ROOT   = __dirname;
const TYPES  = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

http.createServer((req, res) => {
  let url = req.url.split('?')[0].split('#')[0]; // strip query + hash
  if (url === '/') url = '/index.html';

  const filePath = path.join(ROOT, url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 — Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('');
  console.log('  ⬡  Keno Vault — Local Dev Server');
  console.log('  ════════════════════════════════════');
  console.log('');
  console.log('  →  http://localhost:' + PORT);
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('');
}).on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('  Port ' + PORT + ' is busy. Trying ' + (PORT + 1) + '...');
    // Try next port — for simplicity just tell the user
    console.log('  Run: node server.js --port ' + (PORT + 1));
  } else {
    console.error(e);
  }
});
