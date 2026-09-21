/**
 * Distinguishes the two auth outcomes that must never be conflated:
 *
 *   "no session"      → ordinary, expected, responds 401
 *   "anything else"   → a real infrastructure failure, responds 500
 *
 * Collapsing these into one silent 401 is what let a deleted database look
 * like "nobody is signed in" indefinitely.
 *
 * Deliberately free of framework imports so it can be tested directly.
 */

export const NOT_AUTHENTICATED = 'Not authenticated'
export const AUTH_UNAVAILABLE = 'Authentication service unavailable'

export function isSessionMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: string; code?: string }
  return e.name === 'AuthSessionMissingError' || e.code === 'session_missing'
}

/**
 * Maps a *returned* auth error to an HTTP status. A thrown error never reaches
 * here — throwing always means the backend itself failed, so callers treat it
 * as 500.
 */
export function statusForAuthError(err: unknown): 401 | 500 {
  return isSessionMissingError(err) ? 401 : 500
}
