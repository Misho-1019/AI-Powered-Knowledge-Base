import { describe, expect, it } from 'vitest'
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  MAX_METADATA_BYTES,
  MAX_QUERY_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_TOP_K,
  MAX_UPLOAD_BYTES,
  askSchema,
  createDocumentSchema,
  extensionOf,
  formatValidationError,
  ingestSchema,
  isAllowedExtension,
  parseJsonBody,
  presignSchema,
} from './validation'

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('ingestSchema', () => {
  it('accepts a well-formed note', () => {
    const parsed = ingestSchema.safeParse({ title: 'Notes', text: 'Hello.' })
    expect(parsed.success).toBe(true)
  })

  it('rejects an empty title', () => {
    const parsed = ingestSchema.safeParse({ title: '  ', text: 'Hello.' })
    expect(parsed.success).toBe(false)
  })

  it('rejects oversized text', () => {
    const parsed = ingestSchema.safeParse({
      title: 'Big',
      text: 'x'.repeat(MAX_TEXT_LENGTH + 1),
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects oversized titles and metadata', () => {
    expect(
      ingestSchema.safeParse({
        title: 'x'.repeat(MAX_TITLE_LENGTH + 1),
        text: 'ok',
      }).success,
    ).toBe(false)

    expect(
      ingestSchema.safeParse({
        title: 'ok',
        text: 'ok',
        metadata: { blob: 'x'.repeat(MAX_METADATA_BYTES) },
      }).success,
    ).toBe(false)
  })
})

describe('askSchema', () => {
  it('accepts a question with optional k, documentId and stream', () => {
    const parsed = askSchema.safeParse({
      query: 'What is this?',
      k: 5,
      documentId: crypto.randomUUID(),
      stream: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects empty queries and out-of-range k', () => {
    expect(askSchema.safeParse({ query: '  ' }).success).toBe(false)
    expect(askSchema.safeParse({ query: 'q', k: 0 }).success).toBe(false)
    expect(askSchema.safeParse({ query: 'q', k: MAX_TOP_K + 1 }).success).toBe(
      false,
    )
    expect(
      askSchema.safeParse({ query: 'x'.repeat(MAX_QUERY_LENGTH + 1) }).success,
    ).toBe(false)
  })

  it('rejects a malformed documentId', () => {
    expect(
      askSchema.safeParse({ query: 'q', documentId: 'not-a-uuid' }).success,
    ).toBe(false)
  })
})

describe('presignSchema', () => {
  it('accepts a sane upload claim', () => {
    const parsed = presignSchema.safeParse({
      filename: 'report.pdf',
      contentType: 'application/pdf',
      size: 1024,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects non-positive and oversized claims', () => {
    expect(
      presignSchema.safeParse({ filename: 'a.pdf', size: 0 }).success,
    ).toBe(false)
    expect(
      presignSchema.safeParse({ filename: 'a.pdf', size: MAX_UPLOAD_BYTES + 1 })
        .success,
    ).toBe(false)
  })
})

describe('createDocumentSchema', () => {
  it('accepts title plus storage path', () => {
    const parsed = createDocumentSchema.safeParse({
      title: 'Report',
      storagePath: 'user-id/123-report.pdf',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an empty title', () => {
    expect(
      createDocumentSchema.safeParse({ title: '', storagePath: 'u/f.pdf' })
        .success,
    ).toBe(false)
  })
})

describe('extension helpers', () => {
  it('allows exactly the configured upload types, case-insensitively', () => {
    for (const ext of ALLOWED_UPLOAD_EXTENSIONS) {
      expect(isAllowedExtension(`file.${ext}`)).toBe(true)
      expect(isAllowedExtension(`file.${ext.toUpperCase()}`)).toBe(true)
    }
    expect(isAllowedExtension('run.exe')).toBe(false)
    expect(isAllowedExtension('no-extension')).toBe(false)
  })

  it('extracts the trailing extension', () => {
    expect(extensionOf('archive.tar.pdf')).toBe('pdf')
    expect(extensionOf('UPPER.MD')).toBe('md')
    expect(extensionOf('bare')).toBe('')
  })
})

describe('formatValidationError', () => {
  it('names the failing field', () => {
    const parsed = ingestSchema.safeParse({ title: '', text: 'ok' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(formatValidationError(parsed.error)).toContain('title')
    }
  })
})

describe('parseJsonBody', () => {
  it('returns parsed data for a valid body', async () => {
    const parsed = await parseJsonBody(
      jsonRequest({ title: 'T', text: 'hi' }),
      ingestSchema,
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.data.title).toBe('T')
  })

  it('returns 400 for malformed JSON', async () => {
    const parsed = await parseJsonBody(jsonRequest('{not json'), ingestSchema)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.response.status).toBe(400)
  })

  it('returns 400 with the field name for schema violations', async () => {
    const parsed = await parseJsonBody(
      jsonRequest({ title: '', text: 'hi' }),
      ingestSchema,
    )
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.response.status).toBe(400)
      const body = (await parsed.response.json()) as { error?: string }
      expect(body.error).toContain('title')
    }
  })
})
