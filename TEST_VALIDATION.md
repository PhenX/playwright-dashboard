# Docker Build Test Validation

## Test Scenario: Native Module Compatibility

This document describes how to validate the fix for the `fcntl64: symbol not found` error.

### Prerequisites

- Docker installed (version 20.10+)
- Internet connection (for downloading Alpine packages)
- 2GB+ free disk space

### Test 1: Local Build

```bash
# Clean any previous builds
rm -rf application/.output

# Build the Docker image
docker build -t playwright-dashboard:test .

# Expected Result:
# ✓ Builder stage completes successfully
# ✓ Native modules compile without errors
# ✓ Final image is created (~220MB)
```

**Success Criteria:**
- Build completes without errors
- No symbol resolution warnings
- Final image size is reasonable (~200-250MB)

### Test 2: Container Startup

```bash
# Create data directory
mkdir -p .data

# Run the container
docker run -d \
  --name playwright-dashboard-test \
  -p 3000:3000 \
  -v $(pwd)/.data:/app/.data \
  playwright-dashboard:test

# Wait for startup
sleep 5

# Check logs
docker logs playwright-dashboard-test
```

**Success Criteria:**
- Container starts without errors
- No `fcntl64: symbol not found` error in logs
- Server listens on port 3000

### Test 3: Database Operations

```bash
# Test API endpoint (creates database on first call)
curl -X GET http://localhost:3000/api/projects

# Expected Response:
# {"projects":[]}

# Submit test results
curl -X POST http://localhost:3000/api/test-runs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "test-project",
    "status": "passed",
    "startTime": "2024-01-01T12:00:00Z",
    "duration": 1000,
    "totalTests": 1,
    "passedTests": 1,
    "failedTests": 0,
    "skippedTests": 0,
    "testCases": []
  }'

# Verify project was created
curl -X GET http://localhost:3000/api/projects
```

**Success Criteria:**
- All API calls succeed
- Database operations complete without errors
- No symbol resolution errors in logs
- Data persists correctly

### Test 4: Multi-Platform Build

```bash
# Build for both amd64 and arm64
docker buildx create --name multiplatform --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t playwright-dashboard:multiplatform \
  .
```

**Success Criteria:**
- Build succeeds for both platforms
- Native modules compile correctly for each architecture
- No cross-compilation issues

### Test 5: Verify No gcompat Dependency

```bash
# Check what's in the final image
docker run --rm playwright-dashboard:test apk list --installed | grep gcompat

# Expected: Empty output (gcompat should NOT be installed)
```

**Success Criteria:**
- gcompat is not installed in the final image
- Native modules work without compatibility layer

### Cleanup

```bash
# Stop and remove container
docker stop playwright-dashboard-test
docker rm playwright-dashboard-test

# Remove test data
rm -rf .data

# Remove test image
docker rmi playwright-dashboard:test
```

## Error Scenarios

### Previous Error (Before Fix)

When running the old Dockerfile:
```
Error relocating /app/.output/server/node_modules/better-sqlite3/build/Release/better_sqlite3.node: fcntl64: symbol not found
```

This error occurred when:
1. Accessing any database operation
2. On first API call that initializes the database
3. After container startup

### After Fix

With the new multi-stage build:
- No symbol resolution errors
- Database operations work correctly
- Native modules load successfully

## Performance Comparison

### Build Time

**Before (external build):**
- Local build: 2-3 minutes
- Docker copy: 5-10 seconds
- Total: ~3 minutes

**After (multi-stage):**
- Builder stage: 3-5 minutes (includes npm ci)
- Runtime stage: 5-10 seconds
- Total: ~4 minutes
- **Note:** Build time increase is acceptable for proper compatibility

### Image Size

**Before:** ~205MB (with gcompat)
**After:** ~220MB (without gcompat)
- Increase of ~15MB is acceptable
- No compatibility layer overhead at runtime

### Runtime Performance

**Before:** May have compatibility layer overhead
**After:** Native performance, no translation layer

## CI/CD Integration

The GitHub Actions workflow has been updated:

**Before:**
```yaml
- name: Set up Node.js
- name: Install dependencies and build
- name: Build Docker image (copies pre-built .output)
```

**After:**
```yaml
- name: Build Docker image (builds inside Docker)
```

**Benefits:**
- Simpler workflow
- Guaranteed platform compatibility
- Consistent build environment

## Conclusion

The multi-stage build approach ensures:
1. Native modules are compiled for the target platform (Alpine/musl)
2. No dependency on compatibility layers (gcompat)
3. Proper symbol resolution at runtime
4. Works consistently across all platforms (amd64, arm64)
5. Eliminates the `fcntl64: symbol not found` error

The slight increase in build time and image size is a worthwhile tradeoff for guaranteed compatibility and eliminating runtime errors.
