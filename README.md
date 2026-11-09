# Free-ORCA

A free, self-hosted control panel for the AI coding agents you run on your own computer
(Claude Code, Codex, opencode and others), plus scheduled **routines** whose drafts wait for
your approval. By [Operio](https://make.operio.work). MIT licensed.

[Español](README.es.md)

- See every agent as a live map: working, idle, done, or waiting on you.
- Read an agent's output, reply to it, answer its questions with one tap, start new agents.
- Phone alerts (optional web push) when an agent finishes or needs you.
- Routines: an agent starts on a schedule with a fixed task and writes a draft or report.
  Nothing is ever sent, posted or emailed for you.

Free-ORCA **runs on [herdr](https://github.com/herdrdev/herdr)**, the terminal workspace for AI
agents by Can Celik and contributors (Apache-2.0). herdr is not ours: the installer downloads
its official release and checks it. See `THIRD_PARTY_NOTICES.md`.

## Install

Linux (x86_64, arm64) or macOS (Apple silicon, Intel), Node.js 20 or newer. No sudo, no Docker.

```bash
git clone <this repository> free-orca && cd free-orca
bash install.sh
```

(`curl -fsSL https://make.operio.work/install.sh | bash` once the first release is published.)

The installer:

- downloads herdr **0.9.5** for your platform and verifies its sha256 against checksums in the script;
- installs the panel to `~/.local/share/free-orca` and `free-orca` to `~/.local/bin`;
- installs a systemd user service (Linux) or a launchd agent (macOS) and starts it
  (`--no-service` writes the files without enabling them);
- turns off herdr's background update checks in `~/.config/herdr/config.toml` (a marked block
  it removes again on uninstall). herdr is pinned: use `free-orca update`, not `herdr update`,
  so herdr and the panel always move together.

It is safe to run again. Then open **http://127.0.0.1:7171**.

```
free-orca start | stop | restart | status | update | uninstall
```

## Use it from your phone

Free-ORCA listens on `127.0.0.1` only. Keep it that way and reach it through one of these:

- **Tailscale** (private network, HTTPS): `tailscale serve --bg 7171`, then put the name it
  prints in `~/.config/free-orca/env` as `FREE_ORCA_ALLOWED_HOSTS=<machine>.<tailnet>.ts.net`
  and run `free-orca restart`. Web push alerts need HTTPS, so this is the way to get them.
- **SSH tunnel**: `ssh -N -L 7171:127.0.0.1:7171 you@this-computer`, then open
  `http://127.0.0.1:7171` on the device the tunnel runs on.

Never expose it to the internet: no port forwarding, no Tailscale Funnel.

## Security model

Free-ORCA can type into your agents and open shells **as you**. There is no login. What keeps
it safe is that only you can reach it:

- It binds to `127.0.0.1`. `FREE_ORCA_HOST` changes that; the server then prints a loud
  warning, and you should not do it on a network you don't fully trust.
- It answers only to `localhost`, `127.0.0.1`, `[::1]` and the names in
  `FREE_ORCA_ALLOWED_HOSTS`; any other `Host` gets `421`. This blocks DNS-rebinding attacks.
- Every request that changes something needs a same-origin `Origin` header, which blocks
  other websites from posting to it (CSRF).
- Opening or creating a shell asks for a confirmation first, which lasts 15 minutes.
- Settings, VAPID keys, state and logs live in `~/.config/free-orca` with owner-only permissions.
  Agent prompts and replies are never written to the log.

Anyone with access to your user account, or to a device you tunnel from, can use it.

## Routines

A routine pack is a folder with a `routine.json` in `~/.config/free-orca/routines/<id>/`:

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
  Free-ORCA; your system crontab is never touched. Runs missed while it was stopped are skipped.
  In the **Routines** tab you change it in plain words (every day, Mon–Fri, Mon–Sat, one day a
  week or every hour, at a time); the cron line stays under **Advanced** for anything else.
- `approval: "draft"` routines write to `~/.config/free-orca/drafts/<id>/`, and the draft waits
  in the **Routines** tab until you approve or reject it. Approving only marks it approved.
  `"none"` routines write a report to `~/.config/free-orca/reports/<id>/`.
- `agent` is `claude`, `codex` or `opencode` (installed and signed in by you).
- Each run starts an agent pane in herdr, so you can watch it, answer its questions (for
  example, permission to write the file) or stop it like any other agent.
- Every run is logged as JSON lines (input, output path, state) in `~/.config/free-orca/logs/routines.jsonl`.

Three examples ship turned off: Morning Front Desk Brief, Review Reply Desk and Competitor &
Local Watch. They read files you drop in `~/free-orca-desk/`.

## Settings

`~/.config/free-orca/env`, one `KEY=value` per line: `FREE_ORCA_PORT` (7171),
`FREE_ORCA_HOST` (127.0.0.1), `FREE_ORCA_ALLOWED_HOSTS`, `FREE_ORCA_FOLDERS` (folders offered
for new agents, default `~`), `FREE_ORCA_SHELL_CONFIRM_MIN` (15).

## Uninstall

`free-orca uninstall` (add `--purge` to also delete `~/.config/free-orca`). It never stops your
herdr server or your agents.

## Development

```bash
npm install
npm test
FREE_ORCA_PORT=7172 node server.js
```

## Want it run for you?

Free-ORCA is the free, do-it-yourself version. If you'd rather have Operio run your AI
operations team (WhatsApp, Google Business Profile, bilingual routines, approvals and
monitoring), see [make.operio.work](https://make.operio.work).

## License

MIT, Copyright (c) 2026 Operio. herdr and the other components keep their own licenses; see
`THIRD_PARTY_NOTICES.md`.
