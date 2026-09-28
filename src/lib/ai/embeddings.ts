import { EMBEDDING } from '@/lib/config'
import { EMBEDDING_DIMENSIONS } from '@/db/schema'

/**
 * Imported for its side effect: registering the native ONNX runtime as a real
 * dependency of this module.
 *
 * transformers.js loads `onnxruntime-node` via an internal, dynamic require,
 * which bundlers and serverless packagers cannot see — so the package (and its
 * native binding) is dropped from the deployed function, and embeddings fail at
 * runtime with "Cannot find module 'onnxruntime-node'". A direct import makes
 * it a visible external dependency, so it is bundled with the function.
 * `serverExternalPackages` keeps it unbundled (native code cannot be bundled).
 */
import 'onnxruntime-node'

export class EmbeddingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingUnavailableError'
  }
}

type ExtractorOutput = { data: ArrayLike<number>; dims: number[] }
type Extractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<ExtractorOutput>

let extractorPromise: Promise<Extractor> | null = null

/**
 * Loads the ONNX model once per process.
 *
 * Replaces the HuggingFace Inference API for embeddings: no per-chunk cost, no
 * rate limits, no network timeout. The only cost is a one-time download and
 * init on the first call in a given process.
 */
async function getExtractor(): Promise<Extractor> {
  if (extractorPromise) return extractorPromise

  extractorPromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers')
    const os = await import('node:os')
    const path = await import('node:path')

    // `/tmp` is the only writable location on Vercel. Note it does NOT survive
    // a cold start, which is why the model choice weighed download size.
    env.cacheDir = path.join(os.tmpdir(), 'transformers-cache')
    env.allowLocalModels = false
    env.allowRemoteModels = true

    const extractor = await pipeline('feature-extraction', EMBEDDING.model, {
      dtype: EMBEDDING.dtype,
    })

    return extractor as unknown as Extractor
  })()

  // If loading failed, allow a later call to retry rather than caching the
  // rejected promise for the lifetime of the process.
  extractorPromise.catch(() => {
    extractorPromise = null
  })

  return extractorPromise
}

/** Embeds one string locally. */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor()

  let output: ExtractorOutput
  try {
    output = await extractor(text.trim() || ' ', {
      pooling: 'mean',
      normalize: true,
    })
  } catch (err) {
    throw new EmbeddingUnavailableError(
      `Local embedding failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  const vector = Array.from(output.data)

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingUnavailableError(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`,
    )
  }

  if (!vector.every(Number.isFinite)) {
    throw new EmbeddingUnavailableError('Embedding contained non-finite values')
  }

  return vector
}

/**
 * Embeds many texts.
 *
 * IMPORTANT: each text is embedded in its own call, never as one batched array.
 * Measured — the same text embedded alone versus inside a mixed-length batch
 * differs by up to 0.07 cosine, because batch padding leaks into the pooled
 * vector. Since the query is always embedded alone, batching chunks would put
 * them in a subtly different vector space and degrade retrieval silently.
 *
 * Local inference is ~4ms per text, so this is not a meaningful cost.
 */
export async function embedMany(
  texts: string[],
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<number[][]> {
  if (texts.length === 0) return []

  // Warm the model once, so the first item is not measured against the load.
  await getExtractor()

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
