'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { main, buildPublishBody, loadSettings, saveSettings, slugify, ssoSecret, CliError } = require('../lib/artifacts-cli');

const TOKEN = 'x'.repeat(32);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'orca-art-'));

// A fake ORCA Artifacts app: records bodies, answers like /api/publish does.
function fakeApp(t, { sso = false } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const ok = req.headers.authorization === `Bearer ${TOKEN}`;
      res.setHeader('content-type', 'application/json');
      if (!ok) { res.statusCode = 401; return res.end('{}'); }
      if (req.method === 'GET') return res.end(JSON.stringify({ ok: true, publish: true, sso }));
      const b = JSON.parse(body);
      seen.push(b);
      if (b.kind === 'dashboard' && b.spec.slug === 'bad') { res.statusCode = 422; return res.end('{"ok":false,"problems":["slug is reserved"]}'); }
      const key = b.kind === 'page' ? b.slug : b.spec?.slug;
      res.end(JSON.stringify({ ok: true, status: b.kind === 'data' ? 'live' : 'draft', url: b.kind === 'page' ? `/${key}/` : `/d/${key}` }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    t.after(() => server.close());
    resolve({ url: `http://127.0.0.1:${server.address().port}`, seen });
  }));
}

test('setup saves the address with mode 600 and checks the token', async (t) => {
  const app = await fakeApp(t);
  const dir = tmp();
  const out = [];
  await main(['setup', dir, app.url + '/some/path', TOKEN], {}, (s) => out.push(s));
  const file = path.join(dir, 'artifacts.json');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(loadSettings(dir, {}), { url: app.url + '/some/path', token: TOKEN, sso: false });
  assert.match(out[0], /token OK/);
  await assert.rejects(main(['setup', dir, app.url, 'y'.repeat(32)], {}, () => {}), /refused/);
  assert.equal(loadSettings(dir, {}).token, TOKEN, 'a refused setup keeps the working one');
});

test('setup refuses plain http to other machines and short tokens', () => {
  const dir = tmp();
  assert.throws(() => saveSettings(dir, 'http://example.com', TOKEN), /https/);
  assert.throws(() => saveSettings(dir, 'https://example.com', 'short'), /24/);
  assert.throws(() => saveSettings(dir, 'not a url', TOKEN), /not a URL/);
});

test('env wins over the saved settings', () => {
  const dir = tmp();
  saveSettings(dir, 'https://a.example', TOKEN);
  assert.deepEqual(loadSettings(dir, { ARTIFACTS_URL: 'https://b.example', ARTIFACTS_TOKEN: 't' }), { url: 'https://b.example', token: 't', sso: false });
});

test('publish a page folder: files, slug from the folder name, binary as base64', () => {
  const dir = path.join(tmp(), 'Weekly Report');
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>hi</h1>');
  fs.writeFileSync(path.join(dir, 'data.json'), '{"items":[]}');
  fs.writeFileSync(path.join(dir, 'img', 'a.png'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(dir, '.secret'), 'nope');
  const b = buildPublishBody(dir, { by: 'Writer' });
  assert.equal(b.kind, 'page');
  assert.equal(b.slug, 'weekly-report');
  assert.deepEqual(Object.keys(b.files).sort(), ['data.json', 'img/a.png', 'index.html']);
  assert.equal(b.files['img/a.png'].base64, Buffer.from([1, 2, 3]).toString('base64'));
  assert.equal(b.files['index.html'].text, '<h1>hi</h1>');
});

test('publish refuses a folder without index.html, odd files, and non-dashboard JSON', () => {
  const d = tmp();
  assert.throws(() => buildPublishBody(d), /index.html/);
  fs.writeFileSync(path.join(d, 'index.html'), 'x');
  fs.writeFileSync(path.join(d, 'run.sh'), 'x');
  assert.throws(() => buildPublishBody(d), /not allowed/);
  const j = path.join(tmp(), 'data.json');
  fs.writeFileSync(j, '{"items":[]}');
  assert.throws(() => buildPublishBody(j), /not a dashboard/);
  assert.throws(() => buildPublishBody('/no/such/path'), CliError);
});

test('publish sends dashboards and pages, prints draft + link; data goes through', async (t) => {
  const app = await fakeApp(t);
  const cfg = tmp();
  saveSettings(cfg, app.url, TOKEN);
  const dash = path.join(tmp(), 'sales.json');
  fs.writeFileSync(dash, JSON.stringify({ version: 1, slug: 'sales', title: { es: 'a', en: 'a' }, sources: {}, widgets: [] }));
  const out = [];
  await main(['publish', cfg, dash, '--by', 'Scheduler'], {}, (s) => out.push(s));
  assert.equal(app.seen[0].kind, 'dashboard');
  assert.equal(app.seen[0].by, 'Scheduler');
  assert.match(out[0], new RegExp(`draft, waiting for approval: ${app.url}/d/sales`));

  const html = path.join(tmp(), 'notes.html');
  fs.writeFileSync(html, '<p>x</p>');
  await main(['publish', cfg, html, '--slug=team-notes'], {}, () => {});
  assert.deepEqual(app.seen[1], { kind: 'page', slug: 'team-notes', by: 'ORCA', files: { 'index.html': { text: '<p>x</p>' } } });

  const data = path.join(tmp(), 'd.json');
  fs.writeFileSync(data, '{"items":[{"a":1}]}');
  await main(['data', cfg, 'sales', data], {}, () => {});
  assert.deepEqual(app.seen[2], { kind: 'data', name: 'sales', json: { items: [{ a: 1 }] }, by: 'ORCA' });
  await main(['data', cfg, '--page', 'weekly', data], {}, () => {});
  assert.equal(app.seen[3].page, 'weekly');
});

test('refusals and missing setup are plain messages', async (t) => {
  const app = await fakeApp(t);
  const cfg = tmp();
  await assert.rejects(main(['publish', cfg, __filename], {}, () => {}), /publish a folder/);
  const dash = path.join(tmp(), 'bad.json');
  fs.writeFileSync(dash, JSON.stringify({ version: 1, slug: 'bad', widgets: [] }));
  await assert.rejects(main(['publish', cfg, dash], {}, () => {}), /not set up/);
  saveSettings(cfg, app.url, TOKEN);
  await assert.rejects(main(['publish', cfg, dash], {}, () => {}), /refused:\n {2}slug is reserved/);
  await assert.rejects(main(['nope', cfg], {}, () => {}), /unknown artifact command/);
});

test('slugify', () => {
  assert.equal(slugify('Reporte Semanal — Café'), 'reporte-semanal-cafe');
});

test('setup keeps the app path and notes ORCA sign-in', async (t) => {
  const app = await fakeApp(t, { sso: true });
  const dir = tmp();
  const out = [];
  await main(['setup', dir, `${app.url}/c/acme/artifacts/`, TOKEN], {}, (l) => out.push(l));
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'artifacts.json'), 'utf8'));
  assert.equal(saved.url, `${app.url}/c/acme/artifacts`);
  assert.equal(saved.sso, true);
  assert.match(out[0], /one sign-in with ORCA/);
  assert.equal(loadSettings(dir, {}).sso, true);
});

test('setup saves nothing when the app refuses the token', async (t) => {
  const app = await fakeApp(t);
  const dir = tmp();
  await assert.rejects(main(['setup', dir, app.url, 'y'.repeat(32)], {}, () => {}), /token was refused/);
  assert.equal(fs.existsSync(path.join(dir, 'artifacts.json')), false);
});

test('sign-in secret matches the one ORCA Artifacts derives', () => {
  // Same value as orca-artifacts src/lib/server/identity.test.ts
  assert.equal(ssoSecret('x'.repeat(24)), 'ETUP5H30-KMfchE4UkDCWwyef8GK0KVsj3dF4g7MIpM');
});
