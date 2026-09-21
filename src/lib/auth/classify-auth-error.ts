/**
 * The two auth outcomes that must never be conflated:
 *
 *   "no session"    → ordinary, expected, responds 401
 *   "anything else" → a real infrastructure failure, responds 500
 *
 * Collapsing these into one silent 401 is what let a deleted database look
 * like "nobody is signed in" indefinitely.
 *
 * Deliberately free of framework imports so it can be referenced anywhere.
 */

export const NOT_AUTHENTICATED = 'Not authenticated'
export const AUTH_UNAVAILABLE = 'Authentication service unavailable'
