[200~# AutoMediaCenter — Server Setup & Rebuild Guide

This document describes exactly what is installed on the production server and how, so that in the event of total instance loss, a fresh Amazon Linux EC2 instance can be brought back to a working state without guesswork.

Last verified: 14 July 2026, against live instance `i-0cf1a566e979c241c`.

---

## 1. Base OS

```
Amazon Linux 2023
```

Confirm with: `cat /etc/os-release`

---

## 2. Install steps, in order

### 2.1 Node.js 18 (via yum/dnf, NOT nvm)

The server does **not** use nvm. Node was installed directly via the Amazon Linux package manager:

```bash
sudo dnf install -y nodejs
```

This installs Node 18.20.8 and npm 10.8.2 as system packages (`nodejs`, `nodejs-libs`, `nodejs-npm`, etc.). Confirm with:
```bash
node -v    # expect v18.20.8
npm -v     # expect 10.8.2
```

> Note: Raj's original checklist assumed Node 20 via nvm. The live server actually runs Node 18 via yum. This works fine for the current app — no urgent need to change it — but if you deliberately upgrade Node in future, update this doc to match.

### 2.2 PM2 (process manager)

```bash
sudo npm install -g pm2
```
Confirm: `pm2 -v` (expect 6.0.14 or later)

### 2.3 Nginx (reverse proxy)

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```
Confirm: `nginx -v` (expect 1.28.0 or later)

### 2.4 Certbot (TLS certificates)

```bash
sudo dnf install -y certbot python3-certbot-nginx
```
Confirm: `certbot --version` (expect 2.6.0 or later)

After installing, obtain the certificate with:
```bash
sudo certbot --nginx -d automediacenter.com -d www.automediacenter.com
```
Certbot auto-renewal is handled by a systemd timer installed alongside the package — no manual cron needed. Current cert expires **2026-10-04**; confirm auto-renewal is active with `sudo systemctl status certbot-renew.timer`.

### 2.5 CloudWatch Agent (memory/disk monitoring)

```bash
sudo dnf install -y amazon-cloudwatch-agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/config/cloudwatch-agent-config.json
```

**Important — IAM role required.** The agent cannot authenticate without an IAM role attached to the instance. Before starting the agent, attach a role with the `CloudWatchAgentServerPolicy` managed policy via:
EC2 Console → select instance → Actions → Security → Modify IAM role.

Without this step the agent runs but silently fails to publish any metrics (logs will show `"no EC2 instance role found"`).

### 2.6 Build tools for native npm dependencies (Sharp, etc.)

```bash
sudo dnf install -y gcc-c++ make
```

These are required if any dependency (e.g. `sharp`, pulled in transitively via `pdf2html`) needs to compile from source rather than use a prebuilt binary. Not strictly required for the app to run today, but install them anyway on a fresh box to avoid surprises — especially once the image pre-generation pipeline (see Q3 of Raj's review) is built, since that will lean on Sharp directly and more heavily.

---

## 3. Application deployment

```bash
git clone <repo-url> ~/amc-deployment
cd ~/amc-deployment
npm ci
```

Copy `.env` into place from your password manager (see Section 5 — never commit real secrets). Use `/config/env.example` in this repo as the template for which variables are required.

Start the app under PM2 using the checked-in process definition:
```bash
pm2 start /config/ecosystem.config.js
pm2 save
pm2 startup   # follow the printed instructions to enable PM2 on boot
```

---

## 4. Nginx site configuration

Copy `/config/nginx.conf` (in this repo) to `/etc/nginx/conf.d/automediacenter.conf` on the new instance, then:
```bash
sudo nginx -t          # test config syntax
sudo systemctl reload nginx
```

Note: this file references Certbot-managed SSL paths (`/etc/letsencrypt/live/automediacenter.com/...`). These won't exist until Certbot has been run (Section 2.4) — run Certbot first, or temporarily comment out the SSL block, test on port 80, then re-enable.

---

## 5. Secrets — never checked into the repo

Real secret values live in a password manager, not in git. `/config/env.example` in this repo documents which variables are required, with placeholder values only.

Minimum required for the app to boot:
- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — token signing secret
- `SESSION_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Brevo SMTP credentials
- `ANTHROPIC_API_KEY`

**Known quirk — multiple URL variables:** the app currently reads from **five** separate URL-shaped variables (`APP_BASE_URL`, `APP_URL`, `BASE_URL`, `FRONTEND_URL`, `SITE_URL`) plus `OAUTH_CALLBACK_BASE_URL`. During the HTTPS/domain migration, only some of these were updated at first — a real bug that was caught and fixed, but it's a landmine for a future rebuild if only some of these get set. **All six should point at `https://automediacenter.com`** unless you deliberately consolidate the codebase to use just one (worth doing eventually, but out of scope for a disaster-recovery rebuild).

Also store outside the instance (in your password manager or printed and locked away):
- AWS account root login
- MongoDB Atlas connection string (full, with credentials)
- Domain registrar login (for automediacenter.com)
- The `.env` file itself, or equivalent

---

## 6. Elastic IP & DNS

The instance uses Elastic IP `32.196.180.7`. If rebuilding on a new instance:
1. Allocate/re-associate the existing Elastic IP to the new instance (do NOT let it stay attached to a terminated instance — you'll lose it)
2. Confirm GoDaddy DNS A records for `automediacenter.com` and `www.automediacenter.com` still point at `32.196.180.7` (they shouldn't need to change if the same Elastic IP is reattached)

---

## 7. Safety net already in place (as of 14 July 2026)

- **Golden AMI**: `AMC server 14 July 2026` (`ami-047303d7d1ab9bd5a`) — a point-in-time full machine image. Launch a new instance from this AMI for the fastest possible recovery if the current instance is unrecoverable.
- **Automated EBS snapshots**: DLM policy `policy-05847f92ced8572f8`, daily at 04:00, 7-day retention.
- **CloudWatch memory alarm**: `AMC-Memory-85pct`, triggers when `mem_used_percent` (via CWAgent) exceeds 85% over a 5-minute average, notifies `gregkable@gmail.com` via SNS topic `amc-memory-alerts`.

If both the Golden AMI and the live instance are lost simultaneously, follow this document from Section 1 on a brand-new instance instead.

---

## 8. Deploy script (repeatable deploys)

See `/config` or repo root for a `deploy.sh` script following the pattern:
```bash
git pull
npm ci
pm2 reload amc-backend --update-env
```
This gives git-based rollback (via `git checkout <previous-commit>` + re-deploy) and avoids manual, error-prone deploy steps.~
