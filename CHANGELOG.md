# Changelog

All notable changes to ORCA. Versions follow [Semantic Versioning](https://semver.org).
The installer pins one panel release and one herdr release together; `operio-orca update` moves both.

## [Unreleased]

### Panel
- **Team chat (ORCA Host only, off in the free panel):** a thread on every agent and one team
  room, unread badges, @mentions with alerts, and `@agent` to send a message to an agent as work
  (with the thread's recent messages); the answer is posted back. Limits: 5 requests per person
  and per agent an hour, 5 waiting per agent. EN ⇄ ES translation of messages with Claude Haiku
  5.5 (`ANTHROPIC_API_KEY`) or a local Ollama model. On when `OPERIO_ORCA_HOSTED=1`; settings
  `OPERIO_ORCA_TRANSLATE` (anthropic | ollama | off), `OPERIO_ORCA_TRANSLATE_MODEL`,
  `OPERIO_ORCA_TRANSLATE_URL`, `OPERIO_ORCA_CHAT_ASKS_PERSON`, `OPERIO_ORCA_CHAT_ASKS_AGENT`,
  `OPERIO_ORCA_CHAT_QUEUE`. The demo seeds a chat for both businesses when run that way.
  `chat.prompt` entries in the Journal. Adds the `@anthropic-ai/sdk` dependency.
- **People on a hosted panel:** ORCA Host signs who each request is from (`X-Orca-User`, HMAC with
  `OPERIO_ORCA_IDENTITY_SECRET`, lib/identity.js); the panel trusts nothing else. Names show in the
  chat, claims and Journal. Viewers comment in the chat and turn alerts on, nothing more; Operio
  staff read a client's chat only when the client allows it. Translation can go through ORCA Host
  (`OPERIO_ORCA_TRANSLATE=relay`, signed requests to `OPERIO_ORCA_TRANSLATE_URL`), so no model key
  sits on the client's machine; `OPERIO_ORCA_TRANSLATE_KEY` for a direct key. Both secrets are
  removed from the environment the agents inherit. Alerts open the right page under a proxy prefix.
- `/api/meta` reports the panel `version`.
- **Map:** every card keeps room for its name and status (a busy map scrolls instead of
  clipping); a hover card on desktop shows the task, last reply, agent and model, folder, jobs
  and context; skeleton boxes while the first answer loads, and a loader while an agent's
  conversation is read.
- **Drag and drop on the map:** drag a card (long-press on a phone) beside a card of another tab,
  onto a card of the same tab to swap, onto a tab to add it there, or onto the bar at the bottom
  for a new tab or a new workspace. Shells move too. `POST /api/agents/:pane/move` gains the
  modes `beside` and `swap`.
- **Reorder the map:** drag a tab box by its header. herdr can't reorder tabs, so this is ORCA's
  own order (`POST /api/map/order`); the desktop keeps its own.
- **Rename workspaces and tabs** from the pencil on a box header (`POST /api/workspaces/:id/rename`,
  `POST /api/tabs/:id/rename`); herdr renames them, so the desktop shows the same names.
- **New agent:** agent cards, a starting model for Claude, folder chips; remembers your last pick.
  The view button names the current view; the phone header no longer overlaps.
- **Office view is now a tower:** one floor per workspace in map order, a lift that comes to the
  floor you hover and carries agents that arrive, leave or move floors, a cheer and a ✓ when a
  job finishes, a red room and roof flag when one needs you, and a sky that follows your clock.
- Switch a Claude agent's model from its card: ⋯ → Model (Fable, Opus, Sonnet, Haiku). Works while
  the agent is idle; the choice is remembered and written to the Journal.
- Fixed: on a card that needs you, the "other" answer field lost the cursor on every refresh, so
  you could not finish typing. The answers are now redrawn only when the question changes.
- An agent's full history is read once per state change; while nothing changed, polls read only
  its screen. Stops full-screen agents (Claude Code) from visibly scrolling their transcript
  in the terminal on every poll.
- **LLM keys** (key icon in the header): add or remove API keys for your agents
  (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, …) and **Apply** to restart herdr so
  they get them; refused, naming the agents, while one is working or asking you. Endpoints
  `GET /api/llm` (names and last 4 characters only), `POST /api/llm/set | unset | apply`
  (same-origin, localhost). Values never come back and never reach the log; the Journal
  redacts key values by name (`*_API_KEY`, `*_TOKEN`, `*_SECRET`) and by shape (`sk-…`,
  `AIza…`, `gsk_…`).

### Install
- Both service files load the agents' API keys from `~/.config/operio-orca/llm.env`: the systemd
  units through `EnvironmentFile=-%h/.config/operio-orca/llm.env`, the launchd agents through
  `/bin/sh -c 'set -a; . llm.env; set +a; exec …'`. Agents run inside herdr, so every agent sees
  them. **Existing installs get the new service files with `operio-orca update`** (or by running
  the installer again); until then the keys load only through `operio-orca start`.
- Without a systemd user session (Ubuntu under WSL2 before systemd is turned on, containers), the
  installer now starts the panel by hand so the install ends with it running, and on WSL prints the
  recipe that makes ORCA start with Ubuntu (`[boot] systemd=true` in `/etc/wsl.conf`,
  `wsl --shutdown`, install again). `operio-orca status` says "service: none (started by hand)".

### CLI
- `operio-orca doctor`: one line per check (Node, panel files, herdr, port, service, file modes,
  settings, disk) with the exact fix under every ✗; exit 1 when something is wrong.
  `operio-orca open` opens the panel in the browser (xdg-open, open, or wslview/explorer.exe on WSL).
- `operio-orca logs [panel|herdr|routines] [-n N] [-f]` tails the right log (journalctl when systemd
  runs the panel); routine runs are printed one per line. `operio-orca update --check` compares the
  installed panel and herdr with the installer's pins, installs nothing, exits 2 when behind.
- `operio-orca update` no longer ends with "tmp: unbound variable" (exit 1) after a successful
  update: the temp folder's cleanup ran after the function's variable was gone.
- `operio-orca backup [FILE]` writes a mode-600 tar.gz of `~/.config/operio-orca` (settings,
  routines, drafts, journal, push keys; not the logs). `operio-orca restore FILE` puts it back with
  the panel stopped (or `--force`), keeps the current folder as `…before-restore-<stamp>`, restores
  700/600 modes and never touches the service files or herdr.
- `operio-orca llm set NAME | unset NAME | list | apply | test KIND`: API keys for the agents in
  `~/.config/operio-orca/llm.env` (`NAME=value`, mode 600). `set` takes the value from a hidden
  prompt or stdin, never an argument; `list` shows names and the last 4 characters; `apply`
  restarts herdr only when no agent is working or waiting on you (systemd restart, launchd
  kickstart, or by the pid of the herdr ORCA started by hand); `test claude|codex|opencode|gemini`
  runs that agent once with the keys loaded and prints `ok` or the last stderr line, redacted.
  `operio-orca start` and `run` load the file before starting herdr and the panel; `doctor` shows
  its mode and the names set (✗ with the fix when the mode is not 600). `OPERIO_ORCA_HERDR_BIN`
  now also names the herdr the CLI talks to. Subscription logins stay the agents' own (sign in
  inside the agent's terminal); ORCA stores nothing for them.
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

### Installer and CLI
- `install.sh`: Linux (x86_64, arm64) and macOS, no sudo, no Docker. Downloads herdr 0.9.5 and
  this panel release and checks both against sha256 sums pinned in the script.
- systemd user service (Linux) or launchd agent (macOS); `--no-service` to skip.
- `operio-orca start | stop | restart | status | update | demo | uninstall | version`.

### Pinned
- herdr 0.9.5 (Apache-2.0), downloaded from its official GitHub release.
