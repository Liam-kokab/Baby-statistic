# Let's Encrypt Certificates via Certbot + Domeneshop DNS Plugin

This guide covers obtaining and auto-renewing a Let's Encrypt certificate for the same hostname `ddns-keeper` maintains, using the DNS-01 challenge — useful because it works even when the host isn't reachable on port 80/443 from the internet (e.g. behind NAT, which is exactly the scenario `ddns-keeper` is built for).

## 1. Install Certbot and the Domeneshop plugin
```bash
sudo apt update
sudo apt install -y certbot python3-pip
sudo pip3 install certbot-dns-domeneshop
```
Verify the plugin is registered:
```bash
certbot plugins
# should list: * dns-domeneshop
```

## 2. Create API credentials
Generate a token/secret pair at https://www.domeneshop.no/admin?view=api (same credentials `ddns-keeper` uses — a separate pair is recommended for least-privilege/rotation, but not required).

Create the credentials file:
```bash
sudo mkdir -p /etc/letsencrypt/domeneshop
sudo tee /etc/letsencrypt/domeneshop/credentials.ini > /dev/null <<'EOF'
dns_domeneshop_client_token = YOUR_TOKEN
dns_domeneshop_client_secret = YOUR_SECRET
EOF
```

**Secure the credentials file** — it contains an API secret with DNS write access:
```bash
sudo chmod 600 /etc/letsencrypt/domeneshop/credentials.ini
sudo chown root:root /etc/letsencrypt/domeneshop/credentials.ini
```

## 3. Request a certificate
Replace `example.com` with your configured `DDNS_HOSTNAME`:
```bash
sudo certbot certonly \
  --authenticator dns-domeneshop \
  --dns-domeneshop-credentials /etc/letsencrypt/domeneshop/credentials.ini \
  -d example.com
```
Certbot uses the plugin to create a temporary `TXT` record (`_acme-challenge.example.com`) via the Domeneshop DNS API, waits for propagation, then removes it once validated. The resulting certificate/key are written to `/etc/letsencrypt/live/example.com/`.

## 4. Enable automatic renewal
Certbot installs a systemd timer (`certbot.timer` / `snap.certbot.renew.timer`, depending on install method) that runs `certbot renew` twice daily and only actually renews certificates within 30 days of expiry. Verify it's active:
```bash
systemctl list-timers | grep certbot
```
If it's not present (e.g. certbot installed via `pip`), add your own:
```bash
sudo tee /etc/systemd/system/certbot-renew.timer > /dev/null <<'EOF'
[Unit]
Description=Run certbot renew twice daily

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo tee /etc/systemd/system/certbot-renew.service > /dev/null <<'EOF'
[Unit]
Description=Certbot renewal

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew.timer
```

Because renewal reuses the same `--authenticator dns-domeneshop` config saved in `/etc/letsencrypt/renewal/example.com.conf`, no extra flags are needed — `certbot renew` picks up the DNS plugin and credentials file automatically.

## 5. Reload services after renewal (optional)
If nginx or another service needs to pick up the renewed cert, add a deploy hook:
```bash
sudo certbot certonly ... --deploy-hook "systemctl reload nginx"
```
or add it permanently to `/etc/letsencrypt/renewal/example.com.conf` under `[renewalparams]` as `renew_hook = systemctl reload nginx`.

