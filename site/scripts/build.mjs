#!/usr/bin/env node
// Build the site, then fail loudly on what SvelteKit lets through: a page that 500s during
// prerender still prints "done", and its .html is simply missing from build/.
import { spawn, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
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

const pages = ['/', '/catalog', '/install', '/compare', '/managed', '/buddy', '/terms', '/privacy', ...catalog.entries.map((e) => `/catalog/${e.id}`)];
const files = pages.flatMap((p) => [
  p === '/' ? 'index.html' : `${p.slice(1)}.html`,
  p === '/' ? 'es.html' : `es${p}.html`
]);
files.push('404.html', 'install.sh', 'sitemap.xml', 'robots.txt', 'og.png', 'og-es.png', 'favicon.svg');
for (const f of files) if (!fs.existsSync(path.join(root, 'build', f))) problems.push(`missing build/${f}`);

const installer = path.join(root, '..', 'install.sh');
const installerText = fs.readFileSync(installer, 'utf8');
if (installerText !== fs.readFileSync(path.join(root, 'build', 'install.sh'), 'utf8'))
  problems.push('build/install.sh differs from the repository install.sh');

// The panel release: rebuild it (reproducible, from the v<version> tag or HEAD), ship it under
// /releases/, and refuse to build if install.sh pins a different sha256 than what we ship.
const version = JSON.parse(fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8')).version;
const tarName = `operio-orca-${version}.tar.gz`;
try {
  execFileSync('bash', [path.join(root, '..', 'scripts', 'release.sh')], { stdio: 'inherit' });
} catch {
  problems.push('scripts/release.sh failed');
}
const tarball = path.join(root, '..', 'dist', tarName);
const pinnedVersion = (installerText.match(/^PANEL_VERSION="([^"]*)"/m) || [])[1];
const pinnedSha = (installerText.match(/^PANEL_SHA256="([^"]*)"/m) || [])[1];
if (pinnedVersion !== version) problems.push(`install.sh pins PANEL_VERSION=${pinnedVersion}, package.json is ${version}`);
if (fs.existsSync(tarball)) {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
  if (sha !== pinnedSha) problems.push(`install.sh pins PANEL_SHA256=${pinnedSha}, but dist/${tarName} is ${sha}`);
  const outDir = path.join(root, 'build', 'releases');
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(tarball, path.join(outDir, tarName));
  fs.copyFileSync(`${tarball}.sha256`, path.join(outDir, `${tarName}.sha256`));
  files.push(`releases/${tarName}`, `releases/${tarName}.sha256`);
} else {
  problems.push(`missing dist/${tarName}`);
}

if (problems.length) {
  console.error('\nBuild check FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`\nBuild check OK: ${pages.length * 2 + 1} pages (${pages.length} routes x EN/ES + 404), install.sh, sitemap, robots, OG image, releases/${tarName} (sha256 ${pinnedSha}).`);
