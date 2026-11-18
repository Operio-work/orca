# ORCA

![ORCA demo: the ⋯ More menu, a lead asks for a worker and you approve, the worker reports its result back, and Admin → Tools](docs/readme-demo.gif)

A free, self-hosted control panel for the AI coding agents you run on your own computer
(Claude Code, Codex, Gemini, opencode, local models and others), plus scheduled **routines** whose drafts wait for
your approval. By [Operio](https://make.operio.work). MIT licensed.

ORCA stands for **Orchestrate, Reply, Check, Approve**.

[Español](README.es.md)

- See every agent as a live map: working, idle, done, or waiting on you.
- Read an agent's output, reply to it, answer its questions with one tap, start new agents.
- Phone alerts (optional web push) when an agent finishes or needs you.
- Routines: an agent starts on a schedule with a fixed task and writes a draft or report.
  Nothing is ever sent, posted or emailed for you.
- Saved agents (instructions, skills, tools), teams with a lead, and workers that do one task,
  report back and close themselves.
- MCP tools per agent with write-only secrets, several accounts per agent kind, and the panel in
  English, Spanish, French, Portuguese or Italian.

ORCA **runs on [herdr](https://github.com/herdrdev/herdr)**, the terminal workspace for AI
agents by Can Celik and contributors (Apache-2.0). herdr is not ours: the installer downloads
its official release and checks it. See `THIRD_PARTY_NOTICES.md`.

## Install

Linux (x86_64, arm64) or macOS (Apple silicon, Intel), Node.js 20 or newer. No sudo, no Docker.

```bash
curl -fsSL https://make.operio.work/install.sh | bash
```

Or from a checkout: `git clone https://github.com/operio-work/orca && cd orca && bash install.sh`.

The installer:

- downloads herdr **0.9.5** for your platform and the ORCA panel release, and verifies both
  against sha256 sums in the script (nothing is installed on a mismatch);
- installs the panel to `~/.local/share/operio-orca` and `operio-orca` to `~/.local/bin`;
- installs a systemd user service (Linux) or a launchd agent (macOS) and starts it
  (`--no-service` writes the files without enabling them);
- turns off herdr's background update checks in `~/.config/herdr/config.toml` (a marked block
  it removes again on uninstall). herdr is pinned: use `operio-orca update`, not `herdr update`,
  so herdr and the panel always move together.

It is safe to run again. Then open **http://127.0.0.1:7171**.

```
operio-orca start | stop | restart | status | open | doctor | logs | update | backup | restore | llm | uninstall
```

Why `operio-orca` and not `orca`? Ubuntu and many Linux desktops already ship `/usr/bin/orca`,
the GNOME screen reader. A distinct name keeps the two apart.

**Windows (WSL2):** install Ubuntu (`wsl --install -d Ubuntu` in PowerShell as administrator),
then run the same line inside Ubuntu. New WSL2 installs have systemd off, so the installer starts
ORCA by hand and prints the recipe that makes it start with Ubuntu: `[boot] systemd=true` in
`/etc/wsl.conf`, `wsl --shutdown` from PowerShell, then the install line once more.

## Use it from your phone

ORCA listens on `127.0.0.1` only. Keep it that way and reach it through one of these:

- **Tailscale** (private network, HTTPS): `tailscale serve --bg 7171`, then put the name it
  prints in `~/.config/operio-orca/env` as `OPERIO_ORCA_ALLOWED_HOSTS=<machine>.<tailnet>.ts.net`
  and run `operio-orca restart`. Web push alerts need HTTPS, so this is the way to get them.
- **SSH tunnel**: `ssh -N -L 7171:127.0.0.1:7171 you@this-computer`, then open
  `http://127.0.0.1:7171` on the device the tunnel runs on.

Never expose it to the internet: no port forwarding, no Tailscale Funnel.

## Security model

ORCA can type into your agents and open shells **as you**. There is no login. What keeps
it safe is that only you can reach it:

- It binds to `127.0.0.1`. `OPERIO_ORCA_HOST` changes that; the server then prints a loud
  warning, and you should not do it on a network you don't fully trust.
- It answers only to `localhost`, `127.0.0.1`, `[::1]` and the names in
  `OPERIO_ORCA_ALLOWED_HOSTS`; any other `Host` gets `421`. This blocks DNS-rebinding attacks.
- Every request that changes something needs a same-origin `Origin` header, which blocks
  other websites from posting to it (CSRF).
- Opening or creating a shell asks for a confirmation first, which lasts 15 minutes.
- Settings, API keys (`llm.env`), VAPID keys, state and logs live in `~/.config/operio-orca` with
  owner-only permissions. Agent prompts and replies are never written to the log. The Journal
  keeps what you sent and what agents answered, with keys and tokens redacted before anything
  is written, for 90 days.

Anyone with access to your user account, or to a device you tunnel from, can use it.

## Routines

A routine pack is a folder with a `routine.json` in `~/.config/operio-orca/routines/<id>/`:

```json
{
  "id": "review-reply-desk",
  "name": { "en": "Review Reply Desk", "es": "Respuestas a reseñas" },
  "problem": { "en": "Reviews sit unanswered…", "es": "Las reseñas se quedan sin respuesta…" },
  "prompt": "What the agent should do…",
  "schedule": "0 9 * * *",
  "approval": "draft",
  "agent": "claude",
  "cwd": "~"
}
```

- `schedule` is a 5-field cron line in the computer's local time. The scheduler runs inside
  ORCA; your system crontab is never touched. Runs missed while it was stopped are skipped.
  In the **Routines** tab you change it in plain words (every day, Mon–Fri, Mon–Sat, one day a
  week or every hour, at a time); the cron line stays under **Advanced** for anything else.
  Leave `schedule` out for an **on-demand** routine: the tab shows it as "On demand" and it runs
  only when you press **Run now**.
- `approval: "draft"` routines write to `~/.config/operio-orca/drafts/<id>/`, and the draft waits
  in the **Routines** tab until you approve or reject it. Approving only marks it approved.
  `"none"` routines write a report to `~/.config/operio-orca/reports/<id>/`.
- `agent` is `claude`, `codex` or `opencode` (installed and signed in by you).
- `tools` (optional, Claude only) lists Admin → Tools ids the run gets, e.g. `["web-browser"]`. A tool
  that is not set up is left out, so the prompt says what to write without it.
- Each run starts an agent pane in herdr, so you can watch it, answer its questions (for
  example, permission to write the file) or stop it like any other agent.
- Every run is logged as JSON lines (input, output path, state) in `~/.config/operio-orca/logs/routines.jsonl`.

Six packs ship turned off. They read files you drop in `~/orca-desk/` (one reads your website and
Google listing with the web browser) and never send anything to your customers: they report, or
they draft and you send.

| Pack | Runs | Output |
|---|---|---|
| Morning Front Desk Brief | Mon–Sat 07:30 | report |
| Review Reply Desk | every day 09:00 | draft replies, you post them |
| Weekly Owner Report | Monday 08:00 | report |
| Showing Day Pack (real estate) | on demand | report: route, property sheets, checklist |
| Post-Visit Thank-You + Review Ask | every day 18:00 | draft messages with a WhatsApp link you tap to send |
| Website & Google Profile Check | Monday 09:00 | report: differences, broken links, top 3 fixes (needs the web browser) |

The full list, including the routines Operio runs for you, is in `catalog/catalog.json`.

## Stop, End and the Journal

- **Stop** (on a working agent's card) interrupts the job; the agent stays. It sends Esc, plus one
  ⌃C for Claude if it is still working. opencode only ever gets Esc, because ⌃C quits it.
- **End** (in the card's ⋯ panel) first shows what would be lost: uncommitted changes in its
  folder, a worktree, links to other agents, the last pane of a workspace. Then it saves the
  agent's last output, asks it to quit with its own command (`/exit`, `/quit`), and closes its
  pane. Its folder, files and worktree are never touched.
- The **Journal** (book icon in the header) is a timeline of what you and your agents did:
  agents started and ended, messages, answers, finished jobs with their saved output, links and
  shell confirmations. Filter it, search it, export a day as Markdown. The **Daily review** tab
  sums up each finished day so you can mark it reviewed with a note; the icon shows how many
  days wait. The card's ⋯ panel has the same history for one agent.
- It is plain files in `~/.config/operio-orca/journal/` (owner-only): one JSON line per entry,
  keys and tokens redacted before they are written. Days older than 7 are compressed, older
  than 90 deleted. Nothing is sent anywhere and no model is called; the review is a summary
  ORCA builds from the entries.

## Saved agents, teams and workers

- **Saved agents** (Admin → Agents & accounts, or the Saved agents button): an agent set up once —
  instructions, skills, built-in tools (all / no edit tools / read only), MCP tools, which account
  it runs on. **Start** it any time; **Resume** continues a Claude agent's last conversation. One
  live copy per saved agent. Files per run live in `~/.config/operio-orca/runs/<name>` (0600).
- **Teams**: a saved agent can *report to* a lead (two levels at most: a lead reports to no one).
  When both run, ORCA links them; a member's finished job is offered to the lead as a hand-off.
  Agents see their team with `orca-send --team`.
- **Workers**: a setup of type *worker* starts with a task, sends its final reply to its lead (or
  to you) and closes itself, or stops at its time limit. A lead asks for one with
  `orca-send --spawn <setup> "task"`; you approve it first. At most six run at once.
- **Tools (MCP)**: Admin → Tools registers MCP servers (a local command or an HTTPS URL). Put
  `${NAME}` where a key belongs and set NAME under Secrets: values are kept in a 0600 file and never
  shown again, and each Claude agent gets only its own servers and their secrets. A server you add
  runs with your rights on this computer: add only ones you trust.
- **Web browser** (off until you turn it on): `operio-orca browser on` lets agents open web pages,
  read them and take screenshots with the Chrome, Chromium, Edge or Brave on this computer, in its
  own profile (never your everyday browser, logins or passwords). It shows up in Admin → Tools;
  give it to a saved agent like any tool. Read only until you allow form filling (`browser forms on`):
  then agents can type and click, and every click on a button or link, or any submit, waits for your
  approval on a card in the panel (page, fields, screenshot). Payment details are never typed. Addresses on
  this computer or your network are refused, page text is marked as data, not instructions, and
  every page opened goes to the Journal. `browser off | forms on|off | reset | status | test URL`, or the *Web browser*
  card in Admin → Tools. A saved agent can be limited to a few sites (e.g. `example.com`).
- **Accounts**: several logins per agent kind — Claude and Codex in their own config folders, and
  Google API keys for Gemini and Antigravity.
- **Local models**: the *Local (Ollama)* agent runs a tool-capable model from Ollama through
  opencode. It is slow on small GPUs.

## Settings

`~/.config/operio-orca/env`, one `KEY=value` per line: `OPERIO_ORCA_PORT` (7171),
`OPERIO_ORCA_HOST` (127.0.0.1), `OPERIO_ORCA_ALLOWED_HOSTS`, `OPERIO_ORCA_FOLDERS` (folders offered
for new agents, default `~`), `OPERIO_ORCA_SHELL_CONFIRM_MIN` (15), `OPERIO_ORCA_JOURNAL_DAYS` (90).

## LLM keys and subscriptions

Each agent needs a model. The four ORCA knows (Claude Code, Codex, opencode, Gemini CLI) take
either a **subscription login** or an **API key**:

- **Subscription**: sign in once, inside the agent's own terminal on this computer (`claude`
  then `/login`; `codex login`; `opencode auth login`; `gemini` and pick its sign-in). The agent
  keeps that session itself; ORCA stores nothing.
- **API key**: `operio-orca llm set ANTHROPIC_API_KEY`. The value is typed at a hidden prompt, or
  piped in (`printf '%s' "$KEY" | operio-orca llm set OPENAI_API_KEY`); it is never a command-line
  argument, so it stays out of your shell history. Use the name the agent reads:
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `GEMINI_API_KEY`, or any other.

Keys live in `~/.config/operio-orca/llm.env`, one `NAME=value` per line, mode 600. Every way herdr
starts loads that file into its environment (the systemd units through `EnvironmentFile=`, the
launchd agents, `operio-orca start`), and agents run inside herdr, so every agent sees them.

- `operio-orca llm list`: the names set, each with its last 4 characters. `llm unset NAME` removes one.
- `operio-orca llm apply`: restarts herdr so a running herdr picks the keys up. A restart ends every
  agent pane, so it refuses, naming them, while any agent is working or waiting on you; idle
  agents are closed and you start them again. Without a service (started by hand) it restarts the
  herdr ORCA started; a herdr you started yourself is left alone and it tells you.
- `operio-orca llm test claude|codex|opencode|gemini`: runs that agent once, in an empty folder,
  with the keys loaded and a tiny prompt; prints `ok` or `failed: <last error line>`, never the key.
  `not installed: <kind>` when the CLI is missing.
- `operio-orca doctor` shows the file's mode and the names set. The panel has the same under the
  key icon in the header (add, remove, Apply). The Journal redacts key values by name and shape.

Existing installs: `operio-orca update` (or running the installer again) rewrites the service
files with the `EnvironmentFile=` line.

## Demo

`operio-orca demo` starts a second panel on **http://127.0.0.1:7172** with two fictional
businesses, Harbor Street Bistro and Brightside Dental, that you switch between at the top.
Their agents are scripted: each one works, stops to ask you something (answer with a tap or a
reply, and the next lines change with your answer), finishes, and starts again. No API spend,
no real data, and it never touches herdr, your agents or `~/.config/operio-orca` (it lives in
`~/.config/operio-orca-demo`). The Routines tab has example packs, run history and a draft
waiting for approval for each business.

```
operio-orca demo              start it (the agents start from the top)
operio-orca demo --reset      start over: routines, drafts and history too
operio-orca demo --speed 2    play the script twice as fast
operio-orca demo --lang es    play it in Spanish (agents, routines, drafts; stays until changed)
operio-orca demo --stop       stop it
```

Screenshots are in `demo/screenshots/` (Spanish: `demo/screenshots/es/`).

## Check, logs, backup

`operio-orca doctor` checks Node, herdr, the port, the service, file permissions and settings,
prints the exact fix under anything wrong and exits 1 if there is one; send its output with any
support request. `operio-orca open` opens the panel in your browser.

`operio-orca logs` shows the panel log (`logs herdr`, `logs routines`; `-n 200`, `-f` to follow).
`operio-orca update --check` only compares the installed panel and herdr with the versions the
installer pins, installs nothing, and exits 2 when an update is available.

`operio-orca backup [FILE]` writes a `0600` tar.gz of `~/.config/operio-orca` (settings, routines,
drafts, journal, push keys; not the logs). `operio-orca restore FILE` puts it back, here or on
another computer: stop the panel first, the current folder is kept as
`~/.config/operio-orca.before-restore-<stamp>`, and the service files and herdr are not touched.

## Uninstall

`operio-orca uninstall` (add `--purge` to also delete `~/.config/operio-orca`). It never stops your
herdr server or your agents.

## Development

```bash
npm install
npm test
OPERIO_ORCA_PORT=7172 node server.js
```

Releases: `scripts/release.sh` builds `dist/operio-orca-<version>.tar.gz` reproducibly from the
`v<version>` tag (or HEAD); pin its sha256 in `install.sh` as `PANEL_SHA256`. The website build
(`site/`) ships that tarball under `/releases/` and fails if the pin does not match. See
`CHANGELOG.md`, `CONTRIBUTING.md` and `SECURITY.md`.

## Want it run for you?

ORCA is the free, do-it-yourself version. If you'd rather have Operio run it for you,
**ORCA Managed by Operio** runs your AI operations team (WhatsApp, Google Business Profile, bilingual routines, approvals and
monitoring), see [make.operio.work](https://make.operio.work).

Managed ORCA also comes with a **team chat**: comments on each agent, one room for the whole
team, alerts when someone mentions you, and agents brought into the conversation (write
`@reviews shorten the intro` and the answer comes back in the thread). Messages can be
translated between English and Spanish. To see it in the demo:
`OPERIO_ORCA_HOSTED=1 operio-orca demo --reset`.

## License

MIT, Copyright (c) 2026 Operio. herdr and the other components keep their own licenses; see
`THIRD_PARTY_NOTICES.md`.
