import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { buildObjectKey, isStorageConfigured, presignUpload } from '@/lib/storage'

export const dynamic = 'force-dynamic'

/**
 * Issues a presigned PUT so the browser can upload straight to R2.
 *
 * The key is built server-side from the authenticated user's id, so a client
 * cannot choose its own path. (Phase 5 adds prefix validation on the way back
 * in, when the document row is created.)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const filename = body?.filename
    const contentType = body?.contentType

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid filename' },
        { status: 400 },
      )
    }

    const auth = await requireUser()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Object storage is not configured' },
        { status: 503 },
      )
    }

    const key = buildObjectKey(auth.user.id, filename)
    const presigned = await presignUpload({
      key,
      contentType: typeof contentType === 'string' ? contentType : undefined,
    })

    return NextResponse.json({ ok: true, ...presigned })
  } catch (err) {
    console.error('[uploads/presign] failed:', err)
    return NextResponse.json(
      { error: 'Could not prepare the upload' },
      { status: 500 },
    )
  }
}
