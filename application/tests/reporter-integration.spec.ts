import { test, expect } from '@playwright/test'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

test.describe('Reporter Integration Tests', () => {
  const tempDir = join(process.cwd(), '.test-temp')

  test.beforeAll(() => {
    // Create temp directory for test files
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }
  })

  test('reporter package.json should have correct metadata', async () => {
    const packageJsonPath = join(process.cwd(), '..', 'reporter', 'package.json')
    expect(existsSync(packageJsonPath)).toBe(true)

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

    expect(packageJson.name).toBe('playwright-dashboard-reporter')
    expect(packageJson.main).toBe('index.js')
    expect(packageJson.types).toBe('index.d.ts')
    expect(packageJson.peerDependencies).toBeDefined()
    expect(packageJson.peerDependencies['@playwright/test']).toBeDefined()
  })

  test('reporter should have TypeScript definitions', async () => {
    const typeDefsPath = join(process.cwd(), '..', 'reporter', 'index.d.ts')
    expect(existsSync(typeDefsPath)).toBe(true)

    const typeDefs = readFileSync(typeDefsPath, 'utf-8')
    expect(typeDefs).toContain('DashboardReporterOptions')
    expect(typeDefs).toContain('serverUrl')
    expect(typeDefs).toContain('projectName')
    expect(typeDefs).toContain('uploadReport')
    expect(typeDefs).toContain('uploadTraces')
  })

  test('reporter fixtures.js should exist', async () => {
    const fixturesPath = join(process.cwd(), '..', 'reporter', 'fixtures.js')
    expect(existsSync(fixturesPath)).toBe(true)
  })

  test('reporter fixtures should export dashboardFixtures and test', async () => {
    const fixturesPath = join(process.cwd(), '..', 'reporter', 'fixtures.js')
    expect(existsSync(fixturesPath)).toBe(true)

    // Verify fixture exports by inspecting the source (avoids resolving @playwright/test
    // from the reporter directory which has no node_modules)
    const fixturesSource = readFileSync(fixturesPath, 'utf-8')
    expect(fixturesSource).toContain('dashboardFixtures')
    expect(fixturesSource).toContain('module.exports')
    expect(fixturesSource).toContain('page.on')
    expect(fixturesSource).toContain('requestfinished')
    expect(fixturesSource).toContain('playwright-dashboard-network')
    expect(fixturesSource).toContain('playwright-dashboard-web-vitals')
  })

  test('reporter TypeScript definitions should export dashboardFixtures type', async () => {
    const typeDefsPath = join(process.cwd(), '..', 'reporter', 'index.d.ts')
    const typeDefs = readFileSync(typeDefsPath, 'utf-8')

    expect(typeDefs).toContain('dashboardFixtures')
    expect(typeDefs).toContain('collectPerformanceMetrics')
  })
})
