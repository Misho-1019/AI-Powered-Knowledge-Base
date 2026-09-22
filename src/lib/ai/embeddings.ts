import { EMBEDDING } from '@/lib/config'

export class EmbeddingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingUnavailableError'
  }
}

/**
 * One embedding request.
 *
 * NOTE (Phase 7): this moves to local `transformers.js` inference, which removes
 * the HTTP round-trip per chunk entirely and makes batching free. Until then the
 * timeout/retry/back-off below is what keeps a flaky provider from failing an
 * otherwise good ingest.
 */
async function requestEmbedding(
  text: string,
  signal: AbortSignal,
): Promise<number[]> {
  const apiKey = process.env.HF_API_KEY
  if (!apiKey) {
    throw new EmbeddingUnavailableError('Missing HF_API_KEY in environment variables.')
  }

  const url = `https://router.huggingface.co/hf-inference/models/${EMBEDDING.model}/pipeline/feature-extraction`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const error = new Error(
      `HF embeddings error (${res.status}): ${detail.slice(0, 200)}`,
    ) as Error & { status?: number }
    error.status = res.status
    throw error
  }

  const data = await res.json()
  return toVector(data)
}

function toVector(data: unknown): number[] {
  if (Array.isArray(data) && typeof data[0] === 'number') {
    return data as number[]
  }

  // The feature-extraction pipeline returns token-level vectors for this model
  // family; mean-pool them into a single sentence vector.
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const tokenEmbeddings = data as number[][]
    const dim = tokenEmbeddings[0]?.length ?? 0
    if (dim === 0) throw new EmbeddingUnavailableError('Empty embedding returned.')

    const pooled = new Array(dim).fill(0)
    for (const vector of tokenEmbeddings) {
      for (let i = 0; i < dim; i++) pooled[i] += vector[i]
    }
    for (let i = 0; i < dim; i++) pooled[i] /= tokenEmbeddings.length
    return pooled
  }

  throw new EmbeddingUnavailableError('Unexpected HF embeddings response format.')
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  if (status === 429) return true
  if (typeof status === 'number' && status >= 500) return true

  const name = (err as { name?: string } | null)?.name
  if (name === 'TimeoutError' || name === 'AbortError') return true

  // Network-level failures (DNS, reset connection) surface as TypeError.
  if (err instanceof TypeError) return true

  return false
}

/** Embeds one string, with a hard timeout and bounded retry with back-off. */
export async function embedText(text: string): Promise<number[]> {
  let lastError: unknown

  for (let attempt = 0; attempt <= EMBEDDING.maxRetries; attempt++) {
    try {
      return await requestEmbedding(
        text,
        AbortSignal.timeout(EMBEDDING.timeoutMs),
      )
    } catch (err) {
      lastError = err

      if (!isRetryable(err) || attempt === EMBEDDING.maxRetries) break

      const delay = EMBEDDING.retryBaseDelayMs * 2 ** attempt
      console.warn(
        `[embeddings] attempt ${attempt + 1} failed, retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err,
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Embeds many texts with bounded concurrency.
 *
 * Replaces the `for (… ) await embedText(…)` loop that made a 30-page PDF a
 * hundred sequential HTTP round-trips.
 */
export async function embedMany(
  texts: string[],
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<number[][]> {
  if (texts.length === 0) return []

  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? EMBEDDING.concurrency, texts.length),
  )

  const results: number[][] = new Array(texts.length)
  let nextIndex = 0
  let completed = 0

  async function worker() {
    for (;;) {
      const index = nextIndex++
      if (index >= texts.length) return

      results[index] = await embedText(texts[index])
      completed++
      options.onProgress?.(completed, texts.length)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return results
}
