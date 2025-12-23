import { drizzle } from 'drizzle-orm/libsql/sqlite3'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'
import { existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'

let db: ReturnType<typeof drizzle>
let migrationPromise: Promise<void> | null = null

export async function initDatabase() {
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
    migrationPromise = (async () => {
      try {
        // Determine the migrations folder path based on the environment
        let migrationsFolder: string

        // Check if running from built output (Nitro bundles code in .output/server/)
        // In Docker, the path would be /app/.output/server/chunks/...
        // Try to detect if we're in a bundled scenario
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = dirname(__filename)

        // First, try relative to the current module (works when bundled in .output/server/chunks/nitro/)
        // The migrations are at .output/server/database/migrations
        migrationsFolder = resolve(__dirname, '../../database/migrations')

        // If not found, try common development paths
        if (!existsSync(migrationsFolder)) {
          migrationsFolder = resolve(process.cwd(), 'server/database/migrations')
        }

        // If not found, try output directory paths (when running from .output)
        if (!existsSync(migrationsFolder)) {
          migrationsFolder = resolve(process.cwd(), '.output/server/database/migrations')
        }

        console.log(`[Database] Running migrations from ${migrationsFolder}`)

        if (!existsSync(migrationsFolder)) {
          console.error(`[Database] Migrations folder not found: ${migrationsFolder}`)
          console.error(`[Database] __dirname: ${__dirname}`)
          console.error(`[Database] process.cwd(): ${process.cwd()}`)
          throw new Error(`Migrations folder not found: ${migrationsFolder}`)
        }

        await migrate(db, { migrationsFolder })
        console.log('[Database] Migrations completed successfully')
      } catch (error) {
        console.error('[Database] Migration error:', error)
        throw error
      }
    })()
  }

  // Wait for migrations to complete before returning
  if (migrationPromise) {
    await migrationPromise
    migrationPromise = null
  }

  return db
}

export async function getDatabase() {
  if (!db) {
    return await initDatabase()
  }

  // Wait for migrations to complete if they're still running
  if (migrationPromise) {
    await migrationPromise
    migrationPromise = null
  }

  return db
}
