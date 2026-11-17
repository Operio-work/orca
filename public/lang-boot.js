'use strict';
// Languages. English and Spanish are built into each page; the others are packs in
// /i18n/<lang>.js that set window.ORCA_I18N. This runs before the page scripts (classic, not
// deferred) and writes the chosen pack's <script> in, so it is loaded before they run.
// Also: a small language menu every page uses for its language chip.
(() => {
  const PACKS = ['fr', 'pt', 'it'];
  const NAMES = { en: 'English', es: 'Español', fr: 'Français', pt: 'Português', it: 'Italiano' };
  const LOCALES = { en: 'en-US', es: 'es-MX', fr: 'fr-CA', pt: 'pt-BR', it: 'it-IT' };
  let l = null;
  try { l = localStorage.getItem('herdr-lang'); } catch { /* storage off */ }
  l = l || (navigator.language || 'en').slice(0, 2);
  if (PACKS.includes(l)) document.write(`<script src="/i18n/${l}.js"><\/script>`);
  window.ORCA_LANGS = ['en', 'es', ...PACKS];
  window.orcaLocale = lang => LOCALES[lang] || 'en-US';

  // The chip opens a list; picking a language saves it, runs `before` (e.g. update phone
  // alerts) and reloads, so the right pack is loaded from the start.
  window.orcaLangMenu = (btn, current, before) => {
    // A chip shows the code; a menu row (the ⋯ More menu) keeps its label and shows the code beside it.
    (btn.querySelector('.mm-code') || btn).textContent = current.toUpperCase();
    btn.setAttribute('aria-haspopup', 'true');
    if (!btn.querySelector('.mm-code')) btn.setAttribute('aria-label', NAMES[current] || current);
    let menu = null;
    const shut = () => { menu?.remove(); menu = null; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (menu) return shut();
      menu = document.createElement('div');
      menu.className = 'lang-menu';
      menu.setAttribute('role', 'menu');
      for (const code of window.ORCA_LANGS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitemradio');
        b.setAttribute('aria-checked', String(code === current));
        b.textContent = NAMES[code];
        b.addEventListener('click', async () => {
          shut();
          if (code === current) return;
          try { localStorage.setItem('herdr-lang', code); } catch { /* storage off */ }
          try { if (before) await before(code); } catch { /* best effort */ }
          location.reload();
        });
        menu.append(b);
      }
      const r = btn.getBoundingClientRect();
      menu.style.top = `${r.bottom + 6}px`;
      menu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
      document.body.append(menu);
      btn.setAttribute('aria-expanded', 'true');
      menu.querySelector('[aria-checked="true"]')?.focus();
    });
    addEventListener('click', e => { if (menu && !menu.contains(e.target)) shut(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && menu) { shut(); btn.focus(); } });
  };
})();
