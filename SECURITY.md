# Security

## Reporting a problem

Email **hello@operio.work** with "ORCA security" in the subject. Please include the
version (`operio-orca version`), your OS, and the steps to reproduce. Do not open a public
issue for a security problem. We answer within 3 working days and will tell you when a fix ships.

Supported: the latest release only. herdr bugs go to herdr's maintainers
(https://github.com/herdrdev/herdr); tell us too if they affect ORCA.

## The security model

ORCA can type into your agents and open shells **as you**, and it has no login. It is safe
only because nobody else can reach it:

- It listens on `127.0.0.1` only. `OPERIO_ORCA_HOST` changes that and the server warns loudly;
  don't, unless you fully trust that network.
- It answers only to `localhost`, `127.0.0.1`, `[::1]` and the names in
  `OPERIO_ORCA_ALLOWED_HOSTS`. Any other `Host` header gets `421` (blocks DNS rebinding).
- Every request that changes something needs a same-origin `Origin` header (blocks CSRF).
- Opening or creating a shell needs a confirmation, which lasts 15 minutes.
- Settings, keys, state and logs live in `~/.config/operio-orca` with owner-only permissions.
  Agent prompts and replies are never written to the log.
- For phone access use Tailscale (`tailscale serve`) or an SSH tunnel. Never port forwarding
  or Tailscale Funnel.

Anyone with access to your user account, or to a device you tunnel from, can use it. That is
by design and not a vulnerability. A way around any of the points above is.

## What the installer checks

`install.sh` never needs sudo. It downloads herdr's official release and the ORCA panel
tarball and refuses to install unless both match sha256 sums written in the script. The panel
tarball is reproducible: `scripts/release.sh` rebuilds it byte for byte from the release tag,
so you can check the published sum yourself. npm dependencies are installed with `npm ci`
against `package-lock.json` integrity hashes.
