// Vice Harbor — screenshot capturer.
// Serves game/ on localhost, opens each shot from shots.json in desktop
// Chrome (headless, 1280x720), waits for window.__shotReady, and saves a
// real render of the running game as screenshots/<name>.jpg (quality 80,
// under the 256 KiB cap). Run: node tools/shots.mjs
// Requires playwright-core (npm i playwright-core in tools/) and a Chromium
// build in ~/.cache/ms-playwright.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
const shots = JSON.parse(await readFile(join(root, 'shots.json'), 'utf8'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(gameDir, path === '/' ? 'index.html' : path);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`serving game/ on http://127.0.0.1:${port}`);

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--no-sandbox'],
});
let failed = 0;
for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html${shot.query}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  } catch {
    console.log(`FAIL ${shot.name}: __shotReady never set`);
    failed += 1;
    await page.close();
    continue;
  }
  const out = join(shotsDir, shot.name);
  await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
  const size = (await import('node:fs')).statSync(out).size;
  console.log(`${errors.length ? 'WARN' : 'OK  '} ${shot.name} (${Math.round(size / 1024)} KiB)${errors.length ? ` — page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  if (size > 262144) { console.log(`FAIL ${shot.name}: over the 256 KiB screenshot cap`); failed += 1; }
  if (errors.length) failed += 1;
  await page.close();
}
await browser.close();
server.close();
process.exit(failed > 0 ? 1 : 0);
