/**
 * Proves the failure mode that let a deleted auth/database backend hide.
 *
 * Same unreachable host, two different outcomes:
 *   no session present  → supabase-js short-circuits, returns an error, NO
 *                         network call → classified 401 → invisible
 *   session present     → supabase-js attempts a real call, which THROWS
 *                         → classified 500 → loud
 *
 * Usage: npx tsx scripts/verify-auth-failure-mode.ts
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { isSessionMissingError, statusForAuthError } = await import(
    '../src/lib/auth/classify-auth-error'
  )

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  console.log(`auth host under test: ${new URL(url).host}\n`)

  // ---- 1. no session: library short-circuits, no network call ----
  const noSession = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const t0 = Date.now()
  const { error } = await noSession.auth.getUser()
  const elapsed = Date.now() - t0

  check('no session returns an error object (does not throw)', Boolean(error))
  check('error classified as session-missing', isSessionMissingError(error))
  check('therefore maps to 401', statusForAuthError(error) === 401)
  check(
    'no network round-trip happened (this is why the outage was invisible)',
    elapsed < 1500,
    `${elapsed}ms`,
  )

  // ---- 2. session present: library attempts a real call against a dead host ----
  const withSession = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // A JWT forces the network path (`GET /user`).
  const fakeJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJleHAiOjk5OTk5OTk5OTl9.c2lnbmF0dXJl'

  // supabase-js logs the fetch failure internally and resolves with an error
  // object rather than throwing, so capture both paths.
  let threw = false
  let outcomeError: unknown = null
  try {
    const res = await withSession.auth.getUser(fakeJwt)
    outcomeError = res.error
  } catch (e) {
    threw = true
    outcomeError = e
  }

  check(
    'dead host yields an error (thrown or returned)',
    threw || Boolean(outcomeError),
    threw ? 'threw' : 'returned an error',
  )
  check(
    'that error is NOT classified as session-missing',
    !isSessionMissingError(outcomeError),
  )
  check(
    '=> maps to 500, never 401 (the whole point)',
    statusForAuthError(outcomeError) === 500,
    `status ${statusForAuthError(outcomeError)}`,
  )
  console.log(
    '\nnote: the stack trace above is supabase-js logging the failed fetch itself; the call still resolves with a non-session error, which is what our classifier keys on.',
  )

  console.log(
    `\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main()
