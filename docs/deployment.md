---
title: Deployment
lang: en-US
---

# Deployment

## Docker (recommended)

### Quick start

```bash
docker pull ghcr.io/phenx/playwright-dashboard:latest
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data ghcr.io/phenx/playwright-dashboard:latest
```

The dashboard will be available at `http://localhost:3000`.

### Available tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `v1.0.0` | Specific version (semver) |
| `v1.0` | Major.minor version |
| `v1` | Major version |

### Image details

| Property | Value |
|----------|-------|
| Base image | `node:24-alpine` |
| Build type | Multistage (builder + production stages) |
| Image size | ~200 MB |
| Platforms | `linux/amd64`, `linux/arm64` |
| Registry | `ghcr.io/phenx/playwright-dashboard` |

### Volumes

Mount a volume to persist data:

```bash
docker run -p 3000:3000 \
  -v /path/to/data:/app/.data \
  ghcr.io/phenx/playwright-dashboard:latest
```

The `.data` directory contains:

- `playwright.db` — SQLite database
- `storage/` — HTML reports and trace files

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Set automatically |
| `HOST` | `0.0.0.0` | Listen on all interfaces |
| `PORT` | `3000` | Application port |
| `NUXT_AUTH_ENABLED` | — | Enable authentication |
| `NUXT_AUTH_SECRET` | — | Secret for authentication (required if auth enabled) |
| `STORAGE_TYPE` | `local` | Storage backend (`local` or `s3`) |
| `DATABASE_PATH` | `.data/playwright.db` | SQLite database path |

## Building locally

```bash
cd application
docker build -t playwright-dashboard:local .
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data playwright-dashboard:local
```

## Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  playwright-dashboard:
    image: ghcr.io/phenx/playwright-dashboard:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/.data
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

Run with:

```bash
docker-compose up -d
```

## Kubernetes

Example deployment manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: playwright-dashboard
spec:
  replicas: 1
  selector:
    matchLabels:
      app: playwright-dashboard
  template:
    metadata:
      labels:
        app: playwright-dashboard
    spec:
      containers:
      - name: playwright-dashboard
        image: ghcr.io/phenx/playwright-dashboard:latest
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: data
          mountPath: /app/.data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: playwright-dashboard-data
---
apiVersion: v1
kind: Service
metadata:
  name: playwright-dashboard
spec:
  selector:
    app: playwright-dashboard
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Production build from source

```bash
cd application
npm install
npm run build
npm run preview  # preview the production build locally
```

## Security

The container runs as a non-root user (`nodejs:nodejs`, UID/GID 1001).

Security best practices:

- Always use HTTPS in production
- Mount `.data/` on a persistent volume
- Set a strong `NUXT_AUTH_SECRET` and enable authentication

## Troubleshooting

### Permission issues with volumes

```bash
mkdir -p .data
chmod 777 .data
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data ghcr.io/phenx/playwright-dashboard:latest
```

### Database locked

SQLite doesn't support concurrent writes well. For high-concurrency deployments, run a single instance or consider using a different database backend.

### Port already in use

Map to a different host port:

```bash
docker run -p 8080:3000 -v $(pwd)/.data:/app/.data ghcr.io/phenx/playwright-dashboard:latest
```

The dashboard will be available at `http://localhost:8080`.
