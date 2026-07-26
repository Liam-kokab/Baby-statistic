# nginx + Let's Encrypt (Production TLS)

Production traffic is fronted by **nginx**, which owns ports `80`/`443` and terminates TLS via **Let's Encrypt** (certbot). The Node app itself listens on an internal-only port (`3000`, see `ecosystem.config.js`) and is never exposed directly to the internet. This avoids the `EACCES: permission denied 0.0.0.0:80` problem entirely (binding low ports as a non-root PM2 user) — see the "Troubleshooting" section in `doc/pm2.md` for background.

## Why this layout
- **App stays on port `3000`** — no `setcap`/root tricks needed for PM2.
- **nginx owns `80`/`443`** — the only process on the box that needs privileged ports, and it's designed for exactly that.
- **certbot manages certs and renewal** — nginx config is auto-rewritten by `certbot --nginx` to add the `ssl_certificate` lines; the ACME HTTP-01 challenge location is already present in the template (`/.well-known/acme-challenge/` → `/var/www/certbot`), so certbot reuses it instead of inserting a new one.

## Files
| File | Purpose |
|---|---|
| `deploy/nginx/baby-statistic.conf` | nginx server block template — HTTP→HTTPS redirect + HTTPS reverse proxy to `localhost:3000` |

## One-Time Setup (per machine)

**0. Prerequisites** — before starting, make sure:
   - The app is already deployed and running under PM2 on port `3000` (see `doc/pm2.md`) — nginx only proxies to it, it doesn't start it.
   - Your domain's DNS `A`/`AAAA` record already points at this machine's public IP (propagated — check with `dig your-domain.example`).
   - Ports `80` and `443` are reachable from the internet (cloud firewall / security group, not just `ufw`).

**1. Install nginx and certbot**
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

**2. Create the ACME challenge directory** — referenced by the `/.well-known/acme-challenge/` location in the template below; must exist before certbot's first HTTP-01 validation, or nginx will 404 the challenge and the request will fail.
```bash
sudo mkdir -p /var/www/certbot
```

**3. Install the site config**
```bash
sudo cp deploy/nginx/baby-statistic.conf /etc/nginx/sites-available/baby-statistic.conf
sudo ln -s /etc/nginx/sites-available/baby-statistic.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # optional: remove the stock nginx welcome page
```

**4. Replace the placeholder domain** — edit the file and change every `your-domain.example` to your real domain.
```bash
sudo nano /etc/nginx/sites-available/baby-statistic.conf
```

**5. Validate and reload nginx**
```bash
sudo nginx -t                      # validate syntax
sudo systemctl reload nginx
```

**6. Open the firewall** (if `ufw` is active)
```bash
sudo ufw allow 'Nginx Full'        # allows 80 + 443
```

**7. Obtain the certificate** — certbot edits the `443` server block automatically
```bash
sudo certbot --nginx -d your-domain.example
```

> **Behind NAT / port 80-443 not reachable from the internet?** The HTTP-01 flow above requires nginx to be publicly reachable on port 80. If it isn't (e.g. a home server behind a router), use the DNS-01 flow instead — see `ddns-keeper/CERTBOT.md` (uses the Domeneshop DNS API via `certbot-dns-domeneshop`, no inbound port needed). You'll still install the resulting cert into this nginx config's `ssl_certificate`/`ssl_certificate_key` lines manually (certbot's `--nginx` auto-rewrite only applies to the `--nginx` authenticator, not `--authenticator dns-domeneshop`).

certbot's nginx plugin will:
1. Verify domain ownership via the ACME HTTP-01 challenge (served through the `/.well-known/acme-challenge/` location already in the template).
2. Add `ssl_certificate` / `ssl_certificate_key` lines pointing at `/etc/letsencrypt/live/your-domain.example/`.
3. Optionally add a redirect from HTTP to HTTPS (the template already redirects, so certbot should detect this and skip re-adding it).

## Auto-Renewal
certbot installs a systemd timer (`certbot.timer`) or cron job automatically — no extra setup needed. Verify it exists and test a dry run:
```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```
Certificates are renewed in-place; nginx does **not** need a full restart — a config reload is enough, which certbot's renewal hook does automatically.

## Relationship to PM2 / `deploy.sh`
- nginx + certbot are **machine-level setup**, done once — not part of `deploy.sh` or the PM2 app list, since they don't need to change on every code deploy.
- The Node app (`baby-statistic-server`) continues to run under PM2 on port `3000` exactly as documented in `doc/pm2.md` — only the public-facing port changed (from `80` directly to `80`/`443` via nginx).
- After changing `PORT` in `ecosystem.config.js`, apply with `pm2 restart ecosystem.config.js --update-env` (see `doc/pm2.md`).
- If `HEALTHCHECK_URL` / `BABY_API_URL` are ever pointed at a different internal port, update `ecosystem.config.js` for the `baby-statistic-healthcheck` and `baby-statistic-mcp` apps to match.

## Troubleshooting
| Symptom | Cause / Fix |
|---|---|
| `502 Bad Gateway` from nginx | The Node app isn't listening on `localhost:3000` — check `pm2 status` / `pm2 logs baby-statistic-server`. |
| `nginx -t` fails after editing the conf | Usually a typo or leftover placeholder domain — check the exact error line nginx prints. |
| Certbot fails the HTTP-01 challenge | Port 80 must be reachable from the internet and served by nginx (not blocked by a firewall/security group) before requesting a cert. |
| Browser still shows old/self-signed cert | Hard-refresh, or check `sudo certbot certificates` to confirm the right cert is installed and not expired. |

