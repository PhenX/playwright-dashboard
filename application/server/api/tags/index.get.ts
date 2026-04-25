import { getDatabase } from '../../database'
import { tags } from '../../database/schema'
import { asc } from 'drizzle-orm'

export default eventHandler(async () => {
  const db = await getDatabase()
  const allTags = await db.select().from(tags).orderBy(asc(tags.text))
  return { tags: allTags }
})
