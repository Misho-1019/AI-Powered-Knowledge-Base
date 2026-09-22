import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { enforceRateLimit } from '@/lib/rate-limit'
import {
  buildObjectKey,
  isStorageConfigured,
  presignUpload,
} from '@/lib/storage'
import {
  isAllowedExtension,
  parseJsonBody,
  presignSchema,
  ALLOWED_UPLOAD_EXTENSIONS,
} from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * Issues a presigned PUT so the browser can upload straight to R2.
 *
 * The key is built server-side from the authenticated user's id, so a client
 * cannot choose its own path. The size is signed into the URL, so R2 enforces
 * the limit without the bytes ever reaching this server.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireUser()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const limited = await enforceRateLimit(auth.user.id, 'presign')
    if (limited) return limited

    const parsed = await parseJsonBody(request, presignSchema)
    if (!parsed.ok) return parsed.response

    const { filename, contentType, size } = parsed.data

    // Enforced here, not just in the browser.
    if (!isAllowedExtension(filename)) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed: ${ALLOWED_UPLOAD_EXTENSIONS.join(', ')}`,
        },
        { status: 400 },
      )
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
      contentType,
      contentLength: size,
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
