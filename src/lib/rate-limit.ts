import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { extractRows } from '@/lib/drizzle-utils'

/**
 * Fixed-window, per-user rate limiting backed by Postgres.
 *
 * Deliberately NOT in-memory: on Vercel every serverless instance would keep
 * its own counter, so the real limit becomes "configured limit × warm
 * instances" and the protection silently evaporates. One atomic upsert per
 * limited request is a fair price for a limiter that actually holds.
 */

export type RateLimitBucket =
  | 'ingest'
  | 'ask'
  | 'query'
  | 'presign'
  | 'process'

export const RATE_LIMITS: Record<
  RateLimitBucket,
  { limit: number; windowSeconds: number }
> = {
  ingest: { limit: 10, windowSeconds: 60 },
  ask: { limit: 20, windowSeconds: 60 },
  query: { limit: 30, windowSeconds: 60 },
  presign: { limit: 20, windowSeconds: 60 },
  process: { limit: 10, windowSeconds: 60 },
}

export type RateLimitOutcome =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number }

function windowStartFor(windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000
  return new Date(Math.floor(Date.now() / windowMs) * windowMs)
}

export async function checkRateLimit(params: {
  userId: string
  bucket: RateLimitBucket
}): Promise<RateLimitOutcome> {
  const { limit, windowSeconds } = RATE_LIMITS[params.bucket]
  const windowStart = windowStartFor(windowSeconds)

  // Atomic increment, so concurrent requests cannot both "win" a slot.
  const result = await db.execute(sql`
    insert into rate_limits (user_id, bucket, window_start, count)
    values (${params.userId}::uuid, ${params.bucket}, ${windowStart}, 1)
    on conflict (user_id, bucket, window_start)
    do update set count = rate_limits.count + 1
    returning count
  `)

  const count = Number(extractRows<{ count: number }>(result)[0]?.count ?? 1)

  if (count > limit) {
    const elapsedSeconds = (Date.now() - windowStart.getTime()) / 1000
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsedSeconds)),
    }
  }

  return { ok: true, remaining: Math.max(0, limit - count) }
}

/**
 * Convenience wrapper: returns a ready-made 429, or null to continue.
 */
export async function enforceRateLimit(
  userId: string,
  bucket: RateLimitBucket,
): Promise<NextResponse | null> {
  let outcome: RateLimitOutcome
  try {
    outcome = await checkRateLimit({ userId, bucket })
  } catch (err) {
    // Fail OPEN: a broken limiter must not take the whole app down, but it
    // must be visible in the logs.
    console.error('[rate-limit] check failed, allowing request:', err)
    return null
  }

  if (outcome.ok) return null

  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    {
      status: 429,
      headers: { 'Retry-After': String(outcome.retryAfterSeconds) },
    },
  )
}
