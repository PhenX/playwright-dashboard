import { getDatabase } from '../../database'
import { projects } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name must be at most 100 characters'),
  label: z.string().optional().nullable(),
  description: z.string().optional().nullable()
})

export default eventHandler(async (event) => {
  await requireAuth(event, ['administrator'])

  const body = await readBody(event)
  const validation = createProjectSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: validation.error.issues
    })
  }

  const { name, label, description } = validation.data
  const db = await getDatabase()

  // Check if a project with this name already exists
  const existing = await db.select().from(projects).where(eq(projects.name, name))
  if (existing.length > 0) {
    throw createError({
      statusCode: 400,
      message: 'A project with this name already exists'
    })
  }

  const result = await db.insert(projects).values({ name, label, description }).returning()

  return { project: result[0] }
})
