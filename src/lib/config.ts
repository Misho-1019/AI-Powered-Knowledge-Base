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
  /**
   * Local ONNX model, run through transformers.js — no API, no per-chunk cost,
   * no rate limits.
   *
   * Chosen by measurement over two alternatives:
   *
   *   model        dims  cold load  per-embed  separation  download
   *   MiniLM-L6    384   3.7s       4ms        0.385       23 MB
   *   mpnet-base   768   11.0s      13ms       0.434       106 MB
   *   bge-base     768   7.8s       13ms       0.205       106 MB
   *
   * mpnet separates slightly better but costs 4.6x the download and 3x the cold
   * start, and on Vercel `/tmp` does not survive cold starts — so it is
   * re-downloaded per instance. The query embedding sits on the critical path
   * of every Ask, so a cold start is user-visible. bge-base is badly calibrated
   * without its instruction prefix.
   */
  model: 'Xenova/all-MiniLM-L6-v2',
  /** Quantized weights: 23 MB instead of ~90 MB. */
  dtype: 'q8',
  /**
   * Parallel embedding calls.
   *
   * NOTE: batching several texts into ONE pipeline call is deliberately avoided.
   * Measured: the same text embedded alone vs. in a mixed-length batch differs
   * by up to 0.07 cosine, because batch padding leaks into the pooled vector.
   * Since the query is always embedded alone, batching chunks would place them
   * in a slightly different vector space and silently degrade retrieval.
   */
  concurrency: 4,
  /** Local inference is fast; this only guards against a pathological input. */
  timeoutMs: 30_000,
  maxRetries: 1,
  retryBaseDelayMs: 300,
} as const

export const LLM = {
  /**
   * Any OpenAI-compatible chat-completions base URL. Overridable per
   * environment, so switching provider is configuration rather than a code
   * change. HuggingFace speaks the same shape.
   */
  baseUrl: 'https://router.huggingface.co/v1',
  model: 'meta-llama/Llama-3.1-8B-Instruct',
  /**
   * Raised from 450, which truncated answers mid-sentence. Deliberately paired
   * with an explicit brevity instruction — lifting the cap on its own would
   * only let a rambling answer ramble longer.
   */
  maxTokens: 700,
  temperature: 0.1,
  timeoutMs: 30_000,
  /**
   * The model replies with exactly this token when the sources do not contain
   * the answer. Detected server-side and replaced with a friendly message, so
   * abstention is deterministic instead of depending on prose that happens to
   * say "I don't know".
   */
  notInSourcesSentinel: 'NOT_IN_SOURCES',
} as const

export const SUGGESTIONS = {
  /**
   * How many suggested questions to keep per document.
   *
   * The model is asked for a couple more than this, because retrieval
   * verification drops the ones the document cannot actually answer — and a
   * visible "suggested question" that retrieves nothing would be worse than
   * showing fewer.
   */
  keep: 4,
  /** The model is asked for this many before verification. */
  generate: 6,
  /** Cap on how much document text is sent to the model. */
  maxExcerptChars: 4_000,
  maxExcerptChunks: 6,
  minQuestionChars: 12,
  maxQuestionChars: 160,
  maxTokens: 320,
  temperature: 0.3,
} as const

export const LIMITS = {  maxTitleLength: 200,
  maxTextLength: 200_000,
  maxQueryLength: 2_000,
  maxUploadBytes: 5 * 1024 * 1024,
  maxMetadataBytes: 5_000,
  maxFilenameLength: 255,
  maxPdfPages: 50,
} as const

export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'txt', 'md'] as const

export const SANDBOX = {
  /**
   * Throwaway demo accounts are recognised by this email prefix. The
   * housekeeping job deletes them (and everything cascading from them) once
   * they outlive `ttlHours`.
   */
  emailPrefix: 'sandbox+',
  /** Creation cap per rolling hour, counted globally — the only abuse guard an
   *  unauthenticated endpoint can afford. */
  maxPerHour: 20,
  /** Stale sandboxes are removed after this long. */
  ttlHours: 24,
} as const

export const HOUSEKEEPING = {
  /**
   * R2 objects without a document row are only deleted once they are older
   * than this. The presign → PUT → create-row window means a young "orphan"
   * is usually an upload still in flight, not garbage.
   */
  orphanMinAgeMinutes: 60,
  /** Rate-limit windows older than this are pruned. */
  rateLimitRetentionDays: 1,
} as const
