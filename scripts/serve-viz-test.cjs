/* Local-only browser fixture. Never included in the published extension. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/' ? path.join(root, 'tests/viz-host.html') :
    pathname === '/viz.js' ? path.join(root, 'docs/viz.js') : undefined;
  if (!file || !fs.existsSync(file)) { response.writeHead(404); response.end('Build the extension first.'); return; }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
  fs.createReadStream(file).pipe(response);
}).listen(8081, '127.0.0.1', () => console.log('Viz API fixture: http://127.0.0.1:8081'));
