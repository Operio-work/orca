'use strict';

// Request guards for a panel that can type into live shells and agents.
//
// 1. Host check (blocks DNS rebinding): a page on evil.example can point its own DNS name
//    at 127.0.0.1 and then talk to us "same-origin". Browsers still send the attacker's name
//    in the Host header, so only answering to names we know closes that door.
// 2. Origin check (blocks CSRF): every state-changing request must carry an Origin header
//    whose host is one of those same known names. Browsers always send Origin on POST.

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// "Host: 127.0.0.1:7171" -> { name: '127.0.0.1', port: '7171' }; IPv6 keeps its brackets.
function splitHost(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith('[')) {
    const end = v.indexOf(']');
    if (end < 0) return null;
    const rest = v.slice(end + 1);
    if (rest && !/^:\d{1,5}$/.test(rest)) return null;
    return { name: v.slice(0, end + 1), port: rest ? rest.slice(1) : '' };
  }
  const parts = v.split(':');
  if (parts.length > 2) return null;
  if (parts[1] !== undefined && !/^\d{1,5}$/.test(parts[1])) return null;
  if (!/^[a-z0-9.-]+$/.test(parts[0])) return null;
  return { name: parts[0], port: parts[1] || '' };
}

// The names this server answers to: loopback, the bind host (unless a wildcard) and the
// allowlist. Entries in the allowlist may pin a port ("box.example:443") or not ("box.example").
function makeAllowed({ host, port, allowedHosts = [] }) {
  const names = new Set(LOOPBACK);
  const pinned = new Set();
  const h = String(host || '').toLowerCase();
  if (h && h !== '0.0.0.0' && h !== '::' && h !== '[::]') names.add(h.includes(':') && !h.startsWith('[') ? `[${h}]` : h);
  for (const entry of allowedHosts) {
    const s = splitHost(entry);
    if (!s) continue;
    if (s.port) pinned.add(`${s.name}:${s.port}`); else names.add(s.name);
  }
  return { names, pinned, port: String(port || '') };
}

function hostAllowed(hostHeader, allowed) {
  const s = splitHost(hostHeader);
  if (!s) return false;
  if (allowed.pinned.has(`${s.name}:${s.port}`)) return true;
  return allowed.names.has(s.name);
}

function originAllowed(originHeader, allowed) {
  if (!originHeader || originHeader === 'null') return false;
  let u;
  try { u = new URL(originHeader); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return hostAllowed(u.host, allowed);
}

// Origin must also match the Host the request came in on (not just any allowed name), so a
// page served on one allowed name can't drive the server through another.
function sameOrigin(req, allowed) {
  const origin = req.headers.origin;
  if (!originAllowed(origin, allowed)) return false;
  try { return new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase(); } catch { return false; }
}

const isLoopbackBind = host => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(host || '').toLowerCase());

module.exports = { splitHost, makeAllowed, hostAllowed, originAllowed, sameOrigin, isLoopbackBind };
