import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(await readFile(join(root, 'site.config.json'), 'utf8'));
const prefix = new URL(config.baseUrl).pathname;
const directory = join(root, 'docs');
const position = process.argv.indexOf('--port');
const port = position >= 0 ? Number(process.argv[position + 1]) : 19086;
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port.');
const mime = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json; charset=utf-8', xml: 'application/xml; charset=utf-8', txt: 'text/plain; charset=utf-8' };
createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    if (pathname === '/') { response.writeHead(302, { Location: prefix }).end(); return; }
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const path = resolve(directory, pathname.slice(prefix.length) + (pathname.endsWith('/') ? 'index.html' : ''));
    if (relative(directory, path).startsWith('..') || !(await stat(path)).isFile()) { response.writeHead(404).end(); return; }
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[path.split('.').at(-1)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}${prefix}`));
