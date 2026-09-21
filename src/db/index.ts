import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL — add it to .env.local')
}

/**
 * WebSocket-based Pool (not the HTTP driver) because interactive
 * transactions are required for atomic document re-processing.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const db = drizzle(pool, { schema })

export { schema }
export * from './schema'
