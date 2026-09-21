import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Optimistic gate for page routes.
 *
 * NOT the security boundary. `getSessionCookie` only checks that a session
 * cookie exists — it does not validate it. Real enforcement lives in
 * `requireUser()` inside every page and route handler, which verifies the
 * session against the database.
 *
 * This exists purely so signed-out visitors get sent to /auth instead of
 * seeing a "Not signed in" card on a page they navigated to.
 *
 * Note the matcher covers page routes only: API routes must NOT be redirected,
 * because a 302 would break `fetch()` callers that expect a 401.
 */
export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  if (!sessionCookie) {
    const url = new URL('/auth', request.url)
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/documents', '/documents/:path*'],
}
