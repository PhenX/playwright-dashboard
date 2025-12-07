import { getDatabase } from '../../database'
import { projects, testRuns, testCases, traces } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export default eventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  
  if (!formData) {
    throw createError({
      statusCode: 400,
      message: 'No form data provided'
    })
  }

  // Parse form fields
  let projectName: string | undefined
  let testRunData: any
  let testCasesData: any[] = []
  const htmlReports: { filename: string; data: Buffer }[] = []
  const traceFiles: { testCaseIndex: number; filename: string; data: Buffer }[] = []

  for (const part of formData) {
    if (part.name === 'projectName') {
      projectName = part.data.toString('utf-8')
    } else if (part.name === 'testRun') {
      testRunData = JSON.parse(part.data.toString('utf-8'))
    } else if (part.name === 'testCases') {
      testCasesData = JSON.parse(part.data.toString('utf-8'))
    } else if (part.name === 'htmlReport' && part.filename) {
      htmlReports.push({
        filename: part.filename,
        data: part.data
      })
    } else if (part.name?.startsWith('trace_') && part.filename) {
      // Extract test case index from field name like 'trace_0', 'trace_1', etc.
      const match = part.name.match(/trace_(\d+)/)
      if (match) {
        traceFiles.push({
          testCaseIndex: parseInt(match[1]),
          filename: part.filename,
          data: part.data
        })
      }
    }
  }

  // Validate required fields
  if (!projectName || !testRunData) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: projectName, testRun'
    })
  }

  const db = getDatabase()

  // Get or create project
  const existingProjects = await db.select().from(projects).where(eq(projects.name, projectName))
  let project = existingProjects[0]
  
  if (!project) {
    const result = await db.insert(projects).values({
      name: projectName,
      description: testRunData.projectDescription || null
    }).returning()
    project = result[0]
  }

  if (!project) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create or retrieve project'
    })
  }

  // Create storage directory structure
  const storagePath = process.env.STORAGE_PATH || '.data/storage'
  const projectPath = join(storagePath, `project-${project.id}`)
  
  if (!existsSync(projectPath)) {
    await mkdir(projectPath, { recursive: true })
  }

  // Save HTML report if provided
  let reportPath: string | null = null
  if (htmlReports.length > 0) {
    const report = htmlReports[0]
    const reportFilename = `run-${Date.now()}-${report.filename}`
    reportPath = join(projectPath, reportFilename)
    await writeFile(reportPath, report.data)
  }

  // Create test run
  const testRunResult = await db.insert(testRuns).values({
    projectId: project.id,
    status: testRunData.status,
    startTime: new Date(testRunData.startTime),
    duration: testRunData.duration || null,
    totalTests: testRunData.totalTests || 0,
    passedTests: testRunData.passedTests || 0,
    failedTests: testRunData.failedTests || 0,
    skippedTests: testRunData.skippedTests || 0,
    reportPath: reportPath,
    metadata: testRunData.metadata || null
  }).returning()

  const testRun = testRunResult[0]

  if (!testRun) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create test run'
    })
  }

  // Create test run directory for traces
  const testRunPath = join(projectPath, `run-${testRun.id}`)
  if (!existsSync(testRunPath)) {
    await mkdir(testRunPath, { recursive: true })
  }

  // Insert test cases with traces
  if (testCasesData && testCasesData.length > 0) {
    const testCaseValues = testCasesData.map(testCase => ({
      testRunId: testRun.id,
      title: testCase.title,
      location: testCase.location || null,
      status: testCase.status,
      duration: testCase.duration || null,
      error: testCase.error || null,
      retries: testCase.retries || 0
    }))
    
    const insertedTestCases = await db.insert(testCases).values(testCaseValues).returning()

    // Save trace files and create trace records
    const allTraces = []
    for (let i = 0; i < insertedTestCases.length; i++) {
      const testCase = insertedTestCases[i]
      const traceFilesForCase = traceFiles.filter(t => t.testCaseIndex === i)
      
      for (const traceFile of traceFilesForCase) {
        const traceFilename = `test-${testCase.id}-${traceFile.filename}`
        const tracePath = join(testRunPath, traceFilename)
        await writeFile(tracePath, traceFile.data)
        
        allTraces.push({
          testCaseId: testCase.id,
          tracePath: tracePath
        })
      }
    }

    // Bulk insert traces
    if (allTraces.length > 0) {
      await db.insert(traces).values(allTraces)
    }
  }

  return {
    success: true,
    testRunId: testRun.id,
    projectId: project.id,
    reportPath: reportPath,
    tracesCount: traceFiles.length
  }
})
