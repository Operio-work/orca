'use strict';
// The signed X-Orca-User header ORCA Host adds to every request it forwards to a hosted panel.
// VECTOR is also checked by ORCA Host's tests: the two must never drift apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sign, verify } = require('../lib/identity');

const T = 1794700000000;
const VECTOR = 'v1.eyJ1IjoiYWJjMTIzIiwibiI6IkFuYSIsInIiOiJjbGllbnRfYWRtaW4iLCJjIjoxLCJ0IjoxNzk0NzAwMDAwMDAwfQ.OyueC2qFwMlFKkD3gYWoFtRfxtJucuhQ57b-OWMwjAE';

test('identity: the shared vector signs and verifies', () => {
  assert.equal(sign('test-secret', { u: 'abc123', n: 'Ana', r: 'client_admin', c: 1 }, T), VECTOR);
  assert.deepEqual(verify('test-secret', VECTOR, T + 1000), { id: 'abc123', name: 'Ana', role: 'client_admin', operio: false, chat: true });
});

test('identity: wrong secret, tampering, staleness and bad roles are refused', () => {
  assert.equal(verify('other-secret', VECTOR, T), null);
  assert.equal(verify('', VECTOR, T), null);
  assert.equal(verify('test-secret', VECTOR, T + 6 * 60e3), null);
  const [v, p, s] = VECTOR.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'abc123', n: 'Ana', r: 'operio_admin', c: 1, t: T })).toString('base64url');
  assert.equal(verify('test-secret', `${v}.${forged}.${s}`, T), null);
  assert.equal(verify('test-secret', `${v}.${p}.x${s}`, T), null);
  assert.equal(verify('test-secret', sign('test-secret', { u: 'a', n: 'A', r: 'root' }, T), T), null);
  assert.equal(verify('test-secret', sign('test-secret', { u: 'a b', n: 'A', r: 'client_admin' }, T), T), null);
});

test('identity: names are cleaned; Operio roles are marked', () => {
  const h = sign('k', { u: 'u1', n: ' Leo\u0007 ', r: 'operio_ops', c: 0 }, T);
  assert.deepEqual(verify('k', h, T), { id: 'u1', name: 'Leo', role: 'operio_ops', operio: true, chat: false });
});
