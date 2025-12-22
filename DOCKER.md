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
- **Build Strategy**: Multi-stage build for optimal size and compatibility
- **Image Size**: ~220MB (includes build and runtime dependencies)
- **Architecture**: Multi-platform (linux/amd64, linux/arm64)
- **Registry**: GitHub Container Registry (ghcr.io)

## Building the Image Locally

The image uses a multi-stage build process that compiles native modules inside Alpine Linux for maximum compatibility.

### Build the Docker Image

```bash
docker build -t playwright-dashboard:local .
```

This command:
1. Builds the application inside an Alpine container (ensuring native modules are compiled for musl)
2. Copies only the built artifacts to the final minimal runtime image

### Run the Container

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

This image is optimized for both size and compatibility:

1. **Multi-stage Build**: Separates build and runtime environments
2. **Alpine Base**: Uses minimal Alpine Linux (~55MB base)
3. **Native Module Compatibility**: Builds native modules (better-sqlite3) in Alpine to ensure musl libc compatibility
4. **Minimal Layers**: Commands combined to reduce layer count
5. **No Runtime Build Dependencies**: Build tools only in builder stage
6. **Efficient Copying**: Only `.output` directory copied to final image

## Technical Notes

### Native Modules Compatibility

The application uses `better-sqlite3`, a native Node.js module with C++ bindings. The multi-stage build ensures native modules are compiled in Alpine Linux with musl libc, eliminating compatibility issues that occur when building on other platforms (Ubuntu/glibc, macOS) and then running on Alpine.

**Previous approach (deprecated)**: Building outside Docker and using `gcompat` for glibc compatibility caused symbol resolution issues (e.g., `fcntl64: symbol not found`).

**Current approach**: Building inside Alpine ensures native modules are compiled for the target platform, eliminating the need for compatibility layers.

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

### Native Module Errors

If you see errors related to `better-sqlite3` or shared libraries:
1. Ensure you're using the latest image from ghcr.io (built with multi-stage Alpine build)
2. The platform matches your system architecture
3. If building locally, Docker is using BuildKit (should be default on recent versions)

**Common error (now fixed)**: `fcntl64: symbol not found` - This occurred when native modules were built on non-Alpine systems. The multi-stage build approach ensures all native modules are compiled in Alpine.
