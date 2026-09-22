import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Every request body crosses one of these schemas. Hand-rolled `typeof` checks
 * were replaced because they only verified shape, never bounds.
 */

export const MAX_TITLE_LENGTH = 200
export const MAX_TEXT_LENGTH = 200_000
export const MAX_QUERY_LENGTH = 2_000
export const MAX_TOP_K = 20
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
export const MAX_METADATA_BYTES = 5_000
export const MAX_FILENAME_LENGTH = 255
export const MAX_PDF_PAGES = 50

export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'txt', 'md'] as const

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : ''
}

export function isAllowedExtension(filename: string): boolean {
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(
    extensionOf(filename),
  )
}

const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => JSON.stringify(value).length <= MAX_METADATA_BYTES,
    { message: `metadata must be under ${MAX_METADATA_BYTES} bytes` },
  )

export const ingestSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  text: z.string().min(1).max(MAX_TEXT_LENGTH),
  metadata: metadataSchema.optional(),
})

export const askSchema = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  k: z.number().int().min(1).max(MAX_TOP_K).optional(),
  documentId: z.uuid().optional(),
})

export const querySchema = askSchema

export const presignSchema = z.object({
  filename: z.string().trim().min(1).max(MAX_FILENAME_LENGTH),
  contentType: z.string().trim().max(255).optional(),
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
})

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
  storagePath: z.string().trim().min(1).max(1024),
  originalFilename: z.string().trim().max(MAX_FILENAME_LENGTH).optional(),
})

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.') || 'body'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

/**
 * Parses and validates a JSON request body, returning a ready-made 400 on
 * failure so routes stay free of boilerplate.
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<ParseResult<z.infer<T>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      ),
    }
  }

  const parsed = schema.safeParse(raw)

  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      ),
    }
  }

  return { ok: true, data: parsed.data as z.infer<T> }
}
