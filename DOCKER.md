# Docker Deployment Guide

This guide explains how to deploy the Playwright Dashboard using Docker.

## Quick Start with Docker

### Pull and Run

Pull the latest image from GitHub Container Registry and run it:

```bash
docker pull ghcr.io/phenx/playwright-dashboard:latest
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data ghcr.io/phenx/playwright-dashboard:latest
```

The dashboard will be available at `http://localhost:3000`.

## Image Details

- **Base Image**: `node:22-alpine` (minimal Alpine Linux with Node.js 22)
- **Image Size**: ~200MB (compact without native module dependencies)
- **Architecture**: Multi-platform (linux/amd64, linux/arm64)
- **Registry**: GitHub Container Registry (ghcr.io)

## Building the Image Locally

The image is built outside of Docker for optimal size. Follow these steps:

### 1. Build the Application

```bash
cd application
npm install
npm run build
```

This creates the `.output` directory with the production build.

**Note for Multi-Platform Support**: When building for Docker on Alpine Linux (musl), you need to include platform-specific native modules:

```bash
cd application
npm install
# Get the libsql version from package-lock.json
LIBSQL_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/libsql'].version")
# Install Alpine-specific native modules
npm install --no-save --force @libsql/linux-x64-musl@$LIBSQL_VERSION @libsql/linux-arm64-musl@$LIBSQL_VERSION
npm run build
# Copy native modules to output (Nitro doesn't auto-include cross-platform modules)
mkdir -p .output/server/node_modules/@libsql/linux-x64-musl
mkdir -p .output/server/node_modules/@libsql/linux-arm64-musl
cp -r node_modules/@libsql/linux-x64-musl/* .output/server/node_modules/@libsql/linux-x64-musl/
cp -r node_modules/@libsql/linux-arm64-musl/* .output/server/node_modules/@libsql/linux-arm64-musl/
```

### 2. Build the Docker Image

```bash
docker build -t playwright-dashboard:local .
```

### 3. Run the Container

```bash
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data playwright-dashboard:local
```

## Configuration

### Environment Variables

- `NODE_ENV=production` - Set automatically in the container
- `HOST=0.0.0.0` - Listens on all interfaces
- `PORT=3000` - Application port (default)
- `NUXT_AUTH_ENABLED` - Enable authentication (optional)
- `NUXT_AUTH_SECRET` - Secret for authentication (required if auth enabled)

### Volumes

Mount a volume to persist data:

```bash
docker run -p 3000:3000 \
  -v /path/to/data:/app/.data \
  ghcr.io/phenx/playwright-dashboard:latest
```

The `.data` directory contains:
- `playwright.db` - SQLite database
- `storage/` - Uploaded HTML reports and trace files

## Production Deployment

### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

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

### Kubernetes

Example deployment:

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

## Security

The container runs as a non-root user (`nodejs:nodejs` with UID/GID 1001) for enhanced security.

## Available Tags

- `latest` - Latest stable release
- `v1.0.0` - Specific version (semver)
- `v1.0` - Major.minor version
- `v1` - Major version

## Image Optimization

This image is optimized for size:

1. **External Build**: Application is built outside Docker to avoid including build dependencies
2. **Alpine Base**: Uses minimal Alpine Linux (~55MB base)
3. **Minimal Layers**: Commands combined to reduce layer count
4. **No Build Dependencies**: Only runtime dependencies included
5. **Efficient Copying**: Only `.output` directory copied
6. **Native Modules**: Platform-specific SQLite bindings included for Alpine (musl) support

## Technical Notes

### SQLite Implementation

The application uses Node.js's SQLite via the `libsql` package, which requires platform-specific native bindings. When building on non-Alpine systems (glibc), the Alpine-specific bindings (`@libsql/linux-x64-musl` for x64 and `@libsql/linux-arm64-musl` for ARM64) must be explicitly installed and copied to the build output for the Docker image to work on Alpine Linux.

### Native Module Cross-Platform Support

Nuxt's Nitro bundler only includes native modules for the current platform during build. For multi-platform Docker images (supporting both x64 and ARM64 on Alpine), the publish workflow explicitly:

1. Installs Alpine-specific native modules with `--force` flag (to bypass platform checks)
2. Copies these modules to the `.output/server/node_modules` directory after build
3. Ensures the Docker image can run on both `linux/amd64` and `linux/arm64` platforms

## Troubleshooting

### Permission Issues

If you encounter permission issues with volumes, ensure the mounted directory is writable:

```bash
mkdir -p .data
chmod 777 .data  # or use appropriate permissions
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data ghcr.io/phenx/playwright-dashboard:latest
```

### Database Locked

SQLite doesn't support concurrent writes well. For high-concurrency deployments, consider using a different database or running a single instance.

### Port Already in Use

If port 3000 is in use, map to a different port:

```bash
docker run -p 8080:3000 -v $(pwd)/.data:/app/.data ghcr.io/phenx/playwright-dashboard:latest
```

The dashboard will be available at `http://localhost:8080`.
