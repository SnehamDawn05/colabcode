# Docker Deployment Guide for ColabCode

This guide explains how to build, run, and manage ColabCode using Docker and Docker Compose.

---

## Architecture Overview

The containerized stack includes 4 services connected on a dedicated bridge network (`colabcode-network`):

| Service | Container Name | Port | Description |
| :--- | :--- | :--- | :--- |
| **`postgres`** | `colabcode-postgres` | `5432` | PostgreSQL 16 database with persistent storage volume |
| **`db-init`** | `colabcode-db-init` | N/A | One-shot container that applies Prisma schemas and seeds demo accounts |
| **`realtime`** | `colabcode-realtime` | `3001` | Socket.IO / Yjs collaborative WebSocket server |
| **`web`** | `colabcode-web` | `3000` | Multi-stage Next.js standalone web frontend & API server |

---

## Quick Start (One Command)

To build and start all containers:

```bash
docker compose up --build
```

To run in the background (detached mode):

```bash
docker compose up --build -d
```

---

## Accessing the Application

Once running, access the services in your browser:

- **Web Frontend**: [http://localhost:3000](http://localhost:3000)
- **Realtime Server**: [http://localhost:3001](http://localhost:3001)
- **PostgreSQL**: `localhost:5432` (User: `user`, Password: `password`, DB: `colab_code`)

### Demo Accounts (Auto-Seeded)

The `db-init` service automatically provisions the database with test accounts:

| Email | Password | Role |
| :--- | :--- | :--- |
| `alice@example.com` | `password123` | Owner / Demo Workspace |
| `bob@example.com` | `password123` | Editor |
| `charlie@example.com` | `password123` | Viewer |

---

## Useful Docker Commands

### View Logs
```bash
# View logs from all services in real time
docker compose logs -f

# View logs for a specific service
docker compose logs -f web
docker compose logs -f realtime
docker compose logs -f postgres
docker compose logs -f db-init
```

### Check Service Status
```bash
docker compose ps
```

### Stop Services
```bash
# Stop containers without losing database data
docker compose stop

# Stop and remove containers and network
docker compose down
```

### Reset Database & Volumes
```bash
# Stop containers and wipe PostgreSQL volume to start fresh
docker compose down -v
docker compose up --build
```

### Run Ad-hoc Database Commands
```bash
# Open Prisma Studio in container
docker compose run --rm -p 5555:5555 db-init pnpm db:studio

# Re-run seed manually
docker compose run --rm db-init pnpm db:seed
```

---

## Environment Variables Configuration

Copy `.env.docker.example` to `.env` if you wish to override default ports or credentials:

```bash
cp .env.docker.example .env
```

Available variables:
- `POSTGRES_USER`: Database username (default: `user`)
- `POSTGRES_PASSWORD`: Database password (default: `password`)
- `POSTGRES_DB`: Database name (default: `colab_code`)
- `POSTGRES_PORT`: Exposed PostgreSQL port (default: `5432`)
- `AUTH_SECRET`: Secret key for Better-Auth session tokens
- `WEB_PORT`: Port exposed by Next.js frontend (default: `3000`)
- `REALTIME_PORT`: Port exposed by Realtime WebSocket server (default: `3001`)
- `NEXT_PUBLIC_API_URL`: Base URL for API requests (default: `http://localhost:3000`)
- `NEXT_PUBLIC_REALTIME_URL`: Base URL for Realtime WebSocket (default: `http://localhost:3001`)
- `GOOGLE_CLIENT_ID`: (Optional) OAuth Google Client ID
- `GOOGLE_CLIENT_SECRET`: (Optional) OAuth Google Client Secret
