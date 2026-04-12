import { test, expect } from '@playwright/test'

test.describe('Performance API Tests', () => {
  let projectId: number
  let testRunId: number

  test('should submit test results with performance data', async ({ request }) => {
    const response = await request.post('/api/test-runs/submit', {
      data: {
        projectName: 'perf-test-project',
        status: 'passed',
        startTime: new Date().toISOString(),
        duration: 60000,
        totalTests: 3,
        passedTests: 2,
        failedTests: 1,
        skippedTests: 0,
        testCases: [
          {
            title: 'fast test',
            status: 'passed',
            duration: 500,
            location: 'tests/fast.spec.ts:1:1',
            retries: 0,
            steps: [
              { title: 'page.goto(http://localhost)', duration: 200, category: 'navigation' },
              { title: 'expect(locator).toBeVisible()', duration: 50, category: 'assertion' }
            ],
            slowestStep: 'page.goto(http://localhost)',
            slowestStepDuration: 200
          },
          {
            title: 'slow test',
            status: 'passed',
            duration: 15000,
            location: 'tests/slow.spec.ts:1:1',
            retries: 0,
            steps: [
              { title: 'page.goto(http://localhost/heavy)', duration: 5000, category: 'navigation' },
              { title: 'locator.click(submit)', duration: 3000, category: 'action' },
              { title: 'expect(locator).toHaveText()', duration: 4000, category: 'assertion' }
            ],
            slowestStep: 'page.goto(http://localhost/heavy)',
            slowestStepDuration: 5000
          },
          {
            title: 'failing test',
            status: 'failed',
            duration: 8000,
            location: 'tests/fail.spec.ts:1:1',
            error: 'Timeout exceeded',
            retries: 1,
            steps: [
              { title: 'page.goto(http://localhost/broken)', duration: 8000, category: 'navigation' }
            ],
            slowestStep: 'page.goto(http://localhost/broken)',
            slowestStepDuration: 8000
          }
        ]
      }
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.testRunId).toBeDefined()
    expect(data.projectId).toBeDefined()
    projectId = data.projectId
    testRunId = data.testRunId
  })

  test('should return test run with performance data', async ({ request }) => {
    const response = await request.get(`/api/test-runs/${testRunId}`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.avgTestDuration).toBeDefined()
    expect(data.p90TestDuration).toBeDefined()
    expect(data.avgTestDuration).toBeGreaterThan(0)

    // Check test cases have performance data
    const slowTest = data.testCases.find((tc: { title: string }) => tc.title === 'slow test')
    expect(slowTest).toBeDefined()
    expect(slowTest.slowestStep).toBe('page.goto(http://localhost/heavy)')
    expect(slowTest.slowestStepDuration).toBe(5000)
    expect(slowTest.steps).toBeDefined()
    expect(slowTest.steps.length).toBe(3)
  })

  test('should return performance trend data', async ({ request }) => {
    // Submit a second test run to have trend data
    await request.post('/api/test-runs/submit', {
      data: {
        projectName: 'perf-test-project',
        status: 'passed',
        startTime: new Date(Date.now() + 60000).toISOString(),
        duration: 50000,
        totalTests: 2,
        passedTests: 2,
        failedTests: 0,
        skippedTests: 0,
        testCases: [
          {
            title: 'fast test',
            status: 'passed',
            duration: 400,
            location: 'tests/fast.spec.ts:1:1',
            retries: 0
          },
          {
            title: 'slow test',
            status: 'passed',
            duration: 12000,
            location: 'tests/slow.spec.ts:1:1',
            retries: 0
          }
        ]
      }
    })

    const response = await request.get(`/api/projects/${projectId}/performance`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(2)

    // Each point should have performance fields
    const point = data[0]
    expect(point.id).toBeDefined()
    expect(point.startTime).toBeDefined()
    expect(point.status).toBeDefined()
  })

  test('should return slow tests data', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/slow-tests`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)

    // Should be sorted by avg duration descending
    const firstTest = data[0]
    expect(firstTest.title).toBeDefined()
    expect(firstTest.filePath).toBeDefined()
    expect(firstTest.avgDuration).toBeDefined()
    expect(firstTest.maxDuration).toBeDefined()
    expect(firstTest.minDuration).toBeDefined()
    expect(firstTest.trend).toBeDefined()
    expect(['faster', 'slower', 'stable']).toContain(firstTest.trend)
    expect(firstTest.runCount).toBeGreaterThan(0)

    // The slowest test should be first
    if (data.length > 1) {
      expect(data[0].avgDuration).toBeGreaterThanOrEqual(data[1].avgDuration)
    }
  })

  test('should handle slow-tests with custom runs parameter', async ({ request }) => {
    const response = await request.get(`/api/projects/${projectId}/slow-tests?runs=5`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(Array.isArray(data)).toBe(true)
  })

  test('should handle performance endpoint for non-existent project', async ({ request }) => {
    const response = await request.get('/api/projects/99999/performance')
    expect(response.status()).toBe(404)
  })

  test('should handle slow-tests endpoint for non-existent project', async ({ request }) => {
    const response = await request.get('/api/projects/99999/slow-tests')
    expect(response.status()).toBe(404)
  })
})
