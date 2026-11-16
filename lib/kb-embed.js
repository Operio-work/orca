'use strict';
// Embeddings for the knowledge search (lib/kb.js), on the client's own key — hosted panels only.
// Plain https (fetch) with a timeout; no SDK. The key is sent to the provider and nowhere else,
// and is never logged or put in an error message.
//
// Provider APIs, checked against the providers' docs on 2026-11-16:
//   Voyage AI  POST https://api.voyageai.com/v1/embeddings   (docs.voyageai.com/reference/embeddings-api)
//              { input: [..], model, input_type: "document"|"query" } → { data: [{ embedding, index }], usage }
//              ≤ 1,000 inputs per request; voyage-4-lite: ≤ 1M tokens per request. Default model: voyage-4-lite.
//   OpenAI     POST https://api.openai.com/v1/embeddings      (developers.openai.com/api/reference/resources/embeddings)
//              { input: [..], model } → { data: [{ embedding, index }], usage }
//              ≤ 2,048 inputs, ≤ 8,192 tokens each, ≤ 300,000 tokens per request. Default: text-embedding-3-small.
// We send 64 chunks (~1,200 characters ≈ 300 tokens each) per request: far inside both limits.
// OPERIO_ORCA_KB_VOYAGE_URL / OPERIO_ORCA_KB_OPENAI_URL replace the endpoints (tests use a local fake).

const PROVIDERS = {
  voyage: { keyName: 'VOYAGE_API_KEY', url: 'https://api.voyageai.com/v1/embeddings', urlEnv: 'OPERIO_ORCA_KB_VOYAGE_URL', model: 'voyage-4-lite' },
  openai: { keyName: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/embeddings', urlEnv: 'OPERIO_ORCA_KB_OPENAI_URL', model: 'text-embedding-3-small' },
};
const BATCH = 64;
const TIMEOUT_MS = 20000;

class EmbedError extends Error {
  constructor(code, detail) { super(detail ? `${code}: ${detail}` : code); this.code = code; this.detail = detail; }
}

// provider: 'voyage' | 'openai'; key: the API key; type: 'document' | 'query'.
// Returns one Float32Array per text, in order. Throws EmbedError (never containing the key).
function createEmbedder({ provider, key, model, env = process.env, timeoutMs = TIMEOUT_MS, fetchImpl = globalThis.fetch }) {
  const p = PROVIDERS[provider];
  if (!p) throw new EmbedError('bad_provider', String(provider));
  const url = (env[p.urlEnv] || '').trim() || p.url;
  const useModel = model || p.model;

  async function batch(texts, type) {
    const body = { input: texts, model: useModel };
    if (provider === 'voyage') body.input_type = type === 'query' ? 'query' : 'document';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch (e) {
      throw new EmbedError(e.name === 'AbortError' ? 'timeout' : 'unreachable', e.name === 'AbortError' ? `no answer in ${Math.round(timeoutMs / 1000)} s` : String(e.cause?.code || e.message).slice(0, 80));
    } finally { clearTimeout(timer); }
    let json = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) {
      const code = res.status === 401 || res.status === 403 ? 'bad_key' : res.status === 429 ? 'rate_limited' : 'http_error';
      // The provider's own message helps ("model not found"); keep it short and strip anything key-like.
      const msg = String(json?.detail || json?.error?.message || json?.error || '').replace(/[A-Za-z0-9_-]{24,}/g, '…').slice(0, 160);
      throw new EmbedError(code, `HTTP ${res.status}${msg ? ' ' + msg : ''}`);
    }
    const data = Array.isArray(json?.data) ? json.data : null;
    if (!data || data.length !== texts.length) throw new EmbedError('bad_response', 'wrong number of embeddings');
    const out = new Array(texts.length);
    for (const d of data) {
      const i = Number.isInteger(d?.index) ? d.index : -1;
      if (i < 0 || i >= texts.length || !Array.isArray(d.embedding) || !d.embedding.length) throw new EmbedError('bad_response', 'malformed embedding');
      out[i] = Float32Array.from(d.embedding);
    }
    if (out.some(v => !v)) throw new EmbedError('bad_response', 'missing embedding');
    const dim = out[0].length;
    if (out.some(v => v.length !== dim)) throw new EmbedError('bad_response', 'mixed dimensions');
    return out;
  }

  async function embed(texts, type = 'document', { onBatch } = {}) {
    const out = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const part = await batch(texts.slice(i, i + BATCH), type);
      out.push(...part);
      if (onBatch) onBatch(out.length, texts.length);
    }
    return out;
  }

  return { embed, provider, model: useModel, url };
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const toB64 = v => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');
const fromB64 = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

module.exports = { createEmbedder, EmbedError, PROVIDERS, BATCH, cosine, toB64, fromB64 };
