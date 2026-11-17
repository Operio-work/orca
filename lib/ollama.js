'use strict';
// Local models (Ollama) as an agent kind: opencode drives a model served by Ollama on this computer.
// Only models that can call tools are offered. Ollama loads a model with a small context (4096 by
// default) while opencode's own instructions alone are ~15k tokens, so each model runs as a copy
// "<model>-orca" with a bigger num_ctx (created once, shares the model's files; no new download).
const fs = require('fs');

const SUFFIX = '-orca';
const agentName = base => (base.includes(':') ? base : base + ':latest') + SUFFIX;

function createOllama({ url = 'http://127.0.0.1:11434', ctx = 20480, configFile, fetchImpl = fetch, log = () => {} }) {
  let cache = { at: 0, models: [] };
  const api = async (p, body, ms = 10000) => {
    const r = await fetchImpl(url + p, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) } : { signal: AbortSignal.timeout(ms) });
    if (!r.ok) throw new Error(`ollama ${p} ${r.status}`);
    return r.json();
  };

  // Tool-capable models, by name (sorted). Cached a minute; [] when Ollama isn't running.
  async function refresh() {
    try {
      const tags = (await api('/api/tags')).models || [];
      const out = [];
      for (const m of tags) {
        if (m.name.endsWith(SUFFIX)) continue;
        const caps = (await api('/api/show', { model: m.name }).catch(() => ({}))).capabilities || [];
        if (caps.includes('tools')) out.push(m.name);
      }
      cache = { at: Date.now(), models: out.sort() };
    } catch (e) { cache = { at: Date.now(), models: [] }; log('ollama.unreachable', { detail: e.message }); }
    return cache.models;
  }
  const models = () => cache.models;
  const fresh = () => (Date.now() - cache.at < 60e3 ? cache.models : refresh());

  // Make sure "<base>-orca" exists with our context size, write opencode's config for it, and return
  // the opencode model id ("ollama/<base>-orca").
  async function prepare(base) {
    if (!(await fresh()).includes(base)) throw Object.assign(new Error('bad_model'), { code: 'bad_model' });
    const name = agentName(base);
    const have = ((await api('/api/tags')).models || []).some(m => m.name === name);
    if (!have) {
      await api('/api/create', { model: name, from: base, parameters: { num_ctx: ctx }, stream: false }, 120000);
      log('ollama.created', { model: name, ctx });
    }
    const conf = {
      $schema: 'https://opencode.ai/config.json',
      provider: { ollama: { npm: '@ai-sdk/openai-compatible', name: 'Ollama (this computer)', options: { baseURL: url + '/v1' },
        models: Object.fromEntries(cache.models.map(b => [agentName(b), { name: b, tools: true }])) } },
    };
    fs.writeFileSync(configFile + '.tmp', JSON.stringify(conf, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(configFile + '.tmp', configFile);
    return 'ollama/' + name;
  }

  return { refresh, fresh, models, prepare, agentName };
}

module.exports = { createOllama, agentName };
