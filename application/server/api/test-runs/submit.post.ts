import { getDatabase } from '../../database'
import { projects, testRuns, testCases, testRunsCases } from '../../database/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../utils/auth'

/**
 * Strip query string and fragment from a URL, keeping only scheme + host + path.
 * This prevents query parameters (tokens, session IDs, etc.) from being persisted.
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    // Not a valid absolute URL — return as-is (relative paths, etc.)
    return url
  }
}

/**
 * Sanitize an array of network request objects by stripping query params from each URL.
 */
function sanitizeNetworkRequests(
  requests: Array<Record<string, unknown>> | null | undefined
): Array<Record<string, unknown>> | null {
  if (!requests || !Array.isArray(requests)) return null
  return requests.map(req => ({
    ...req,
    url: typeof req.url === 'string' ? sanitizeUrl(req.url) : req.url
  }))
}

/**
 * Sanitize webVitals by stripping the query string from the navigation URL.
 */
function sanitizeWebVitals(vitals: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!vitals || typeof vitals !== 'object') return null
  const nav = vitals.navigation as Record<string, unknown> | null | undefined
  if (!nav) return vitals
  return {
    ...vitals,
    navigation: {
      ...nav,
      url: typeof nav.url === 'string' ? sanitizeUrl(nav.url) : nav.url
    }
  }
}

export default eventHandler(async (event) => {
  // Require reporter or administrator role for submitting test results
  await requireAuth(event, ['reporter', 'administrator'])

  const body = await readBody(event)

  // Validate required fields
  if (!body.projectName || !body.status || !body.startTime) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: projectName, status, startTime'
    })
  }

  const db = await getDatabase()

  // Get or create project
  const existingProjects = await db.select().from(projects).where(eq(projects.name, body.projectName))
  let project = existingProjects[0]

  if (!project) {
    const result = await db.insert(projects).values({
      name: body.projectName,
      description: body.projectDescription || null
    }).returning()
    project = result[0]
  }

  if (!project) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create or retrieve project'
    })
  }

  // Create test run
  const testRunResult = await db.insert(testRuns).values({
    projectId: project.id,
    status: body.status,
    startTime: new Date(body.startTime),
    duration: body.duration || null,
    totalTests: body.totalTests || 0,
    passedTests: body.passedTests || 0,
    failedTests: body.failedTests || 0,
    skippedTests: body.skippedTests || 0,
    reportPath: body.reportPath || null,
    metadata: body.metadata || null
  }).returning()

  const testRun = testRunResult[0]

  if (!testRun) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create test run'
    })
  }

  // Insert test cases if provided and calculate flaky tests
  let flakyTestCount = 0
  if (body.testCases && Array.isArray(body.testCases) && body.testCases.length > 0) {
    // Calculate flaky tests (tests that passed after retries)
    flakyTestCount = body.testCases.filter((testCase: {
      status: string
      retries?: number
    }) => testCase.status === 'passed' && (testCase.retries || 0) > 0).length

    // Process each test case
    for (const testCase of body.testCases) {
      // Parse location to extract file path, line, and column
      let filePath = 'unknown'
      let line: number | null = null
      let column: number | null = null

      if (testCase.location) {
        const locationParts = testCase.location.split(':')
        if (locationParts.length >= 1) {
          filePath = locationParts[0]
        }
        if (locationParts.length >= 2) {
          line = parseInt(locationParts[1], 10) || null
        }
        if (locationParts.length >= 3) {
          column = parseInt(locationParts[2], 10) || null
        }
      }

      // Get or create shared test case
      const existingTestCases = await db.select()
        .from(testCases)
        .where(
          and(
            eq(testCases.projectId, project.id),
            eq(testCases.filePath, filePath),
            eq(testCases.title, testCase.title)
          )
        )

      let sharedTestCase = existingTestCases[0]

      if (!sharedTestCase) {
        const result = await db.insert(testCases).values({
          projectId: project.id,
          filePath: filePath,
          title: testCase.title
        }).returning()
        sharedTestCase = result[0]
      } else {
        // Update the updatedAt timestamp
        await db.update(testCases)
          .set({ updatedAt: new Date() })
          .where(eq(testCases.id, sharedTestCase.id))
      }

      // Insert test run case with run-specific data
      // Ensure sharedTestCase is defined
      if (!sharedTestCase) {
        throw new Error('Failed to create or retrieve test case')
      }

      await db.insert(testRunsCases).values({
        testRunId: testRun.id,
        testCaseId: sharedTestCase.id,
        status: testCase.status,
        duration: testCase.duration || null,
        error: testCase.error || null,
        retries: testCase.retries || 0,
        line: line,
        column: column,
        steps: testCase.steps || null,
        slowestStep: testCase.slowestStep || null,
        slowestStepDuration: testCase.slowestStepDuration || null,
        networkRequests: sanitizeNetworkRequests(testCase.networkRequests) || null,
        webVitals: sanitizeWebVitals(testCase.webVitals) || null
      })
    }
  }

  // Update test run with flaky test count if any were found
  if (flakyTestCount > 0) {
    await db.update(testRuns)
      .set({ flakyTests: flakyTestCount })
      .where(eq(testRuns.id, testRun.id))
  }

  // Compute and store performance summary (avgTestDuration, p90TestDuration)
  if (body.testCases && Array.isArray(body.testCases) && body.testCases.length > 0) {
    const durations = body.testCases
      .filter((tc: { duration?: number }) => tc.duration !== null && tc.duration !== undefined)
      .map((tc: { duration: number }) => tc.duration)

    if (durations.length > 0) {
      const sum = durations.reduce((a: number, b: number) => a + b, 0)
      const avgTestDuration = Math.round(sum / durations.length)
      const sortedDurations = [...durations].sort((a: number, b: number) => a - b)
      const p90Index = Math.max(0, Math.ceil((90 / 100) * sortedDurations.length) - 1)
      const p90TestDuration = sortedDurations[p90Index]

      await db.update(testRuns)
        .set({ avgTestDuration, p90TestDuration })
        .where(eq(testRuns.id, testRun.id))
    }
  }

  return {
    success: true,
    testRunId: testRun.id,
    projectId: project.id
  }
})
