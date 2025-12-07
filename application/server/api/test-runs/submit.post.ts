import { getDatabase } from '../../database'
import { projects, testRuns, testCases } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const body = await readBody(event)

  // Validate required fields
  if (!body.projectName || !body.status || !body.startTime) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: projectName, status, startTime'
    })
  }

  const db = getDatabase()

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

  // Insert test cases if provided
  if (body.testCases && Array.isArray(body.testCases) && body.testCases.length > 0) {
    // Bulk insert test cases for better performance
    const testCaseValues = body.testCases.map((testCase: {
      title: string
      location?: string
      status: string
      duration?: number
      error?: string
      retries?: number
    }) => ({
      testRunId: testRun.id,
      title: testCase.title,
      location: testCase.location || null,
      status: testCase.status,
      duration: testCase.duration || null,
      error: testCase.error || null,
      retries: testCase.retries || 0
    }))

    await db.insert(testCases).values(testCaseValues)
  }

  return {
    success: true,
    testRunId: testRun.id,
    projectId: project.id
  }
})
