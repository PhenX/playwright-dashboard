import { getDatabase } from '../../database'
import { testRuns, testRunsCases, traces, reports } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../utils/auth'
import { getStorage } from '../../storage'

export default eventHandler(async (event) => {
  await requireAuth(event, ['administrator'])

  const id = parseInt(getRouterParam(event, 'id') || '0')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Invalid test run ID'
    })
  }

  const db = await getDatabase()

  const testRunResults = await db.select().from(testRuns).where(eq(testRuns.id, id))
  const testRun = testRunResults[0]

  if (!testRun) {
    throw createError({
      statusCode: 404,
      message: 'Test run not found'
    })
  }

  // Collect report paths to delete from storage
  const reportRows = await db.select().from(reports).where(eq(reports.testRunId, id))

  // Get test run cases to find traces
  const runsCases = await db.select({ id: testRunsCases.id }).from(testRunsCases).where(eq(testRunsCases.testRunId, id))
  const caseIds = runsCases.map(c => c.id)

  // Delete traces from DB and storage
  // Note: trace.filePath may be a file or directory; deleteDirectory handles both via recursive rm
  const storage = getStorage()
  for (const caseId of caseIds) {
    const traceRows = await db.select().from(traces).where(eq(traces.testRunsCaseId, caseId))
    for (const trace of traceRows) {
      try {
        await storage.deleteDirectory(trace.filePath)
      } catch {
        // Ignore missing files
      }
    }
    await db.delete(traces).where(eq(traces.testRunsCaseId, caseId))
  }

  // Delete test run cases
  await db.delete(testRunsCases).where(eq(testRunsCases.testRunId, id))

  // Delete report files from storage and DB
  for (const report of reportRows) {
    try {
      await storage.deleteDirectory(report.path)
    } catch {
      // Ignore missing files
    }
  }
  await db.delete(reports).where(eq(reports.testRunId, id))

  // Delete legacy report path from storage (if any)
  if (testRun.reportPath) {
    try {
      await storage.deleteDirectory(testRun.reportPath)
    } catch {
      // Ignore missing files
    }
  }

  // Delete the test run
  await db.delete(testRuns).where(eq(testRuns.id, id))

  return { success: true }
})
