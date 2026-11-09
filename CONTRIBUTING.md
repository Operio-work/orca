# Contributing

Thanks for helping. Free-ORCA is small on purpose; open an issue before a large change so we
can agree on the shape first.

- **Bugs and ideas:** open an issue with the template. Security problems: see `SECURITY.md`.
- **Setup:** Node.js 20+, then `npm install`, `npm test`, `FREE_ORCA_PORT=7172 node server.js`.
  The website lives in `site/` (`cd site && npm install && npm run build`).
- **Pull requests:** one change per PR, tests green (`npm test`), shell scripts clean under
  `shellcheck -S warning`. Plain Node, no build step and no new runtime dependencies without
  a discussion first.
- **Routine packs:** a folder with a `routine.json` (see the README). Free packs only read,
  report or draft; they never send messages or post anything for the business.
- **Licenses:** contributions are under the MIT license. If you add or update a dependency or a
  vendored file, run `node scripts/notices.js` so `THIRD_PARTY_NOTICES.md` stays complete.
- **Never commit** keys, tokens, real customer data or personal paths.
