/**
 * Every tunable in one place.
 *
 * These were previously scattered as magic numbers across routes and services,
 * which hid the fact that several of them had to agree with each other
 * (chunk size vs. embedding timeout, top-k vs. context size).
 */

export const CHUNKING = {
  /** Target characters per chunk. ~1200 chars is roughly 300 tokens. */
  targetChars: 1_200,
  /** Characters of the previous chunk carried into the next, for continuity. */
  overlapChars: 150,
  /** Hard ceiling; beyond this the document belongs in a background queue. */
  maxChunks: 2_000,
} as const

export const RETRIEVAL = {
  /** Default number of chunks retrieved. */
  topK: 5,
  /** Hard cap on a caller-supplied `k`, so one request cannot pull everything. */
  maxTopK: 20,
  /**
   * Minimum top-1 cosine similarity required before asking the model to answer.
   * Below this we say we don't know rather than hallucinate.
   */
  minSimilarity: 0.35,
  /** How many retrieved chunks are actually placed in the prompt. */
  contextChunks: 6,
} as const

export const EMBEDDING = {
  /** sentences-transformers/all-mpnet-base-v2 */
  model: 'sentence-transformers/all-mpnet-base-v2',
  /** Parallel embedding requests. Enough to be quick, few enough to be polite. */
  concurrency: 4,
  timeoutMs: 20_000,
  maxRetries: 2,
  /** Base delay for exponential backoff on 429/503. */
  retryBaseDelayMs: 600,
} as const

export const LLM = {
  maxTokens: 450,
  temperature: 0.1,
} as const

export const LIMITS = {
  maxTitleLength: 200,
  maxTextLength: 200_000,
  maxQueryLength: 2_000,
  maxUploadBytes: 5 * 1024 * 1024,
  maxMetadataBytes: 5_000,
  maxFilenameLength: 255,
  maxPdfPages: 50,
} as const

export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'txt', 'md'] as const
