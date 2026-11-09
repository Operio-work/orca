'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../lib/guard');

const local = g.makeAllowed({ host: '127.0.0.1', port: 7171, allowedHosts: [] });
const withTs = g.makeAllowed({ host: '127.0.0.1', port: 7171, allowedHosts: ['laptop.example.ts.net', 'proxy.example:8443'] });

test('loopback names are always allowed, with or without a port', () => {
  for (const h of ['localhost', 'localhost:7171', '127.0.0.1', '127.0.0.1:7171', '[::1]', '[::1]:7171', 'LOCALHOST:7171']) {
    assert.equal(g.hostAllowed(h, local), true, h);
  }
});

test('unknown hosts are rejected (DNS rebinding)', () => {
  for (const h of ['evil.example', 'evil.example:7171', '127.0.0.1.evil.example', 'localhost.evil.example', '', undefined, 'a:b:c', '127.0.0.1:abc', 'laptop.example.ts.net']) {
    assert.equal(g.hostAllowed(h, local), false, String(h));
  }
});

test('allowlisted names work; a pinned port must match', () => {
  assert.equal(g.hostAllowed('laptop.example.ts.net', withTs), true);
  assert.equal(g.hostAllowed('laptop.example.ts.net:443', withTs), true);
  assert.equal(g.hostAllowed('proxy.example:8443', withTs), true);
  assert.equal(g.hostAllowed('proxy.example:9000', withTs), false);
  assert.equal(g.hostAllowed('proxy.example', withTs), false);
});

test('a non-wildcard bind host is allowed; 0.0.0.0 is not a name', () => {
  const lan = g.makeAllowed({ host: '192.168.1.20', port: 7171 });
  assert.equal(g.hostAllowed('192.168.1.20:7171', lan), true);
  const any = g.makeAllowed({ host: '0.0.0.0', port: 7171 });
  assert.equal(g.hostAllowed('0.0.0.0:7171', any), false);
  assert.equal(g.hostAllowed('localhost:7171', any), true);
});

test('origin must be http(s) on an allowed host', () => {
  assert.equal(g.originAllowed('http://127.0.0.1:7171', local), true);
  assert.equal(g.originAllowed('https://laptop.example.ts.net', withTs), true);
  for (const o of [undefined, '', 'null', 'http://evil.example', 'file://', 'chrome-extension://abc', 'not a url']) {
    assert.equal(g.originAllowed(o, local), false, String(o));
  }
});

test('sameOrigin needs Origin to match the Host the request used', () => {
  const req = (host, origin) => ({ headers: { host, origin } });
  assert.equal(g.sameOrigin(req('127.0.0.1:7171', 'http://127.0.0.1:7171'), local), true);
  assert.equal(g.sameOrigin(req('127.0.0.1:7171', undefined), local), false);
  assert.equal(g.sameOrigin(req('127.0.0.1:7171', 'http://evil.example'), local), false);
  assert.equal(g.sameOrigin(req('127.0.0.1:7171', 'http://localhost:7171'), local), false);
  assert.equal(g.sameOrigin(req('laptop.example.ts.net', 'https://laptop.example.ts.net'), withTs), true);
});

test('loopback bind detection', () => {
  assert.equal(g.isLoopbackBind('127.0.0.1'), true);
  assert.equal(g.isLoopbackBind('localhost'), true);
  assert.equal(g.isLoopbackBind('0.0.0.0'), false);
  assert.equal(g.isLoopbackBind('192.168.1.20'), false);
});
