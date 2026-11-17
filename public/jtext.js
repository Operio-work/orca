'use strict';
// ORCA journal: one line of plain words per entry, EN / ES. Shared by the agent panel's
// History section (app.js) and the Journal page (journal.js). Exposed as window.OrcaJText.
(function () {
  const L = {
    en: {
      orca: 'ORCA', you: 'you', someone: 'someone',
      'agent.new': (w, a, e) => `${w} started ${a} (${kind(e.kind, 'en')})`,
      'shell.new': (w, a) => `${w} opened a new shell ${a}`,
      'agent.end': (w, a, e) => `${w} ended ${a}${e.mode === 'clean' ? '' : e.mode === 'interrupted' ? ' (it needed ⌃C)' : ' (closed by force)'}${ran(e.ranFor, 'en')}`,
      'agent.gone': (w, a, e) => `${a} exited on its own${ran(e.ranFor, 'en')}`,
      'agent.stop': (w, a, e) => `${w} stopped ${a}${e.status === 'exited' ? ' — it exited' : ''}`,
      'agent.move': (w, a) => `${w} moved ${a}`,
      'agent.rename': (w, a, e) => (e.name ? `${w} named it ${e.name}` : `${w} cleared the name of ${e.was || a}`),
      'agent.claim': (w, a, e) => ({ claim: `${w} claimed ${a}`, release: `${w} released ${a}`, take: `${w} took over ${a}${e.from ? ` from ${e.from}` : ''}`, assign: `${w} gave ${a} to ${e.to}` }[e.mode] || `${w} ${e.mode} ${a}`),
      'agent.tags': (w, a, e) => `${w} tagged ${a}: ${(e.tags || []).map(x => '#' + x).join(' ') || '(none)'}`,
      'agent.model': (w, a, e) => `${w} switched ${a} to ${e.model}`,
      'agent.prompt': (w, a) => `${w} → ${a}`,
      'chat.prompt': (w, a, e) => `${w} → ${a} (team chat${e.thread === 'room' ? ', room' : ''})`,
      'agent.answer': (w, a, e) => `${w} answered ${a}: ${(e.picked || []).join(' / ')}`,
      'agent.keys': (w, a, e) => `${w} pressed ${e.key} on ${a}`,
      'agent.job': (w, a, e) => `${a} finished a job${e.secs != null ? ` (${mins(e.secs * 1000, 'en')})` : ''}`,
      'agent.blocked': (w, a) => `${a} needed you`,
      'link.add': (w, a, e) => `${w} linked ${a} with ${nm(e.to)}`,
      'worker.end': (w, a, e) => `Worker ${a} ${e.reason === 'timeout' ? 'ran out of time' : 'finished'}${e.to ? ` and reported to ${nm(e.to)}` : ''}`,
      'spawn.request': (w, a, e) => `${a} asked for a ${e.profile} worker`,
      'spawn.approve': (w, a, e) => `${w} approved ${a}'s request: worker ${e.worker} started`,
      'spawn.deny': (w, a, e) => `${w} declined ${a}'s request for a ${e.profile} worker`,
      'profile.save': (w, a, e) => `${w} saved the agent setup ${e.profile}`,
      'profile.delete': (w, a, e) => `${w} deleted the agent setup ${e.profile}`,
      'account.add': (w, a, e) => `${w} added the ${kind(e.kind)} account “${e.label}”`,
      'account.key': (w, a, e) => `${w} set the API key of the account “${e.label}”`,
      'account.rename': (w, a, e) => `${w} renamed a ${kind(e.kind)} account to “${e.label}”`,
      'account.remove': (w, a, e) => `${w} removed the ${kind(e.kind)} account “${e.label}”`,
      'tool.save': (w, a, e) => `${w} saved the tool ${e.tool}`,
      'tool.remove': (w, a, e) => `${w} removed the tool ${e.tool}`,
      'secret.set': (w, a, e) => `${w} ${e.cleared ? 'cleared' : 'set'} the secret ${e.name}`,
      'access.change': (w, a, e) => `${w} changed People & access: ${e.people} people, list ${e.allowlist ? 'on' : 'off'}`,
      'link.delete': (w, a, e) => `${w} unlinked ${a} and ${nm(e.to)}`,
      'handoff.send': (w, a, e) => `${w} handed ${a}'s result to ${nm(e.to)}`,
      'handoff.dismiss': (w, a, e) => `${w} skipped the hand-off ${a} → ${nm(e.to)}`,
      'msg.agent': (w, a, e) => `${a} messaged ${nm(e.to)}`,
      'msg.rate_limited': (w, a, e) => `Link ${a} ↔ ${nm(e.to)} paused (too many messages)`,
      'shell.open': (w, a) => `${w} opened the shell ${a}`,
      'shell.close': (w, a) => `${w} closed the shell ${a}`,
      'shell.unlock': (w, a, e) => `${w} allowed shells for ${e.minutes} min`,
      'shell.lock': w => `${w} locked shells again`,
      'access.denied': (w, a, e) => `${w} was refused: ${({ shell_locked: 'shells need a confirmation first' })[e.code] || e.code}${a ? ` (${a})` : ''}`,
      'journal.review': (w, a, e) => `${w} reviewed ${e.day}`,
      'journal.unreview': (w, a, e) => `${w} reopened ${e.day} for review`,
      error: (w, a, e) => `Error ${e.code} on ${e.path}${e.n > 1 ? ` ×${e.n}` : ''}`,
    },
    es: {
      orca: 'ORCA', you: 'tú', someone: 'alguien',
      'agent.new': (w, a, e) => `${w} inició ${a} (${kind(e.kind, 'es')})`,
      'shell.new': (w, a) => `${w} abrió una terminal nueva ${a}`,
      'agent.end': (w, a, e) => `${w} terminó ${a}${e.mode === 'clean' ? '' : e.mode === 'interrupted' ? ' (necesitó ⌃C)' : ' (cerrado a la fuerza)'}${ran(e.ranFor, 'es')}`,
      'agent.gone': (w, a, e) => `${a} salió por sí solo${ran(e.ranFor, 'es')}`,
      'agent.stop': (w, a, e) => `${w} detuvo ${a}${e.status === 'exited' ? ' — se cerró' : ''}`,
      'agent.move': (w, a) => `${w} movió ${a}`,
      'agent.rename': (w, a, e) => (e.name ? `${w} lo nombró ${e.name}` : `${w} quitó el nombre de ${e.was || a}`),
      'agent.claim': (w, a, e) => ({ claim: `${w} tomó ${a}`, release: `${w} soltó ${a}`, take: `${w} tomó ${a}${e.from ? ` de ${e.from}` : ''}`, assign: `${w} asignó ${a} a ${e.to}` }[e.mode] || `${w} ${e.mode} ${a}`),
      'agent.tags': (w, a, e) => `${w} etiquetó ${a}: ${(e.tags || []).map(x => '#' + x).join(' ') || '(ninguna)'}`,
      'agent.model': (w, a, e) => `${w} cambió ${a} a ${e.model}`,
      'agent.prompt': (w, a) => `${w} → ${a}`,
      'chat.prompt': (w, a, e) => `${w} → ${a} (chat del equipo${e.thread === 'room' ? ', sala' : ''})`,
      'agent.answer': (w, a, e) => `${w} respondió a ${a}: ${(e.picked || []).join(' / ')}`,
      'agent.keys': (w, a, e) => `${w} pulsó ${e.key} en ${a}`,
      'agent.job': (w, a, e) => `${a} terminó un trabajo${e.secs != null ? ` (${mins(e.secs * 1000, 'es')})` : ''}`,
      'agent.blocked': (w, a) => `${a} te necesitó`,
      'link.add': (w, a, e) => `${w} enlazó ${a} con ${nm(e.to)}`,
      'worker.end': (w, a, e) => `El trabajador ${a} ${e.reason === 'timeout' ? 'se quedó sin tiempo' : 'terminó'}${e.to ? ` y le reportó a ${nm(e.to)}` : ''}`,
      'spawn.request': (w, a, e) => `${a} pidió un trabajador ${e.profile}`,
      'spawn.approve': (w, a, e) => `${w} aprobó la solicitud de ${a}: inició el trabajador ${e.worker}`,
      'spawn.deny': (w, a, e) => `${w} rechazó la solicitud de ${a} de un trabajador ${e.profile}`,
      'profile.save': (w, a, e) => `${w} guardó la configuración del agente ${e.profile}`,
      'profile.delete': (w, a, e) => `${w} borró la configuración del agente ${e.profile}`,
      'account.add': (w, a, e) => `${w} agregó la cuenta de ${kind(e.kind)} “${e.label}”`,
      'account.key': (w, a, e) => `${w} guardó la clave de API de la cuenta “${e.label}”`,
      'account.rename': (w, a, e) => `${w} renombró una cuenta de ${kind(e.kind)} a “${e.label}”`,
      'account.remove': (w, a, e) => `${w} quitó la cuenta de ${kind(e.kind)} “${e.label}”`,
      'tool.save': (w, a, e) => `${w} guardó la herramienta ${e.tool}`,
      'tool.remove': (w, a, e) => `${w} quitó la herramienta ${e.tool}`,
      'secret.set': (w, a, e) => `${w} ${e.cleared ? 'borró' : 'guardó'} el secreto ${e.name}`,
      'access.change': (w, a, e) => `${w} cambió Personas y acceso: ${e.people} personas, lista ${e.allowlist ? 'activada' : 'desactivada'}`,
      'link.delete': (w, a, e) => `${w} desenlazó ${a} y ${nm(e.to)}`,
      'handoff.send': (w, a, e) => `${w} pasó el resultado de ${a} a ${nm(e.to)}`,
      'handoff.dismiss': (w, a, e) => `${w} omitió el relevo ${a} → ${nm(e.to)}`,
      'msg.agent': (w, a, e) => `${a} escribió a ${nm(e.to)}`,
      'msg.rate_limited': (w, a, e) => `Enlace ${a} ↔ ${nm(e.to)} en pausa (demasiados mensajes)`,
      'shell.open': (w, a) => `${w} abrió la terminal ${a}`,
      'shell.close': (w, a) => `${w} cerró la terminal ${a}`,
      'shell.unlock': (w, a, e) => `${w} permitió las terminales por ${e.minutes} min`,
      'shell.lock': w => `${w} volvió a bloquear las terminales`,
      'access.denied': (w, a, e) => `${w} fue rechazado: ${({ shell_locked: 'las terminales piden confirmación primero' })[e.code] || e.code}${a ? ` (${a})` : ''}`,
      'journal.review': (w, a, e) => `${w} revisó ${e.day}`,
      'journal.unreview': (w, a, e) => `${w} reabrió ${e.day} para revisión`,
      error: (w, a, e) => `Error ${e.code} en ${e.path}${e.n > 1 ? ` ×${e.n}` : ''}`,
    },
  };
  // Other languages: the pack's sentences get this file's helpers as parameters.
  if (window.ORCA_I18N?.jtext) L[window.ORCA_I18N.lang] = { ...L.en, ...window.ORCA_I18N.jtextWords, ...window.ORCA_I18N.jtext({ kind, nm, mins, ran }) };
  const KINDS = { claude: 'Claude', opencode: 'opencode', hermes: 'Hermes', agy: 'Antigravity', codex: 'Codex', shell: 'shell' };
  function kind(k) { return KINDS[k] || k || '?'; }
  function nm(a) { return a ? (a.name || a.pane || '?') : '?'; }
  function mins(ms, lang) {
    if (ms == null) return '';
    const m = Math.round(ms / 60e3);
    if (m < 1) return lang === 'es' ? '<1 min' : '<1 min';
    if (m < 90) return `${m} min`;
    const h = Math.round(m / 6) / 10;
    return `${h} h`;
  }
  function ran(ms, lang) { return ms == null ? '' : (lang === 'es' ? ` tras ${mins(ms, lang)}` : ` after ${mins(ms, lang)}`); }

  // The quote or reply that goes under the line (shown smaller), if any.
  function detail(e) {
    if (e.event === 'agent.prompt' || e.event === 'chat.prompt') return e.text || '';
    if (e.event === 'agent.job') return [e.ask ? '“' + e.ask + '”' : '', e.said || e.title || ''].filter(Boolean).join(' → ');
    if (e.event === 'agent.end') return e.said || '';
    if (e.event === 'worker.end') return e.said || '';
    if (e.event === 'spawn.request' || e.event === 'spawn.approve' || e.event === 'spawn.deny') return e.task || '';
    if (e.event === 'agent.answer') return e.question || '';
    if (e.event === 'msg.agent') return e.text || '';
    if (e.event === 'handoff.send') return e.note || e.said || '';
    if (e.event === 'agent.blocked') return e.title || '';
    return '';
  }

  // me: { id } of the viewer, so their own actions read "you".
  function describe(e, lang, me) {
    const T = L[lang] || L.en;
    const w = !e.who ? T.orca : me && e.who.id === me.id ? T.you : e.who.name;
    const a = nm(e.agent);
    const f = T[e.event];
    const line = f ? f(w, a, e) : `${w} ${e.event} ${e.agent ? a : ''}`.trim();
    // Capitalise only our own words ("you" → "You"), never an agent or person name.
    return line.startsWith(T.you + ' ') ? line.charAt(0).toUpperCase() + line.slice(1) : line;
  }

  window.OrcaJText = { describe, detail, mins };
})();
