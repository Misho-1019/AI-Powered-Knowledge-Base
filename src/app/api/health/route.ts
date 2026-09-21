import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export const dynamic = 'force-dynamic'

/**
 * Real health check. The previous `/health` page called `getSession()` with a
 * non-cookie client, so it always rendered `{"session": null}` and proved
 * nothing. This actually reaches the database.
 */
export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, unknown> = {}
  let ok = true

  try {
    const t0 = Date.now()
    await db.execute(sql`select 1`)
    checks.database = { ok: true, latencyMs: Date.now() - t0 }
  } catch (err) {
    ok = false
    checks.database = {
      ok: false,
      // Raw driver errors can leak host details, so only expose them locally.
      error:
        process.env.NODE_ENV === 'production'
          ? 'unreachable'
          : err instanceof Error
            ? err.message
            : 'unknown error',
    }
  }

  checks.storage = {
    configured: Boolean(
      process.env.STORAGE_ENDPOINT &&
        process.env.STORAGE_BUCKET &&
        process.env.STORAGE_ACCESS_KEY_ID &&
        process.env.STORAGE_SECRET_ACCESS_KEY,
    ),
    bucket: process.env.STORAGE_BUCKET ?? null,
  }

  checks.llm = {
    configured: Boolean(process.env.HF_API_KEY),
    model: process.env.LLM_MODEL ?? null,
  }

  return NextResponse.json(
    {
      ok,
      checks,
      totalLatencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  )
}
