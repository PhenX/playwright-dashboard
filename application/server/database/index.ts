import { drizzle } from 'drizzle-orm/libsql/sqlite3'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { pathToFileURL } from 'url'

let db: ReturnType<typeof drizzle>

export function initDatabase() {
  if (!db) {
    if (!process.env.DATABASE_PATH && !existsSync('.data')) {
      mkdirSync('.data')
    }

    // Use environment variable or default to .data/playwright.db
    const dbPath = process.env.DATABASE_PATH || '.data/playwright.db'
    // Convert to absolute path and create proper file URL for cross-platform compatibility
    const absolutePath = resolve(dbPath)
    const dbUrl = pathToFileURL(absolutePath).href
    db = drizzle(dbUrl, { schema })

    // Run migrations
    try {
      // In production/dev, migrations folder is relative to the project root
      const migrationsFolder = resolve(process.cwd(), 'server/database/migrations')
      console.log(`[Database] Running migrations from ${migrationsFolder}`)
      migrate(db, { migrationsFolder })
      console.log('[Database] Migrations completed successfully')
    } catch (error) {
      console.error('[Database] Migration error:', error)
      throw error
    }
  }

  return db
}

export function getDatabase() {
  if (!db) {
    return initDatabase()
  }
  return db
}
