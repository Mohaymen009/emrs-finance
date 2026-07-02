# Deploying to your own Linux VPS

This walks through putting the EMRS Finance Platform on a VPS you control,
end to end, using Docker so you don't have to install Node/Postgres by hand.

> The Dockerfile/Compose setup follows Next.js's documented "standalone output"
> pattern and was reviewed carefully, but Docker itself wasn't available in the
> sandbox this project was built in, so `docker compose build` hasn't been run
> end-to-end by me. If `docker compose build` reports an error on your VPS,
> paste it back and it can be fixed quickly — the app code itself was fully
> verified against a real PostgreSQL instance (see the bottom of README.md).

## What you need before starting

- A Linux VPS (Ubuntu 22.04/24.04 assumed below; DigitalOcean, Hetzner, AWS
  Lightsail, etc. all work). 1 vCPU / 2GB RAM is enough to start.
- Root or sudo SSH access to it.
- A domain name (or subdomain) you can point at the server, e.g.
  `finance.yourcompany.ae`. Caddy uses this to get you free, auto-renewing
  HTTPS — you cannot skip this step, but you can use a subdomain of
  anything you already own.

## 1. Point your domain at the server

In your DNS provider, create an **A record**:

```
finance.yourcompany.ae   ->   <your server's public IP>
```

Give DNS a few minutes to propagate before step 6 (Caddy needs to reach
Let's Encrypt, and Let's Encrypt needs to be able to resolve your domain to
this server).

## 2. SSH in and install Docker

```bash
ssh root@<your-server-ip>

# Update the system
apt update && apt upgrade -y

# Install Docker Engine + the Compose plugin (official script)
curl -fsSL https://get.docker.com | sh

# (Optional but recommended) run Docker as a non-root user
usermod -aG docker $USER
```

Log out and back in if you added yourself to the `docker` group.

## 3. Open the firewall

Only 22 (SSH), 80, and 443 need to be reachable from the internet — Postgres
and the app itself are never exposed publicly (see `docker-compose.yml`,
they use `expose:` not `ports:`).

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 4. Get the code onto the server

Simplest option — copy the project folder from your machine:

```bash
# run this from YOUR computer, not the server
scp -r ./emrs-finance root@<your-server-ip>:/opt/emrs-finance
```

Or, if you push this project to a private Git repo:

```bash
# on the server
mkdir -p /opt && cd /opt
git clone <your-repo-url> emrs-finance
```

## 5. Configure environment variables

```bash
cd /opt/emrs-finance
cp .env.example .env
nano .env      # or vim/vi
```

Fill in real values:

```bash
DOMAIN=finance.yourcompany.ae
POSTGRES_USER=emrs
POSTGRES_PASSWORD=<generate one: openssl rand -hex 24>
POSTGRES_DB=emrs_finance
SEED_ADMIN_USERNAME=Noshaad
SEED_ADMIN_PASSWORD=Noshaad123
```

Run `openssl rand -hex 24` on the server to generate a strong Postgres password — don't ship this repo's example
values to production.

> The master admin (`Noshaad` / `Noshaad123`) is only created the *first*
> time you run the migrate step below. Change this password immediately
> after your first login, from the **Users** page — or set a different
> `SEED_ADMIN_PASSWORD` in `.env` before that first run.

## 6. Build and start everything

```bash
docker compose build
docker compose up -d postgres
docker compose --profile tools run --rm migrate      # creates tables, seeds divisions + master admin
docker compose up -d                 # starts postgres, app, and Caddy
```

Caddy will automatically request a Let's Encrypt certificate for `DOMAIN`
the first time it starts — this needs DNS to already be pointing here and
port 80/443 reachable (steps 1 and 3). Watch it happen:

```bash
docker compose logs -f caddy
```

Once you see it obtained a certificate, visit `https://finance.yourcompany.ae`
and log in with the master admin credentials from `.env`.

## 7. First login checklist

1. Log in as `Noshaad` / `Noshaad123` (case doesn't matter for either).
2. Go to **Users** → reset your own password to something only you know.
3. Create real accounts for your team from the **Users** page — there is no
   public sign-up anywhere in this system, accounts can only be created
   here by an Admin.
4. Grant each user access to Ambulance, Home Healthcare, or both, and set
   their role (Admin/Viewer).

## Day-to-day operations

**Check the app is healthy:**
```bash
docker compose ps
docker compose logs -f app
```

**Back up the database** (run this on a daily cron job — see below):
```bash
docker compose exec -T postgres pg_dump -U emrs emrs_finance | gzip > backup-$(date +%F).sql.gz
```

**Back up uploaded invoices/receipts** — they live in the `emrs_file_storage`
Docker volume:
```bash
docker run --rm -v emrs-finance_emrs_file_storage:/data -v $(pwd):/backup alpine \
  tar czf /backup/secure-storage-$(date +%F).tar.gz -C /data .
```

**Set up a daily backup cron** (as root):
```bash
crontab -e
# add this line:
0 3 * * * cd /opt/emrs-finance && docker compose exec -T postgres pg_dump -U emrs emrs_finance | gzip > /opt/backups/db-$(date +\%F).sql.gz
```
(create `/opt/backups` first: `mkdir -p /opt/backups`)

**Deploy an update after you change code:**
```bash
cd /opt/emrs-finance
git pull                      # or re-upload via scp
docker compose build
docker compose --profile tools run --rm migrate   # only needed if the schema changed
docker compose up -d
```

**Restart everything:**
```bash
docker compose restart
```

## Security notes specific to this deployment

- Postgres and the Next.js app are **never** exposed to the public internet
  directly — only Caddy (ports 80/443) is, and it terminates HTTPS before
  proxying internally over the Docker network.
- Session cookies are `httpOnly`, `SameSite=Lax`, and marked `Secure` in
  production (enforced by `NODE_ENV=production`, set in `docker-compose.yml`).
- A login rate limiter locks an IP+username out for 15 minutes after 5
  failed attempts — check `docker compose logs app` if you get locked out
  by mistake and need to know how long is left.
- Uploaded invoices/receipts are stored in a private Docker volume, never
  under a public web root, and only ever served back through an
  authenticated, division-scoped API route.
- Keep the VPS itself patched: `apt update && apt upgrade -y` periodically,
  and consider enabling `unattended-upgrades`.
- Sessions are opaque random tokens stored server-side in the `sessions`
  table (not signed JWTs) — there's no secret key whose leakage could forge
  a session. To force everyone to log out immediately, deactivate the
  relevant account(s) from the Users page, or simply truncate the
  `sessions` table.
