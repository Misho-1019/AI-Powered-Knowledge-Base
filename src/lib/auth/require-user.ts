import { unstable_rethrow } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  AUTH_UNAVAILABLE,
  NOT_AUTHENTICATED,
  isSessionMissingError,
} from './classify-auth-error'

export type AuthUser = {
  id: string
  email: string | null
}

export type RequireUserResult =
  | { ok: true; user: AuthUser }
  | { ok: false; status: 401 | 500; error: string }

/**
 * The single seam between this app and its auth provider.
 *
 * Phase 3 swaps the implementation to Better Auth; every caller stays the same.
 *
 * Two outcomes are deliberately distinct:
 *   401 — the caller genuinely has no session (expected, ordinary)
 *   500 — the auth backend is unreachable or misconfigured (a real failure)
 */
export async function requireUser(): Promise<RequireUserResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      if (isSessionMissingError(error)) {
        return { ok: false, status: 401, error: NOT_AUTHENTICATED }
      }
      console.error('[auth] getUser returned an unexpected error:', error)
      return { ok: false, status: 500, error: AUTH_UNAVAILABLE }
    }

    if (!data?.user) {
      return { ok: false, status: 401, error: NOT_AUTHENTICATED }
    }

    return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } }
  } catch (err) {
    // Next.js signals dynamic-usage, redirects and notFound() by THROWING.
    // Swallowing those breaks framework behaviour and logs false failures —
    // `unstable_rethrow` lets the real framework errors through.
    unstable_rethrow(err)

    // getUser() THROWS (rather than returning an error) when the auth host is
    // unreachable. This branch is the one that must never be silent.
    console.error('[auth] auth backend unreachable:', err)
    return { ok: false, status: 500, error: AUTH_UNAVAILABLE }
  }
}
