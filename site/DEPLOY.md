# Deploying make.operio.work

The site is static: `npm run build` writes `site/build/`, and nginx on **box1** serves it from
`/var/www/make.operio.work`. Nothing runs on the server except nginx.

Steps 1 to 4 are one-time setup on box1. Step 5 is every deploy.

## 1. DNS (Cloudflare)

In the `operio.work` zone add:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `make` | `172.105.12.26` | DNS only (grey cloud) to start |

Check it resolves before going on:

```bash
dig +short make.operio.work
```

## 2. Certificate (certbot, Cloudflare DNS challenge)

On box1, with the Cloudflare API token file you already use for the other Operio certificates:

```bash
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d make.operio.work
```

The vhost expects `/etc/letsencrypt/live/make.operio.work/fullchain.pem` and `privkey.pem`.

## 3. Web root and deploy user

```bash
sudo mkdir -p /var/www/make.operio.work
sudo chown deploy:deploy /var/www/make.operio.work
```

`deploy` needs SSH access from the machine you deploy from (`ssh deploy@box1` must work).

## 4. Enable the vhost

From this repository, copy the config to box1 and enable it:

```bash
scp site/deploy/nginx-make.operio.work.conf box1:/tmp/    # run from the repository root
ssh box1
sudo mv /tmp/nginx-make.operio.work.conf /etc/nginx/sites-available/make.operio.work
sudo ln -s /etc/nginx/sites-available/make.operio.work /etc/nginx/sites-enabled/make.operio.work
sudo nginx -t && sudo systemctl reload nginx
```

The config was checked with `nginx -t` on nginx 1.24 (Ubuntu 24.04) and every route was
fetched through it locally: all 52 pages answer 200 with no redirect, `/es/` and other
trailing-slash URLs get one 301 to the bare path, `/install.sh` is `text/plain`.

## 5. Deploy

```bash
cd site    # from the repository root
scripts/deploy.sh --dry-run    # build, then list what would change on box1
scripts/deploy.sh              # build, back up the live site, upload, check the live URLs
```

What `deploy.sh` does:

1. `npm ci` and `npm run build` (the build fails on any prerender error, a missing page, or a
   panel tarball whose sha256 differs from the pin in `install.sh`).
2. Copies the live site to `~deploy/backups/make.operio.work/<UTC timestamp>/` and keeps the last 10.
3. Uploads `_app/` first, then the pages, then removes files that are gone.
4. Fetches `/`, `/es`, `/catalog`, `/install`, `/install.sh` and `/sitemap.xml` from the live
   site, checks that `install.sh` is served as `text/plain` and that the live panel tarball
   matches the sha256 the live `install.sh` pins. On a failure it prints the
   rollback command.

Overrides: `DEPLOY_TARGET` (default `deploy@box1`), `DEPLOY_DIR`, `DEPLOY_KEEP`, `SITE_URL`.

Roll back by hand:

```bash
ssh deploy@box1 'ls ~/backups/make.operio.work/'
ssh deploy@box1 'rsync -a --delete ~/backups/make.operio.work/<timestamp>/ /var/www/make.operio.work/'
```

## After the first deploy

- Open https://make.operio.work and https://make.operio.work/es and check both themes.
- `curl -fsSL https://make.operio.work/install.sh | head` must print the installer.
- The panel tarball is served at `/releases/operio-orca-<version>.tar.gz` (+ `.sha256`). The build
  rebuilds it with `scripts/release.sh` and fails unless its sha256 equals `PANEL_SHA256` in
  `install.sh`; `deploy.sh` checks the live tarball against the live `install.sh` pin.
  The GitHub release carries the same file as a mirror (the installer falls back to it).
- **What's new** (`/whats-new` and the home section) comes from `src/lib/releases.js` (EN + ES text and
  pictures), dated from `CHANGELOG.md`. The build fails until the newest CHANGELOG version has an entry
  there. Pictures: `static/shots/<id>-<lang>.webp`, 1820x1120, light theme, taken from
  `operio-orca demo` (fictional businesses) in both languages.
- Add make.operio.work to monitoring (HTTPS and certificate expiry).
