# Changelog

All notable changes to ORCA. Versions follow [Semantic Versioning](https://semver.org).
The installer pins one panel release and one herdr release together; `operio-orca update` moves both.

## [0.7.1] - 2026-11-21

### Fixed
- Putting an agent to sleep while it ran a command no longer adds a "Stopped" line to that
  command's output.

## [0.7.0] - 2026-11-21

### Added
- **Put an agent to sleep.** Every agent has Sleep now, 15m and 1h. A sleeping agent is paused:
  it uses no CPU and no tokens, and its window stays as it was. Sleeping agents show in their own
  zone: a Sleeping section on the Map, the Waiting Room floor in the Office and the shore on the
  Island, with how long they have slept and a countdown when a wake time is set.
- **Wake and Finish.** Wake picks up where the agent stopped (it is nudged only if it was working
  when it went to sleep and has since stalled). Finish ends the job, with a second tap to confirm.
  Wake times survive a panel restart.

### Fixed
- The Island and Holo clocks showed nothing in some languages (an error on every frame).

## [0.6.2] - 2026-11-20

### Changed
- OpenCode and Ollama agents can use the transcript Reader, including exact replies, unanswered
  questions, permission choices and session token totals. Older Node versions keep the screen Reader.

## [0.6.1] - 2026-11-20

### Changed
- **An agent opens full screen on a computer.** Its window now fills the screen (output, recap and
  reply box get all the room) instead of a centred box. Phones are unchanged.

## [0.6.0] - 2026-11-19

### Changed
- **Admin is one full-screen page.** A sidebar groups every area: Overview, Team (People & access,
  Saved agents, Accounts), What agents use (Tools and the web browser, Skills, Knowledge,
  Templates, Routines) and Settings (API keys, Activity, Security). Each area opens in place: no
  more dialogs on top of dialogs. The Overview shows a card with the count for each area. On a
  phone the sidebar is the first screen and Back returns to it. The header buttons (Routines,
  Saved agents, Templates in the message box, API keys) still open the same screens on their own.
- Opening or starting an agent from Saved agents inside Admin closes Admin so the agent shows.
- Templates inside Admin are for managing: a tap edits a template instead of pasting it.

### Fixed
- **Skills and Knowledge could not be opened** from Admin (their buttons did nothing since the
  header buttons were removed).
- Admin → Activity linked to a Usage page that the open-source panel does not have.

## [0.5.2] - 2026-11-19

### Fixed
- **Reader (Claude agents) shows the whole session:** it read only the last 4 MB of the transcript,
  so a long session lost most of its messages and steps. The transcript is now read once and then
  only what was added. Messages typed while the agent was busy show; after a compaction a short
  marker shows instead of the summary as your message; failed or refused steps are marked; folds
  you opened stay open. The panel asks only for new blocks while an agent works.

### Changed
- **No "Explain step N" reply chips** (they were not useful enough). Yes/No, Go, Done, Merged and
  Wrap up stay.
- **Faster, lighter panel:** requests at the same moment share one agent list (any change resets
  it), a pane's shell is looked up once instead of on every agent request, and tab layouts are read
  again only when their panes change (or every 15 s).

## [0.5.1] - 2026-11-18

### Fixed
- **Journal:** a page opened with *Test a page* (or `operio-orca browser test`) showed as "? opened …";
  it now reads "operio-orca browser test opened …".

## [0.5.0] - 2026-11-18

### Web browser
- **`operio-orca browser on | off | reset | status | test URL`:** agents can open web pages, read
  them and take screenshots. Off by default. Uses the Chrome, Chromium, Edge or Brave already on the
  computer (`OPERIO_ORCA_BROWSER_EXECUTABLE` to choose one) in its own profile, always with the
  browser's sandbox; on Linux without one it prints the install line and stops. The engine
  (`@playwright/mcp` 0.0.85, Apache-2.0) installs into `~/.config/operio-orca/browser/engine`.
- **Built-in tool *Web browser*** in Admin → Tools (only `operio-orca browser` can change or remove
  it). In front of the engine ORCA offers only open/read/screenshot/find/wait/tabs, refuses
  `file://`, logins in URLs, this computer, private networks and names that resolve to them, keeps
  file names inside the agent's `runs/<name>/shots` (0600), marks page text as data, and keeps API
  keys out of the browser's environment.
- **Journal:** page opened, address refused, tool refused, asked / approved / declined / expired,
  level changed, browser on/off/reset (EN/ES).
- **Panel:** Admin → Tools has a *Web browser* card: on/off (turning on installs the engine), which
  browser, engine version, which saved agents have it, and *Test a page* with the result. Not shown on
  hosted panels. The generic Tools list no longer offers to edit or remove it.
- **Form filling, each submit approved (`operio-orca browser forms on|off`, or the switch on the card):**
  agents may also type, choose and click. Typing and clicks on form fields go through; every click on
  a button or link, Enter, typing with submit and accepting a page dialog waits for a person. The
  approval card (bottom right, phone alert too) shows the agent, the page, the element *as the page
  names it* next to the agent's description, the fields filled so far (passwords hidden) and a
  screenshot. Answered by the person holding the agent, else an admin; unanswered after 15 minutes =
  nothing sent. Payment fields (card, CVV, expiry, IBAN, CLABE, account numbers) are never typed.
  At most 3 open requests per agent; requests live in memory (a restart answers "gone").
- **Allowed sites per saved agent:** tick *Web browser* and an optional list appears (one site per
  line; `https://www.example.com/menu` is kept as `example.com`, which covers its subdomains).
  Empty = any public site. Checked on every address the agent opens.
- **New free pack *Website & Google Profile Check* (Monday 09:00, report, off until you turn it on):**
  reads `~/orca-desk/business.txt` (name, city, website, Google Maps link, phone, address, hours),
  opens the site (up to 10 internal links) and the Google listing, and writes the differences,
  broken links, out-of-date items and the top 3 fixes. Read only: it never clicks or types.
- **Routines can ask for tools:** optional `"tools": ["web-browser"]` in `routine.json` (Claude only)
  gives the run those Admin → Tools servers. The browser's own tools are pre-allowed for saved agents
  and routines (no per-tool question; ORCA's approval card still guards every submit).
- `operio-orca doctor` reports the browser once it was turned on; `operio-orca backup` leaves out the
  browser engine and its profile (cookies).

### Languages
- **French, Portuguese (Brazil) and Italian packs updated** for everything added since 0.4.0: the
  web browser card and approval cards, allowed sites, worker requests, accounts, tools and secrets in
  the Journal, and the Admin notes. Machine-translated; review pending.

### Fixed
- **Journal:** turning the web browser back on said "read only" even when form filling was kept.
- **`operio-orca browser test`** waited 150 s when the browser engine could not start; it now stops at
  once and says to run `operio-orca browser on`.

### Site
- **Free pack pages** say when a pack reads one file (`~/orca-desk/business.txt`) rather than a folder,
  and add the `operio-orca browser on` step for packs that use the web browser.

## [0.4.2] - 2026-11-18

### Fixed
- **Saved agents started without their setup:** since 0.4.0 a Claude saved agent or worker started
  without its instructions, its built-in tool limit (read only / no edit), its MCP tools and its
  model; it ran as a plain Claude. They now reach Claude again.
- **Local models (Ollama) failed to start** with an error in the panel.

## [0.4.1] - 2026-11-17

### Panel
- **Calmer header:** Admin, API keys, phone alerts, light/dark and language move into a **⋯ More**
  menu; the header keeps New, Routines, Saved agents, Journal, Chat and the view picker.
- **Workers close quietly:** a finished worker no longer sends its lead an "Agent … was ended"
  note. Its message starts with the result ("Worker … finished. Result: …") and keeps the worker's
  name after it is gone (it showed "← ?").
- **Journal:** plain EN/ES sentences for workers, worker requests, saved-agent setups, accounts,
  tools and secrets (they showed raw event names).
- Saved agents: a worker request names the setup, and its card no longer clips Approve / Decline.

### Docs
- README (EN/ES): saved agents, teams, workers, MCP tools, accounts and local models.

## [0.4.0] - 2026-11-17

### Panel
- **Saved agents:** set an agent up once (instructions, skills, tools, which account it runs on)
  and start it from Saved agents; **Resume** continues a Claude agent's last conversation. One
  live copy per saved agent. Claude reads the instructions as part of its system prompt; other
  kinds get them as their first message. Files per run in `~/.config/operio-orca/runs/<name>`.
- **Teams (2 levels):** a new link kind, *reports to*. One lead per agent; a lead reports to no
  one. When both run, ORCA links a saved agent to its lead; a member's finished job is offered to
  the lead as a hand-off. `orca-send --team` lists your lead and members.
- **Workers:** a saved setup of type *worker* starts with a task, sends its final reply to its
  lead (or to you) and closes itself, or stops at its time limit (5–480 min). A lead may ask for
  one with `orca-send --spawn <setup> "task"`; a person approves it first. At most 6 at once.
- **Accounts:** several logins per agent kind — Claude and Codex in their own config folders, and
  Google API keys for Gemini and Antigravity (one key serves both). Keys stay in a 0600 file and
  never come back to the page. Hosted panels: accounts are set up by Operio.
- **New agent kinds:** Gemini (`gemini`) and local models through Ollama (`ollama`, via opencode;
  each model runs as a `<model>-orca` copy with a 20k context).
- **Tools (MCP):** Admin → Tools registers MCP servers (stdio or HTTP) with write-only secrets
  (`${NAME}` templates). A Claude agent gets only its servers and only their secrets
  (`--mcp-config`, optionally `--strict-mcp-config`). Free panel: add your own, with a warning;
  hosted panels: Operio staff only.
- **Admin page** (gear): Agents & accounts, Tools, Skills, Knowledge, Templates, Activity,
  Security. Hosted: people are managed in ORCA Host; client admins set up agents.
- **Agent card:** the Reader reads Claude's own transcript (no garbled screen text, menus as
  buttons on idle agents); the Terminal tab is a live, typeable terminal (confirmation first);
  one mode at a time; compact header.
- **Languages:** French, Portuguese (Brazil) and Italian packs (machine-translated, review in
  progress) besides English and Spanish; a language menu; dates and phone alerts follow it.

## [0.3.0] - 2026-11-16

### Panel
- **Map shows agents talking:** when one agent messages another, a line flows between their
  cards, a badge counts the last 24 hours and a dot marks each new message. The server sends
  counts and times only; the message text stays behind the usual permission check.
- **Prompt templates:** a button in the agent's prompt box (key **T**) opens your templates.
  Search, pick, and the text fills in at the cursor with the first `{placeholder}` selected so you
  can type over it. Nothing is sent until you press Send. Free panel: your own templates (Mine).
  ORCA Host adds Company templates (admins edit) and Operio's read-only EN/ES library, which
  ORCA Host writes to `operio-templates.json` (re-read on change, no restart).
- **Skills:** a Skills dialog in the header. The free panel ships three read/draft-only skills
  (Review reply drafts, Weekly owner summary, Bilingual message polish) with Install / Remove.
  A skill is a `SKILL.md` folder in `~/.config/operio-orca/skills/<key>`, linked into
  `~/.claude/skills` and listed in a managed block in `~/.codex/AGENTS.md` and
  `~/.gemini/GEMINI.md` when those folders exist. ORCA never replaces a link, folder or text that
  isn't its own. Limits: 20 files, 256 KB, relative paths only. On ORCA Host the dialog shows
  Operio's gallery and a client admin requests a skill; Operio approves and installs it.
  Journal: `skill.install`, `skill.remove`. `uninstall --purge` removes ORCA's links and blocks.
- **Knowledge for agents:** a Knowledge dialog in the header. Put the business's documents in
  `~/.config/operio-orca/knowledge` (a first-level folder is a collection): md, txt, csv, json,
  html and pdf (needs `pdftotext`, from poppler-utils; without it PDFs are skipped with the
  reason). Up to 5 MB a file and 2,000 files. Search is keyword ranking (BM25) in plain
  JavaScript, re-indexing only what changed. Upload, remove, test a search and see the status
  from the dialog. Journal `kb.add` / `kb.remove` keep the path and size, never the content.
  The first indexed document installs the bundled **business-knowledge** skill, which tells
  agents to look things up with `operio-orca kb search` before stating a fact about the business.
  Hosted panels with `VOYAGE_API_KEY` or `OPENAI_API_KEY` in `llm.env` also rank by meaning
  (hybrid); any failure falls back to keyword results with a note. The free panel is keyword only.
- **Per-agent knowledge access:** limit a collection to some agents by name or tag
  (`kb-access.json`, mode 600); no entry means every agent. "Search as" previews what one agent
  would find. This scopes search results; it is not a security wall.
- **Team chat (ORCA Host):** messages and hand-offs between agents now show in both agents'
  threads, posted as the sending agent and marked `→ receiver`. They are never read for
  `@mentions`, so agents can't set each other off in a loop.
- Phone header: icon buttons slimmed to fit at 360 px.

### CLI
- `operio-orca kb search "question" [-n 5] [--collection NAME] [--json]`, `kb add PATH`,
  `kb remove`, `kb list`, `kb status`, `kb reindex`. Give `-` (or nothing) as the question to read
  it from stdin, so it never sits on a command line; `kb add` reads the file on stdin.
- `operio-orca skills install|remove KEY|list|catalog-set` and
  `operio-orca templates set|show|clear`: used by ORCA Host. JSON is read on stdin, never from
  arguments, and a bad catalogue or library never replaces the good one.

## [0.2.0] - 2026-11-15

### Panel
- **Team chat (ORCA Host only, off in the free panel):** a thread on every agent and one team
  room, unread badges, @mentions with alerts, and `@agent` to send a message to an agent as work
  (with the thread's recent messages); the answer is posted back. Limits: 5 requests per person
  and per agent an hour, 5 waiting per agent. EN ⇄ ES translation of messages with Claude Haiku
  5.5 on the client's own key (`ANTHROPIC_API_KEY` in llm.env, read on each use; no key = no
  Translate links) or a local Ollama model. On when `OPERIO_ORCA_HOSTED=1`; settings
  `OPERIO_ORCA_TRANSLATE` (anthropic | ollama | off), `OPERIO_ORCA_TRANSLATE_MODEL`,
  `OPERIO_ORCA_TRANSLATE_URL`, `OPERIO_ORCA_CHAT_ASKS_PERSON`, `OPERIO_ORCA_CHAT_ASKS_AGENT`,
  `OPERIO_ORCA_CHAT_QUEUE`. The demo seeds a chat for both businesses when run that way.
  `chat.prompt` entries in the Journal. Adds the `@anthropic-ai/sdk` dependency.
- **People on a hosted panel:** ORCA Host signs who each request is from (`X-Orca-User`, HMAC with
  `OPERIO_ORCA_IDENTITY_SECRET`, lib/identity.js); the panel trusts nothing else. Names show in the
  chat, claims and Journal. Viewers comment in the chat and turn alerts on, nothing more; Operio
  staff read a client's chat only when the client allows it. `OPERIO_ORCA_TRANSLATE_KEY` overrides the
  translation key. Both secrets are removed from the environment the agents inherit. Alerts open the right page under a proxy prefix.
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
- **New icon and header:** the Node Fin mark (Operio's nodes form the fin) as the app icon and
  favicon; the header reads ORCA · by Operio (EN/ES).
- Phone header: the buttons sit on their own row so the name is never covered; Routines is
  icon-only below 600 px, New below 380 px.
- Fixed: moving an agent while a tab was zoomed did nothing but reported success. The tabs
  involved are unzoomed first, the source tab re-zoomed afterwards, and `move_failed` is returned
  when herdr leaves the pane in place.

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
