import type { H3Event } from 'h3'
import { getDatabase } from '../database'
import { users } from '../database/schema'
import { eq } from 'drizzle-orm'
import type { User } from '../database/schema'

// Simple password hashing using built-in crypto
async function hashPassword(password: string): Promise<string> {
  // Use Web Crypto API for password hashing
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password)
  return passwordHash === hash
}

// Session management using encrypted cookies
interface SessionData {
  userId: number
  username: string
  role: string
}

// Get session from cookie
export async function getUserSession(event: H3Event): Promise<SessionData | null> {
  const config = useRuntimeConfig(event)
  if (!config.authEnabled) {
    return null
  }

  const sessionCookie = getCookie(event, 'session')
  if (!sessionCookie) {
    return null
  }

  try {
    // Decrypt session data
    const sessionData = await unsealData<SessionData>(sessionCookie, {
      password: config.authSecret
    })
    return sessionData
  } catch {
    // Invalid or expired session
    return null
  }
}

// Set session in cookie
export async function setUserSession(event: H3Event, sessionData: SessionData): Promise<void> {
  const config = useRuntimeConfig(event)
  const sealed = await sealData(sessionData, {
    password: config.authSecret,
    ttl: 60 * 60 * 24 * 7 // 7 days
  })

  setCookie(event, 'session', sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })
}

// Clear session cookie
export function clearUserSession(event: H3Event): void {
  deleteCookie(event, 'session', {
    path: '/'
  })
}

// Get current user from session
export async function getCurrentUser(event: H3Event): Promise<User | null> {
  const session = await getUserSession(event)
  if (!session) {
    return null
  }

  const db = getDatabase()
  const userResults = await db.select().from(users).where(eq(users.id, session.userId))
  return userResults[0] || null
}

// Verify user credentials and return user
export async function verifyUser(username: string, password: string): Promise<User | null> {
  const db = getDatabase()
  const userResults = await db.select().from(users).where(eq(users.username, username))
  const user = userResults[0]

  if (!user) {
    return null
  }

  const valid = await verifyPassword(password, user.password)
  if (!valid) {
    return null
  }

  return user
}

// Create a new user
export async function createUser(username: string, password: string, role: string, name?: string): Promise<User> {
  const db = getDatabase()
  const hashedPassword = await hashPassword(password)

  const result = await db.insert(users).values({
    username,
    password: hashedPassword,
    role,
    name: name || null
  }).returning()

  const user = result[0]
  if (!user) {
    throw new Error('Failed to create user')
  }

  return user
}

// Check if user has required role
export function hasRole(user: User | null, requiredRoles: string[]): boolean {
  if (!user) {
    return false
  }
  return requiredRoles.includes(user.role)
}

// Check if authentication is enabled
export function isAuthEnabled(event?: H3Event): boolean {
  const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
  return config.authEnabled === true
}

// Require authentication - throw error if not authenticated
export async function requireAuth(event: H3Event, allowedRoles?: string[]): Promise<User> {
  if (!isAuthEnabled(event)) {
    // If auth is disabled, create a virtual admin user
    return {
      id: 0,
      username: 'system',
      password: '',
      role: 'administrator',
      name: 'System',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required'
    })
  }

  if (allowedRoles && !hasRole(user, allowedRoles)) {
    throw createError({
      statusCode: 403,
      message: 'Insufficient permissions'
    })
  }

  return user
}
