#!/usr/bin/env node
// Build the site, then fail loudly on what SvelteKit lets through: a page that 500s during
// prerender still prints "done", and its .html is simply missing from build/.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, '..', 'catalog', 'catalog.json'), 'utf8'));

const log = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '0' }
  });
  let out = '';
  for (const s of [child.stdout, child.stderr]) s.on('data', (d) => { out += d; process.stdout.write(d); });
  child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`vite build exited ${code}`))));
});

const problems = [];
if (/\[500\]|\b500 GET\b/.test(log)) problems.push('the build log reports a 500 during prerender');

const pages = ['/', '/catalog', '/install', ...catalog.entries.map((e) => `/catalog/${e.id}`)];
const files = pages.flatMap((p) => [
  p === '/' ? 'index.html' : `${p.slice(1)}.html`,
  p === '/' ? 'es.html' : `es${p}.html`
]);
files.push('404.html', 'install.sh', 'sitemap.xml', 'robots.txt', 'og.png', 'favicon.svg');
for (const f of files) if (!fs.existsSync(path.join(root, 'build', f))) problems.push(`missing build/${f}`);

const installer = path.join(root, '..', 'install.sh');
if (fs.readFileSync(installer, 'utf8') !== fs.readFileSync(path.join(root, 'build', 'install.sh'), 'utf8'))
  problems.push('build/install.sh differs from the repository install.sh');

if (problems.length) {
  console.error('\nBuild check FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`\nBuild check OK: ${files.length - 6} pages (${pages.length} routes x EN/ES), install.sh, sitemap, robots, OG image.`);
