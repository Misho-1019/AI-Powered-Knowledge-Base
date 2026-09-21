import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/db'
import { account, session, user, verification } from '@/db/auth-schema'

/**
 * Better Auth instance.
 *
 * Users and sessions live in the same Neon database as documents, which is what
 * makes `documents.user_id -> user.id ON DELETE CASCADE` possible — the
 * referential integrity that a hosted auth provider could not give us.
 *
 * Secrets/base URL are read from the environment:
 *   BETTER_AUTH_SECRET  (required in production)
 *   BETTER_AUTH_URL     (required in production)
 *
 * Email verification is intentionally disabled so no mail provider is needed.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    // Only the four tables — the generated module also exports relation
    // helpers, which the adapter has no use for.
    schema: { user, session, account, verification },
  }),
  advanced: {
    database: {
      // Use UUIDs so auth ids match the uuid columns used elsewhere in the
      // schema (`documents.id`, `documents.user_id`). Without this Better Auth
      // generates compact text ids, and the FK to `documents.user_id` would be
      // a uuid -> text type mismatch.
      generateId: 'uuid',
    },
  },
  emailAndPassword: {
    enabled: true,
    // No mail provider configured, so don't require a verification round-trip.
    requireEmailVerification: false,
  },
  // Must be the last plugin.
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
