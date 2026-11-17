'use strict';
// Accounts: one agent kind, several logins. Each extra account is its own folder
// (<config>/accounts/<id>, 0700).
//   login kinds (claude, codex): the CLI is pointed at the folder with one env var
//     (CLAUDE_CONFIG_DIR / CODEX_HOME); the person signs in once with the command ORCA shows.
//   key kinds (gemini, agy): a Gemini API key from that Google account, kept in <folder>/key.env
//     (0600), loaded into the agent's shell from the file (never typed, never sent back to the page).
//     Google no longer lets Gemini CLI sign in with a personal account, and agy keeps one login per
//     computer user, so an API key is the way to run several Google accounts side by side.
// "Default" = the CLI's normal login on this computer (no env var); an admin can name it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KINDS = {
  claude: { env: 'CLAUDE_CONFIG_DIR', creds: d => path.join(d, '.credentials.json'), home: h => path.join(h, '.claude'),
    login: 'claude   (then type /login)', link: ['settings.json', 'CLAUDE.md', 'skills'] },
  codex: { env: 'CODEX_HOME', creds: d => path.join(d, 'auth.json'), home: h => path.join(h, '.codex'),
    login: 'codex login', link: ['AGENTS.md', 'hooks.json'], copy: ['config.toml'] },
  gemini: { env: 'GEMINI_CLI_HOME', key: true, home: h => h, sub: '.gemini', link: ['GEMINI.md', 'skills', 'trustedFolders.json'], copy: ['settings.json'],
    settings: { security: { auth: { selectedType: 'gemini-api-key' } } }, noDefault: true },
  // agy (Antigravity) has no accounts of its own: it runs on a Google key account (kind gemini).
  agy: { key: true, home: h => path.join(h, '.gemini', 'antigravity-cli'), args: d => ['--settings', path.join(d, 'agy-settings.json')], keyFrom: 'gemini' },
};
const ADDABLE = ['claude', 'codex', 'gemini'];
const KEY_RE = /^[A-Za-z0-9_-]{20,200}$/;
const LABEL_MAX = 60, MAX_ACCOUNTS = 30;
const ID_RE = /^[a-z0-9]{8}$/;

class AccountError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const label = v => String(v ?? '').replace(/[\u0000-\u001F]/g, '').replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX);
const exists = p => { try { fs.statSync(p); return true; } catch { return false; } };

function createAccounts({ configDir, home, now = () => Date.now(), log = () => {} }) {
  const ROOT = path.join(configDir, 'accounts');
  const FILE = path.join(configDir, 'accounts.json');
  const dirOf = id => path.join(ROOT, id);

  function load() {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      return { accounts: (raw.accounts || []).filter(a => ID_RE.test(a.id) && KINDS[a.kind]), defaults: raw.defaults || {} };
    } catch (e) { if (e.code !== 'ENOENT') log('accounts.bad', { error: e.message }); return { accounts: [], defaults: {} }; }
  }
  function save(d) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(FILE + '.tmp', JSON.stringify(d, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(FILE + '.tmp', FILE);
  }
  // The CLI's own settings, instructions and skills carry over; the login does not.
  function seed(kind, dir) {
    const k = KINDS[kind];
    if (k.key) fs.writeFileSync(path.join(dir, 'agy-settings.json'), JSON.stringify({ modelProvider: 'gemini' }) + '\n', { mode: 0o600 }); // same key runs agy
    const src = k.home(home), dst = path.join(dir, k.sub || '');
    const from = path.join(src, k.sub || '');
    fs.mkdirSync(dst, { recursive: true, mode: 0o700 });
    for (const f of k.link || []) if (exists(path.join(from, f))) fs.symlinkSync(path.join(from, f), path.join(dst, f));
    for (const f of k.copy || []) if (exists(path.join(from, f))) fs.copyFileSync(path.join(from, f), path.join(dst, f));
    if (k.settings) {
      const file = path.join(dst, 'settings.json');
      let cur = {};
      try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }
      fs.writeFileSync(file, JSON.stringify({ ...cur, ...k.settings }, null, 2) + '\n', { mode: 0o600 });
    }
  }
  const keyFile = id => path.join(dirOf(id), 'key.env');
  // Signed in: a login kind's credentials file, or a key kind's key file. null = can't tell (agy's own login).
  const signedIn = (kind, dir, id) => (KINDS[kind].key ? (id ? exists(keyFile(id)) : null) : exists(KINDS[kind].creds(dir || KINDS[kind].home(home))));

  // [{ id: 'default'|<id>, kind, label, signedIn, login }] — default first per kind.
  function list() {
    const d = load();
    const out = [];
    for (const kind of Object.keys(KINDS)) {
      const k = KINDS[kind];
      if (!k.noDefault) out.push({ id: 'default', kind, label: d.defaults[kind] || '', signedIn: signedIn(kind, null), login: k.login || null, key: false, kinds: [kind] });
      if (k.keyFrom) continue; // listed once, under the kind that owns them
      for (const a of d.accounts.filter(x => x.kind === kind)) {
        out.push({ id: a.id, kind, label: a.label, signedIn: signedIn(kind, dirOf(a.id), a.id), key: !!k.key, login: k.key ? null : `${k.env}=${dirOf(a.id)} ${k.login}`,
          kinds: k.key ? ['gemini', 'agy'] : [kind] });
      }
    }
    return out;
  }
  function add({ kind, label: l, key }) {
    if (kind === 'agy') kind = 'gemini';
    if (!ADDABLE.includes(kind)) throw new AccountError('bad_kind');
    if (key && (!KINDS[kind].key || !KEY_RE.test(String(key).trim()))) throw new AccountError('bad_key');
    const name = label(l);
    if (!name) throw new AccountError('account_name');
    const d = load();
    if (d.accounts.length >= MAX_ACCOUNTS) throw new AccountError('too_many');
    if (d.accounts.some(a => a.kind === kind && a.label.toLowerCase() === name.toLowerCase()) || (d.defaults[kind] || '').toLowerCase() === name.toLowerCase()) throw new AccountError('account_exists', 409);
    const id = crypto.randomBytes(6).toString('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().padEnd(8, '0').slice(0, 8);
    fs.mkdirSync(dirOf(id), { recursive: true, mode: 0o700 });
    seed(kind, dirOf(id));
    d.accounts.push({ id, kind, label: name, at: now() });
    save(d);
    if (key) setKey(id, key);
    return { id, kind, label: name };
  }
  function rename(kind, id, l) {
    const d = load();
    const name = label(l);
    if (id === 'default') { if (!KINDS[kind]) throw new AccountError('bad_kind'); d.defaults[kind] = name; }
    else { const a = d.accounts.find(x => x.id === id); if (!a) throw new AccountError('gone', 404); if (!name) throw new AccountError('account_name'); a.label = name; }
    save(d);
  }
  // Removes the account and its login folder (the login is gone; sign in again to get it back).
  function remove(id) {
    if (!ID_RE.test(String(id))) throw new AccountError('gone', 404);
    const d = load();
    const a = d.accounts.find(x => x.id === id);
    if (!a) return false;
    d.accounts = d.accounts.filter(x => x.id !== id);
    save(d);
    fs.rmSync(dirOf(id), { recursive: true, force: true });
    return a;
  }
  // Replace a key account's API key. The value is only ever written to key.env (0600).
  function setKey(id, key) {
    const a = load().accounts.find(x => x.id === id);
    if (!a) throw new AccountError('gone', 404);
    if (!KINDS[a.kind].key) throw new AccountError('bad_key');
    key = String(key || '').trim();
    if (!KEY_RE.test(key)) throw new AccountError('bad_key');
    fs.writeFileSync(keyFile(id) + '.tmp', `GEMINI_API_KEY=${key}\n`, { mode: 0o600 });
    fs.renameSync(keyFile(id) + '.tmp', keyFile(id));
    return a;
  }
  // How to start this kind under this account: env vars to export, a key file to source, extra
  // CLI args. null = the default login (nothing to do).
  function startFor(kind, id) {
    if (!id || id === 'default') { if (KINDS[kind]?.noDefault) throw new AccountError('needs_account'); return null; }
    const a = load().accounts.find(x => x.id === id);
    const k = KINDS[kind];
    if (!a || !k || (a.kind !== kind && a.kind !== k.keyFrom)) throw new AccountError('bad_account');
    if (k.key && !exists(keyFile(id))) throw new AccountError('needs_key');
    return { exports: k.env ? [[k.env, dirOf(id)]] : [], source: k.key ? keyFile(id) : null, args: k.args ? k.args(dirOf(id)) : [] };
  }
  const labelOf = (kind, id) => (!id || id === 'default' ? load().defaults[kind] || '' : load().accounts.find(x => x.id === id)?.label || '');

  return { list, add, rename, remove, setKey, startFor, labelOf, ROOT };
}

module.exports = { createAccounts, AccountError, ACCOUNT_KINDS: Object.keys(KINDS) };
