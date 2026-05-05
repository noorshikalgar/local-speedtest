# SpeedWatch

A self-hosted internet speed monitoring dashboard. Runs automated Cloudflare speed tests on a schedule and displays download, upload, ping, and latency history through a React dashboard.

**Stack:** Express + SQLite backend · React + Recharts + Tailwind frontend

---

## Local Development

### Requirements

- Node.js 20+
- npm

### Setup

```bash
# 1. Clone the repo
git clone git@github.com:noorshikalgar/local-speedtest.git
cd local-speedtest

# 2. Install all dependencies
npm run install:all

# 3. Start both backend and frontend in dev mode
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

The SQLite database is created automatically at `backend/data/speedwatch.db` on first run.

---

## Docker

### Build and run

```bash
# Build the image
docker build -t speedwatch .

# Run the container
docker run -d \
  --name speedwatch \
  -p 3001:3001 \
  -v speedwatch-data:/app/backend/data \
  --restart unless-stopped \
  speedwatch
```

Open http://localhost:3001

The `-v` flag mounts a named volume so your database survives container restarts and updates.

### Or use Docker Compose

```bash
docker compose up -d
```

---

## Deploy to Portainer

### Option A — Stack (recommended)

1. In Portainer, go to **Stacks → Add stack**
2. Name it `speedwatch`
3. Paste the contents of `docker-compose.yml` into the Web editor
4. Click **Deploy the stack**

Portainer will build the image and start the container. Access the app on port `3001` of your host machine.

### Option B — Deploy from Git repository

1. Go to **Stacks → Add stack**
2. Select **Repository** as the build method
3. Set the repository URL to `https://github.com/noorshikalgar/local-speedtest`
4. Set the compose path to `docker-compose.yml`
5. Click **Deploy the stack**

Portainer will pull the repo, build the image, and deploy automatically. You can enable **GitOps updates** to redeploy on every push.

### Updating

```bash
# Rebuild and restart without losing data
docker compose pull
docker compose up -d --build
```

In Portainer: open the stack → **Editor** → click **Update the stack**.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the server listens on |
| `NODE_ENV` | `production` | Node environment |

## Data

The SQLite database is stored at `/app/backend/data/speedwatch.db` inside the container. Always mount a volume at that path to persist data across restarts and image updates.
