# Building and Testing on Windows - Simple Guide

This guide provides the simplest way to build and test the Playwright Dashboard Docker image on Windows.

## Prerequisites

1. **Docker Desktop for Windows** - [Download here](https://www.docker.com/products/docker-desktop/)
   - Make sure it's running (check the system tray)
   - Ensure WSL 2 backend is enabled (default for modern installations)

2. **Git for Windows** (if you want to clone the repo)
   - Or just download the repository as a ZIP file

## Option 1: Quick Test with PowerShell (Recommended)

Open **PowerShell** (not Command Prompt) and run:

```powershell
# Navigate to the repository directory
cd C:\path\to\playwright-dashboard

# Build the Docker image
docker build -t playwright-dashboard:test .

# Create a data directory for persistent storage
New-Item -ItemType Directory -Force -Path .\.data

# Run the container
docker run -d --name playwright-test -p 3000:3000 -v ${PWD}\.data:/app/.data playwright-dashboard:test

# Wait a few seconds for startup
Start-Sleep -Seconds 5

# Check if it's running
docker logs playwright-test

# Test the API
curl http://localhost:3000/api/projects
```

### Expected Results

If everything works correctly:
- Build should complete in 3-5 minutes
- Container should start without errors
- API should return: `{"projects":[]}`
- No `fcntl64: symbol not found` error in logs

### Stop and Clean Up

```powershell
# Stop and remove the container
docker stop playwright-test
docker rm playwright-test

# Remove the test image (optional)
docker rmi playwright-dashboard:test

# Remove test data (optional)
Remove-Item -Recurse -Force .\.data
```

## Option 2: Using Command Prompt

Open **Command Prompt** and run:

```cmd
:: Navigate to the repository directory
cd C:\path\to\playwright-dashboard

:: Build the Docker image
docker build -t playwright-dashboard:test .

:: Create a data directory
mkdir .data

:: Run the container (note: volume mounting is simpler with absolute paths)
docker run -d --name playwright-test -p 3000:3000 -v %cd%\.data:/app/.data playwright-dashboard:test

:: Wait for startup
timeout /t 5 /nobreak

:: Check logs
docker logs playwright-test

:: Test the API (if curl is available)
curl http://localhost:3000/api/projects
```

### If curl is not available:

Open a web browser and go to: `http://localhost:3000/api/projects`

You should see: `{"projects":[]}`

## Option 3: Using Docker Desktop GUI

1. **Build the Image**:
   - Open PowerShell in the repository directory
   - Run: `docker build -t playwright-dashboard:test .`

2. **Run via Docker Desktop**:
   - Open Docker Desktop
   - Go to "Images" tab
   - Find `playwright-dashboard:test`
   - Click "Run" button
   - Configure:
     - Container name: `playwright-test`
     - Port: `3000` → `3000`
     - Volume: `C:\path\to\playwright-dashboard\.data` → `/app/.data`
   - Click "Run"

3. **View Logs**:
   - Go to "Containers" tab
   - Click on `playwright-test`
   - View logs to check for errors

4. **Test**:
   - Open browser: `http://localhost:3000/api/projects`

## Testing the Fix

### Submit Test Data

```powershell
# Create a test JSON file
@"
{
  "projectName": "test-project",
  "status": "passed",
  "startTime": "2024-01-01T12:00:00Z",
  "duration": 1000,
  "totalTests": 1,
  "passedTests": 1,
  "failedTests": 0,
  "skippedTests": 0,
  "testCases": []
}
"@ | Out-File -FilePath test-data.json -Encoding utf8

# Submit test results
curl -X POST http://localhost:3000/api/test-runs/submit `
  -H "Content-Type: application/json" `
  -d "@test-data.json"

# Verify project was created
curl http://localhost:3000/api/projects
```

Or using the browser:
1. Go to `http://localhost:3000`
2. You should see the dashboard UI
3. No errors should appear in the browser console

## Common Issues on Windows

### Issue: "docker: command not found"
**Solution**: Make sure Docker Desktop is running and restart PowerShell/CMD after installation.

### Issue: "Cannot connect to the Docker daemon"
**Solution**: 
- Check if Docker Desktop is running (system tray icon)
- Restart Docker Desktop
- In Docker Desktop settings, ensure "Expose daemon on tcp://localhost:2375 without TLS" is unchecked (for security)

### Issue: Volume mounting doesn't work
**Solution**: 
- Use absolute paths: `-v C:\full\path\to\.data:/app/.data`
- Or in PowerShell: `-v ${PWD}\.data:/app/.data`
- Make sure the directory exists before running

### Issue: Port 3000 is already in use
**Solution**: Use a different port:
```powershell
docker run -d --name playwright-test -p 8080:3000 -v ${PWD}\.data:/app/.data playwright-dashboard:test
```
Then access at: `http://localhost:8080`

### Issue: Build fails with "no space left on device"
**Solution**: 
- Open Docker Desktop → Settings → Resources
- Increase "Disk image size"
- Click "Apply & Restart"

### Issue: Build is very slow
**Solution**: 
- This is normal for the first build (3-5 minutes)
- Docker caches layers, so rebuilds are faster
- Make sure you have a good internet connection (downloads Alpine packages and npm dependencies)

## Verify the Fix

The original error was:
```
Error relocating /app/.output/server/node_modules/better-sqlite3/build/Release/better_sqlite3.node: fcntl64: symbol not found
```

**To verify it's fixed:**

1. Check container logs: `docker logs playwright-test`
2. Look for any errors related to `fcntl64` or `better-sqlite3`
3. If you see `symbol not found`, the build didn't work
4. If the API responds successfully, the fix worked!

## What Changed

The fix uses a **multi-stage Docker build**:

1. **Stage 1 (Builder)**: Compiles the application and native modules in Alpine Linux
2. **Stage 2 (Runtime)**: Copies only the built artifacts to a clean image

This ensures `better-sqlite3` is compiled for Alpine's musl libc instead of glibc, eliminating the `fcntl64` symbol error.

## Getting Help

If it still doesn't work:

1. **Share the build logs**:
   ```powershell
   docker build -t playwright-dashboard:test . 2>&1 | Tee-Object -FilePath build.log
   ```

2. **Share the container logs**:
   ```powershell
   docker logs playwright-test > container.log
   ```

3. **Check Docker version**:
   ```powershell
   docker --version
   ```

4. **Share your environment**:
   - Windows version
   - Docker Desktop version
   - WSL 2 or Hyper-V backend

Include these logs when asking for help!

## Next Steps

Once you've verified it works:

1. **Stop the test container**: `docker stop playwright-test && docker rm playwright-test`
2. **Use the official image** (once published): 
   ```powershell
   docker pull ghcr.io/phenx/playwright-dashboard:latest
   docker run -p 3000:3000 -v ${PWD}\.data:/app/.data ghcr.io/phenx/playwright-dashboard:latest
   ```

## Quick Reference

```powershell
# Build
docker build -t playwright-dashboard:test .

# Run
docker run -d --name playwright-test -p 3000:3000 -v ${PWD}\.data:/app/.data playwright-dashboard:test

# Check logs
docker logs playwright-test

# Follow logs (live)
docker logs -f playwright-test

# Test API
curl http://localhost:3000/api/projects

# Stop
docker stop playwright-test

# Remove
docker rm playwright-test

# Remove image
docker rmi playwright-dashboard:test
```

## Video Tutorial Alternative

If you prefer visual guidance:
1. Open Docker Desktop
2. Use the GUI to build and run (see Option 3 above)
3. Check the logs in the Containers tab
4. Test by opening `http://localhost:3000` in your browser

The GUI approach is often easier for Windows users new to Docker!
