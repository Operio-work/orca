# Changelog

All notable changes to Free-ORCA. Versions follow [Semantic Versioning](https://semver.org).
The installer pins one panel release and one herdr release together; `free-orca update` moves both.

## [0.1.0] - 2026-11-09

First public release.

### Panel
- Control panel for AI coding agents running in herdr: agent list, live terminals (xterm.js),
  quick replies, new agents in the folders you choose, optional web push alerts.
- Localhost only: binds `127.0.0.1`, answers only to known `Host` names (blocks DNS rebinding),
  requires a same-origin `Origin` on every change (blocks CSRF), and asks for a confirmation
  before opening a shell.
- Routines tab: install, schedule (plain-language picker, cron under Advanced, or on demand),
  run now, and approve or reject drafts. In-process scheduler; the system crontab is never touched.
  Every run is logged as JSON lines.
- Five free routine packs, off by default, that only read, report or draft:
  Morning Front Desk Brief, Review Reply Desk, Weekly Owner Report, Showing Day Pack,
  Post-Visit Thank-You + Review Ask.
- `free-orca demo [--lang es]`: two fictional businesses with scripted agents, no API spend.

### Installer and CLI
- `install.sh`: Linux (x86_64, arm64) and macOS, no sudo, no Docker. Downloads herdr 0.9.5 and
  this panel release and checks both against sha256 sums pinned in the script.
- systemd user service (Linux) or launchd agent (macOS); `--no-service` to skip.
- `free-orca start | stop | restart | status | update | demo | uninstall | version`.

### Pinned
- herdr 0.9.5 (Apache-2.0), downloaded from its official GitHub release.
