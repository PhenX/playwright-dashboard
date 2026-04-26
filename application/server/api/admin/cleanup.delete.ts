import { getDatabase } from '../../database'
import { testRuns, testRunsCases, traces, reports } from '../../database/schema'
import { lt, inArray } from 'drizzle-orm'
import { requireAuth } from '../../utils/auth'
import { getStorage } from '../../storage'

export default eventHandler(async (event) => {
  await requireAuth(event, ['administrator'])

  const body = await readBody(event)

  // olderThanDays: number — delete runs whose startTime is older than this many days
  const olderThanDays = parseInt(body?.olderThanDays ?? '0', 10)

  const MS_PER_DAY = 24 * 60 * 60 * 1000

  if (!olderThanDays || olderThanDays < 1) {
    throw createError({
      statusCode: 400,
      message: 'olderThanDays must be a positive integer'
    })
  }

  const cutoffDate = new Date(Date.now() - olderThanDays * MS_PER_DAY)

  const db = await getDatabase()
  const storage = getStorage()

  // Find all runs older than the cutoff
  const oldRuns = await db.select({ id: testRuns.id, reportPath: testRuns.reportPath })
    .from(testRuns)
    .where(lt(testRuns.startTime, cutoffDate))

  if (oldRuns.length === 0) {
    return { success: true, deletedRuns: 0 }
  }

  const runIds = oldRuns.map(r => r.id)

  // Collect all test run case IDs for these runs
  const runsCases = await db.select({ id: testRunsCases.id })
    .from(testRunsCases)
    .where(inArray(testRunsCases.testRunId, runIds))

  const caseIds = runsCases.map(c => c.id)

  // Delete traces from storage and DB
  if (caseIds.length > 0) {
    const traceRows = await db.select().from(traces)
      .where(inArray(traces.testRunsCaseId, caseIds))

    for (const trace of traceRows) {
      try {
        await storage.deleteDirectory(trace.filePath)
      } catch {
        // Ignore missing files
      }
    }
    await db.delete(traces).where(inArray(traces.testRunsCaseId, caseIds))
    await db.delete(testRunsCases).where(inArray(testRunsCases.testRunId, runIds))
  }

  // Delete report files from storage and DB
  const reportRows = await db.select().from(reports)
    .where(inArray(reports.testRunId, runIds))

  for (const report of reportRows) {
    try {
      await storage.deleteDirectory(report.path)
    } catch {
      // Ignore missing files
    }
  }
  await db.delete(reports).where(inArray(reports.testRunId, runIds))

  // Delete legacy report paths
  for (const run of oldRuns) {
    if (run.reportPath) {
      try {
        await storage.deleteDirectory(run.reportPath)
      } catch {
        // Ignore missing files
      }
    }
  }

  // Delete the test runs
  await db.delete(testRuns).where(inArray(testRuns.id, runIds))

  return { success: true, deletedRuns: oldRuns.length }
})
