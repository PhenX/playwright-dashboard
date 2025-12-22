# Container Native Module Compatibility Fix

## Problem

When running the Playwright Dashboard in a container, users encountered this error:

```
Error relocating /app/.output/server/node_modules/better-sqlite3/build/Release/better_sqlite3.node: fcntl64: symbol not found
```

## Root Cause

The error occurred due to a platform mismatch in the native module compilation:

1. **Previous Build Process**:
   - Application was built on Ubuntu (uses glibc) in GitHub Actions
   - The compiled `better-sqlite3` native module was built for glibc
   - Pre-built `.output` directory was copied into Alpine Linux container
   - Alpine uses musl libc, not glibc
   - `gcompat` was used to provide glibc compatibility layer

2. **Why It Failed**:
   - `gcompat` provides partial glibc compatibility but doesn't implement all symbols
   - The `fcntl64` symbol required by `better-sqlite3` wasn't available
   - This caused a runtime error when the database was accessed

## Solution

Changed the build strategy to compile native modules inside Alpine:

### Multi-Stage Dockerfile

**Stage 1 (Builder)**:
- Uses `node:22-alpine` base image
- Installs build dependencies: `python3`, `make`, `g++`
- Copies source code and package files
- Runs `npm ci` to install dependencies (compiles native modules for Alpine/musl)
- Runs `npm run build` to build the application

**Stage 2 (Runtime)**:
- Uses clean `node:22-alpine` base image
- Copies only the built `.output` directory from Stage 1
- No build dependencies or `gcompat` needed
- Minimal runtime image

### Key Benefits

1. **Native Compatibility**: Native modules are compiled for the target platform (Alpine/musl)
2. **No Compatibility Layer**: Eliminates need for `gcompat` and its limitations
3. **Smaller Final Image**: Build dependencies stay in builder stage
4. **Proper Symbol Resolution**: All symbols are available because modules are compiled natively
5. **Platform Consistency**: Same approach works for both amd64 and arm64

## Changes Made

### 1. Dockerfile

```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder
RUN apk update && apk add --no-cache python3 make g++
COPY application/package*.json ./
RUN npm ci
COPY application/ ./
RUN npm run build

FROM node:22-alpine
COPY --from=builder /app/.output ./.output
# ... rest of runtime setup
```

### 2. .dockerignore

Changed from excluding everything except `.output` to including source files:
- Include: application source, package.json, package-lock.json
- Exclude: node_modules, .nuxt, .output, .data, test files

### 3. GitHub Workflow (.github/workflows/publish.yml)

Removed the pre-build steps since building now happens inside Docker:
- Removed Node.js setup
- Removed npm ci and npm run build steps
- Docker build handles everything

### 4. Documentation (DOCKER.md)

Updated to reflect:
- New multi-stage build process
- Removed references to `gcompat`
- Added explanation of native module compatibility
- Updated build instructions

## Testing the Fix

### Local Testing

```bash
# Build the image
docker build -t playwright-dashboard:test .

# Run the container
docker run -p 3000:3000 -v $(pwd)/.data:/app/.data playwright-dashboard:test

# Test API endpoint
curl http://localhost:3000/api/projects
```

If the fix works correctly, the API should respond without the `fcntl64: symbol not found` error.

### Verification Steps

1. **Build succeeds**: Multi-stage build completes without errors
2. **Native modules load**: `better-sqlite3` loads without symbol errors
3. **Database operations work**: API endpoints that access the database respond correctly
4. **No gcompat required**: Runtime image doesn't need compatibility layers

## Technical Details

### Why Building in Alpine is Better

- **Direct Compilation**: Native modules compile directly for musl libc
- **No Translation**: No need for glibc-to-musl translation layer
- **Complete Symbol Table**: All required symbols are available
- **Standard Approach**: Matches how native modules should be built for Alpine

### Why Previous Approach Failed

- **Symbol Mismatch**: glibc and musl have different symbol names/implementations
- **Incomplete Coverage**: `gcompat` doesn't implement all glibc functions
- **fcntl64 Specific**: This symbol has no direct musl equivalent in gcompat
- **Runtime Discovery**: Error only appears when the missing symbol is called

### Performance Impact

- **Build Time**: Slightly longer (needs to compile native modules)
- **Image Size**: Minimal increase (~15MB for build stage, not in final image)
- **Runtime Performance**: Same or better (no compatibility layer overhead)

## Related Resources

- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [Alpine Linux musl vs glibc](https://wiki.alpinelinux.org/wiki/Comparison_with_other_distros#musl_vs_glibc)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Node.js Native Addons](https://nodejs.org/api/addons.html)
