import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'child_process'
import { join, resolve } from 'path'
import { existsSync, rmSync } from 'fs'
import http from 'http'

const AUTH_PORT = 3099
const AUTH_SERVER_URL = `http://localhost:${AUTH_PORT}`
const AUTH_SECRET = 'test-auth-secret-key-for-reporter-tests'
const DB_PATH = join(process.cwd(), '.test-temp', 'auth-test.db')
const STORAGE_PATH = join(process.cwd(), '.test-temp', 'auth-test-storage')

// Allow extra time for the auth server to start
const SERVER_START_TIMEOUT = 90000

let authServer: ChildProcess | null = null

/**
 * Wait for the auth server to be ready by polling its /api/auth/me endpoint.
 */
async function waitForServer(url: string, timeoutMs = SERVER_START_TIMEOUT): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`${url}/api/auth/me`, (res) => {
          res.resume()
          resolve()
        })
        req.on('error', reject)
        req.setTimeout(2000, () => {
          req.destroy()
          reject(new Error('timeout'))
        })
      })
      return
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`Auth server at ${url} did not become ready within ${timeoutMs}ms`)
}

/**
 * Log in and return the session cookie string
 */
async function loginAndGetCookie(serverUrl: string, username: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ username, password })
    const parsed = new URL('/api/auth/login', serverUrl)

    const req = http.request({
      hostname: parsed.hostname,
      port: Number(parsed.port),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      res.resume()
      if (res.statusCode !== 200) {
        reject(new Error(`Login failed: ${res.statusCode}`))
        return
      }
      const setCookie = res.headers['set-cookie']
      if (!setCookie || setCookie.length === 0) {
        reject(new Error('No session cookie returned'))
        return
      }
      resolve(setCookie.map(c => c.split(';')[0]).join('; '))
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

test.describe.serial('Reporter with authentication enabled', () => {
  test.beforeAll(async () => {
    // Remove stale test database so the server starts fresh
    if (existsSync(DB_PATH)) rmSync(DB_PATH)
    if (existsSync(STORAGE_PATH)) rmSync(STORAGE_PATH, { recursive: true, force: true })

    const appDir = resolve(process.cwd())

    authServer = spawn('npm', ['run', 'dev'], {
      cwd: appDir,
      env: {
        ...process.env,
        NUXT_AUTH_ENABLED: 'true',
        NUXT_AUTH_SECRET: AUTH_SECRET,
        DATABASE_PATH: DB_PATH,
        STORAGE_PATH,
        NITRO_PORT: String(AUTH_PORT)
      },
      stdio: 'pipe'
    })

    authServer.stderr?.on('data', (data: Buffer) => {
      if (process.env.DEBUG_AUTH_SERVER) {
        process.stderr.write(`[auth-server] ${data}`)
      }
    })

    authServer.stdout?.on('data', (data: Buffer) => {
      if (process.env.DEBUG_AUTH_SERVER) {
        process.stdout.write(`[auth-server] ${data}`)
      }
    })

    await waitForServer(AUTH_SERVER_URL)
  }, SERVER_START_TIMEOUT + 10000)

  test.afterAll(() => {
    if (authServer) {
      authServer.kill('SIGTERM')
      authServer = null
    }
    if (existsSync(DB_PATH)) rmSync(DB_PATH)
    if (existsSync(STORAGE_PATH)) rmSync(STORAGE_PATH, { recursive: true, force: true })
  })

  // ---------------------------------------------------------------------------
  // Auth server sanity checks
  // ---------------------------------------------------------------------------

  test('/api/auth/me should indicate auth is enabled and no user is logged in', async ({ request }) => {
    const res = await request.get(`${AUTH_SERVER_URL}/api/auth/me`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    // When auth is enabled and no session exists, authenticated is false
    expect(data.authenticated).toBe(false)
    expect(data.user).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Initial setup
  // ---------------------------------------------------------------------------

  test('should create admin user via setup endpoint', async ({ request }) => {
    const res = await request.post(`${AUTH_SERVER_URL}/api/auth/setup`, {
      data: {
        username: 'admin',
        password: 'adminpassword123',
        name: 'Administrator'
      }
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.username).toBe('admin')
    expect(data.user.role).toBe('administrator')
  })

  test('setup endpoint should reject a second call once users exist', async ({ request }) => {
    const res = await request.post(`${AUTH_SERVER_URL}/api/auth/setup`, {
      data: { username: 'admin2', password: 'password123' }
    })
    expect(res.status()).toBe(400)
  })

  // ---------------------------------------------------------------------------
  // Login / logout
  // ---------------------------------------------------------------------------

  test('should log in with valid credentials', async ({ request }) => {
    const res = await request.post(`${AUTH_SERVER_URL}/api/auth/login`, {
      data: { username: 'admin', password: 'adminpassword123' }
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.user.username).toBe('admin')
  })

  test('should reject login with invalid credentials', async ({ request }) => {
    const res = await request.post(`${AUTH_SERVER_URL}/api/auth/login`, {
      data: { username: 'admin', password: 'wrongpassword' }
    })
    expect(res.status()).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // Protected endpoints are blocked without auth
  // ---------------------------------------------------------------------------

  test('submit endpoint should return 401 without authentication', async ({ request }) => {
    const res = await request.post(`${AUTH_SERVER_URL}/api/test-runs/submit`, {
      data: {
        projectName: 'reporter-auth-test',
        status: 'passed',
        startTime: new Date().toISOString(),
        duration: 1000,
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        skippedTests: 0,
        testCases: []
      }
    })
    expect(res.status()).toBe(401)
  })

  // ---------------------------------------------------------------------------
  // Create a dedicated reporter user
  // ---------------------------------------------------------------------------

  test('admin can create a reporter user', async ({ request }) => {
    // Log in as admin first
    const loginRes = await request.post(`${AUTH_SERVER_URL}/api/auth/login`, {
      data: { username: 'admin', password: 'adminpassword123' }
    })
    expect(loginRes.ok()).toBeTruthy()

    // Create a reporter user
    const res = await request.post(`${AUTH_SERVER_URL}/api/users`, {
      data: {
        username: 'ci-reporter',
        password: 'reporterpassword123',
        role: 'reporter',
        name: 'CI Reporter'
      }
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data.username).toBe('ci-reporter')
    expect(data.role).toBe('reporter')
  })

  // ---------------------------------------------------------------------------
  // Reporter submits results when authenticated
  // ---------------------------------------------------------------------------

  test('reporter can submit test results after login', async ({ request }) => {
    // Login as reporter user
    const loginRes = await request.post(`${AUTH_SERVER_URL}/api/auth/login`, {
      data: { username: 'ci-reporter', password: 'reporterpassword123' }
    })
    expect(loginRes.ok()).toBeTruthy()

    // Submit test results in the same authenticated session
    const submitRes = await request.post(`${AUTH_SERVER_URL}/api/test-runs/submit`, {
      data: {
        projectName: 'reporter-auth-test',
        status: 'passed',
        startTime: new Date().toISOString(),
        duration: 5000,
        totalTests: 2,
        passedTests: 2,
        failedTests: 0,
        skippedTests: 0,
        testCases: [
          {
            title: 'login page loads',
            status: 'passed',
            duration: 1200,
            location: 'tests/login.spec.ts:5:3',
            retries: 0
          },
          {
            title: 'dashboard shows stats',
            status: 'passed',
            duration: 800,
            location: 'tests/dashboard.spec.ts:10:3',
            retries: 0
          }
        ]
      }
    })
    expect(submitRes.ok()).toBeTruthy()
    const data = await submitRes.json()
    expect(data.success).toBe(true)
    expect(data.testRunId).toBeDefined()
    expect(data.projectId).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Reporter module – login + submit flow using the reporter's own upload helpers
  // ---------------------------------------------------------------------------

  test('reporter lib loginUser returns a session cookie', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loginUser } = require('../../../reporter/lib/upload') as {
      loginUser: (serverUrl: string, username: string, password: string, verbose: boolean) => Promise<string>
    }

    const cookie = await loginUser(AUTH_SERVER_URL, 'ci-reporter', 'reporterpassword123', false)
    expect(typeof cookie).toBe('string')
    expect(cookie.length).toBeGreaterThan(0)
  })

  test('reporter lib loginUser rejects wrong credentials', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loginUser } = require('../../../reporter/lib/upload') as {
      loginUser: (serverUrl: string, username: string, password: string, verbose: boolean) => Promise<string>
    }

    await expect(loginUser(AUTH_SERVER_URL, 'ci-reporter', 'wrongpassword', false))
      .rejects.toThrow()
  })

  test('reporter lib postJSON with session cookie submits successfully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loginUser, postJSON } = require('../../../reporter/lib/upload') as {
      loginUser: (serverUrl: string, username: string, password: string, verbose: boolean) => Promise<string>
      postJSON: (serverUrl: string, pathname: string, payload: object, verbose: boolean, cookie?: string) => Promise<Record<string, unknown>>
    }

    const cookie = await loginUser(AUTH_SERVER_URL, 'ci-reporter', 'reporterpassword123', false)

    const payload = {
      projectName: 'reporter-auth-lib-test',
      status: 'passed',
      startTime: new Date().toISOString(),
      duration: 3000,
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      skippedTests: 0,
      testCases: [
        {
          title: 'submit via lib',
          status: 'passed',
          duration: 500,
          location: 'tests/lib.spec.ts:1:1',
          retries: 0
        }
      ]
    }

    const result = await postJSON(AUTH_SERVER_URL, '/api/test-runs/submit', payload, false, cookie)
    expect(result.success).toBe(true)
    expect(result.testRunId).toBeDefined()
  })

  test('reporter lib postJSON without cookie returns auth error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { postJSON } = require('../../../reporter/lib/upload') as {
      postJSON: (serverUrl: string, pathname: string, payload: object, verbose: boolean, cookie?: string) => Promise<Record<string, unknown>>
    }

    const payload = {
      projectName: 'reporter-auth-lib-test',
      status: 'passed',
      startTime: new Date().toISOString(),
      duration: 1000,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testCases: []
    }

    await expect(postJSON(AUTH_SERVER_URL, '/api/test-runs/submit', payload, false))
      .rejects.toThrow('401')
  })

  // ---------------------------------------------------------------------------
  // Full PlaywrightDashboardReporter flow with username/password options
  // ---------------------------------------------------------------------------

  test('PlaywrightDashboardReporter submits results with username/password options', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PlaywrightDashboardReporter = require('../../../reporter/index') as new (opts: object) => {
      onBegin: (config: object, suite: object) => void
      onTestEnd: (test: object, result: object) => void
      onEnd: (result: object) => Promise<void>
    }

    const reporter = new PlaywrightDashboardReporter({
      serverUrl: AUTH_SERVER_URL,
      projectName: 'reporter-full-auth-test',
      uploadReport: false,
      uploadTraces: false,
      collectScmInfo: false,
      collectCiInfo: false,
      collectPerformanceMetrics: false,
      username: 'ci-reporter',
      password: 'reporterpassword123',
      verbose: false
    })

    // Simulate a minimal reporter lifecycle
    reporter.onBegin(
      { projects: [], workers: 1, timeout: 30000, fullyParallel: false },
      { allTests: () => [] }
    )

    reporter.onTestEnd(
      {
        title: 'homepage renders correctly',
        location: { file: join(resolve(process.cwd()), 'tests', 'home.spec.ts'), line: 5, column: 3 }
      },
      {
        status: 'passed',
        duration: 900,
        error: null,
        retry: 0,
        attachments: [],
        steps: []
      }
    )

    await reporter.onEnd({ status: 'passed' })

    // Verify the project was created (GET endpoints are public)
    const projectsRes = await new Promise<{ status: number, body: unknown[] }>((resolve, reject) => {
      http.get(`${AUTH_SERVER_URL}/api/projects`, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk })
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode ?? 0, body: [] })
          }
        })
      }).on('error', reject)
    })

    expect(projectsRes.status).toBe(200)
    const projects = projectsRes.body as Array<{ name: string }>
    const project = projects.find(p => p.name === 'reporter-full-auth-test')
    expect(project).toBeDefined()
  })

  test('PlaywrightDashboardReporter fails when auth is required but no credentials given', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PlaywrightDashboardReporter = require('../../../reporter/index') as new (opts: object) => {
      onBegin: (config: object, suite: object) => void
      onTestEnd: (test: object, result: object) => void
      onEnd: (result: object) => Promise<void>
    }

    const reporter = new PlaywrightDashboardReporter({
      serverUrl: AUTH_SERVER_URL,
      projectName: 'reporter-no-auth-test',
      uploadReport: false,
      uploadTraces: false,
      collectScmInfo: false,
      collectCiInfo: false,
      collectPerformanceMetrics: false,
      verbose: false
    })

    reporter.onBegin(
      { projects: [], workers: 1, timeout: 30000, fullyParallel: false },
      { allTests: () => [] }
    )

    await expect(reporter.onEnd({ status: 'passed' })).rejects.toThrow()
  })
})

