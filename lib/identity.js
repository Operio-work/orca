'use strict';

// Who is using a hosted panel. ORCA Host (the login in front of hosted panels) signs every
// request it forwards with a secret shared with this one panel; the panel trusts the person only
// when the signature checks out. Without the secret (a self-hosted ORCA) nobody is trusted
// and the panel stays single-user.
//
//   X-Orca-User: v1.<base64url(JSON)>.<base64url(HMAC-SHA256(secret, "v1." + payload))>
//   JSON: { u: user id, n: display name, r: role, c: 1 when this person may read the team chat, t: ms }
//
// The same format is built by ORCA Host (src/lib/server/identity.ts); the test vector in
// test/identity.test.js is checked by both repos.
//
// The other direction (this panel asking ORCA Host to translate a chat message) signs the body
// with the same secret: X-Orca-Sign: v1.<t>.<base64url(HMAC(secret, "body." + t + "." + body))>.

const crypto = require('crypto');

const HEADER = 'x-orca-user';
const MAX_AGE_MS = 5 * 60e3;
const ROLES = ['operio_admin', 'operio_ops', 'client_admin', 'client_viewer'];

const b64 = buf => Buffer.from(buf).toString('base64url');
const mac = (secret, text) => crypto.createHmac('sha256', String(secret)).update(text).digest();
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function sign(secret, { u, n, r, c }, now = Date.now()) {
  const payload = b64(JSON.stringify({ u: String(u), n: String(n || ''), r, c: c ? 1 : 0, t: now }));
  return `v1.${payload}.${b64(mac(secret, 'v1.' + payload))}`;
}

// The person, or null when the header is missing, forged, stale or malformed.
function verify(secret, header, now = Date.now()) {
  if (!secret || typeof header !== 'string' || header.length > 2048) return null;
  const m = header.match(/^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m || !same(m[2], b64(mac(secret, 'v1.' + m[1])))) return null;
  let p;
  try { p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch { return null; }
  if (!p || typeof p.u !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(p.u) || !ROLES.includes(p.r)) return null;
  if (typeof p.t !== 'number' || Math.abs(now - p.t) > MAX_AGE_MS) return null;
  const name = String(p.n || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) || 'Someone';
  return { id: p.u, name, role: p.r, operio: p.r.startsWith('operio_'), chat: p.c === 1 };
}

function signBody(secret, body, now = Date.now()) {
  return `v1.${now}.${b64(mac(secret, `body.${now}.${body}`))}`;
}
function verifyBody(secret, header, body, now = Date.now()) {
  const m = typeof header === 'string' && header.match(/^v1\.(\d{10,16})\.([A-Za-z0-9_-]+)$/);
  if (!secret || !m || Math.abs(now - Number(m[1])) > MAX_AGE_MS) return false;
  return same(m[2], b64(mac(secret, `body.${m[1]}.${body}`)));
}

module.exports = { HEADER, MAX_AGE_MS, ROLES, sign, verify, signBody, verifyBody };
