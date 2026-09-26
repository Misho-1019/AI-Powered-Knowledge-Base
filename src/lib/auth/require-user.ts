import { sql } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { unstable_rethrow } from 'next/navigation'
import { db } from '@/db'
import { auth } from '@/lib/auth'
import { log } from '../log'
import { AUTH_UNAVAILABLE, NOT_AUTHENTICATED } from './classify-auth-error'

export type AuthUser = {
  id: string
  email: string | null
  name: string | null
}

export type RequireUserResult =
  { ok: true; user: AuthUser } | { ok: false; status: 401 | 500; error: string }

/** Better Auth's session cookie, possibly chunked as `.0`, `.1`, … */
const SESSION_COOKIE_PREFIX = 'better-auth.session_token'

async function databaseIsReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`)
    return true
  } catch (err) {
    log.error('[auth] database probe failed', { error: err })
    return false
  }
}

/**
 * The single seam between this app and its auth provider.
 *
 * Phase 3 swapped the implementation from Supabase to Better Auth and NOT ONE
 * caller changed — that was the point of the seam.
 *
 * Two outcomes are deliberately distinct:
 *   401 — the caller genuinely has no session (expected, ordinary)
 *   500 — the auth backend or its database is unreachable (a real failure)
 *
 * Collapsing these into one silent 401 is what let a deleted database look
 * like "nobody is signed in" indefinitely.
 *
 * NOTE ON WHY THE PROBE EXISTS:
 * `auth.api.getSession()` resolves with `null` in BOTH cases — no session, and
 * "I could not reach the database to find out". It does not throw and does not
 * log. Taken at face value that reintroduces exactly the silent-401 bug this
 * module exists to prevent, so when a session cookie IS present but resolved to
 * nothing, we probe the database to tell the two apart.
 *
 * The probe is skipped entirely when no session cookie exists, which is the
 * common anonymous case, so it costs nothing on the hot path.
 */
export async function requireUser(): Promise<RequireUserResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (session?.user) {
      return {
        ok: true,
        user: {
          id: session.user.id,
          email: session.user.email ?? null,
          name: session.user.name ?? null,
        },
      }
    }

    // No session resolved. If the caller presented a session cookie, find out
    // whether that is because it is invalid or because the database is down.
    const cookieStore = await cookies()
    const hasSessionCookie = cookieStore
      .getAll()
      .some((c) => c.name.startsWith(SESSION_COOKIE_PREFIX))

    if (hasSessionCookie && !(await databaseIsReachable())) {
      return { ok: false, status: 500, error: AUTH_UNAVAILABLE }
    }

    return { ok: false, status: 401, error: NOT_AUTHENTICATED }
  } catch (err) {
    // Next.js signals dynamic-usage, redirects and notFound() by THROWING.
    // Swallowing those breaks framework behaviour and logs false failures.
    unstable_rethrow(err)

    log.error('[auth] session lookup failed', { error: err })
    return { ok: false, status: 500, error: AUTH_UNAVAILABLE }
  }
}
