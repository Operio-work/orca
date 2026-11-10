# Changelog

All notable changes to ORCA. Versions follow [Semantic Versioning](https://semver.org).
The installer pins one panel release and one herdr release together; `operio-orca update` moves both.

## [Unreleased]

### Panel
- **Stop** on a working agent's card interrupts the job with keys that suit the agent (opencode
  never gets ⌃C, which quits it). **End** shows what would be lost first, saves the agent's last
  output, asks it to quit with its own command and closes its pane; its links and tags go with it.
- **Journal** (`/journal.html`, EN/ES): a local, append-only timeline of what you and your agents
  did, with saved output per finished job, filters, search, Markdown export and a **Daily
  review** of each finished day. Files in `~/.config/operio-orca/journal/` (0600), secrets
  redacted before writing, gzip after 7 days, deleted after 90 (`OPERIO_ORCA_JOURNAL_DAYS`).
  No model or outside service is involved.
- The card's output is always open, with a **Reader** view (your messages as bubbles, replies
  as prose, tool work folded) and the raw **Terminal**; the choice is remembered per device.
  Links and a per-agent History move into the ⋯ panel.
- Deeper card history: reads up to 1000 lines, keeps what it already showed when herdr answers
  a short read (and retries it), and holds your scroll position while new lines arrive.
- Demo: End and Stop work on the scripted agents; an ended agent stays gone until `--reset`.

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
- `operio-orca demo [--lang es]`: two fictional businesses with scripted agents, no API spend.

### Installer and CLI
- `install.sh`: Linux (x86_64, arm64) and macOS, no sudo, no Docker. Downloads herdr 0.9.5 and
  this panel release and checks both against sha256 sums pinned in the script.
- systemd user service (Linux) or launchd agent (macOS); `--no-service` to skip.
- `operio-orca start | stop | restart | status | update | demo | uninstall | version`.

### Pinned
- herdr 0.9.5 (Apache-2.0), downloaded from its official GitHub release.
