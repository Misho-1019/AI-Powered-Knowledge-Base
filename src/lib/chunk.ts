import { CHUNKING } from '@/lib/config'

export type Chunk = {
  text: string
  charStart: number
  charEnd: number
}

type Span = { text: string; start: number; end: number }

/**
 * Splits on sentence-ending punctuation, tracking each sentence's offset in the
 * ORIGINAL string so citations can point at a real location.
 *
 * The previous implementation sliced a fixed number of characters, which cut
 * words and sentences in half — the resulting chunks read as fragments and
 * embedded poorly.
 */
function splitSentences(text: string): Span[] {
  const spans: Span[] = []
  const re = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g

  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const raw = match[0]
    const trimmed = raw.trim()
    if (!trimmed) continue

    const leading = raw.length - raw.trimStart().length
    const start = match.index + leading

    spans.push({ text: trimmed, start, end: start + trimmed.length })
  }

  return spans
}

/**
 * Hard-splits a single span longer than the target on its own — a wall of text
 * with no sentence punctuation. Prefers breaking at whitespace.
 */
function hardSplit(span: Span, targetChars: number): Span[] {
  if (span.text.length <= targetChars) return [span]

  const parts: Span[] = []
  let offset = span.start

  while (offset < span.end) {
    let end = Math.min(offset + targetChars, span.end)

    if (end < span.end) {
      const slice = span.text.slice(offset - span.start, end - span.start)
      const lastSpace = slice.lastIndexOf(' ')
      if (lastSpace > targetChars * 0.6) {
        end = offset + lastSpace
      }
    }

    if (end <= offset) break

    const piece = span.text.slice(offset - span.start, end - span.start).trim()
    if (piece) parts.push({ text: piece, start: offset, end })

    offset = end
  }

  return parts
}

/**
 * Sentence-aware chunker.
 *
 * Packs whole sentences up to `targetChars`, carrying a small overlap of tail
 * sentences into the next chunk so a fact spanning a boundary is not lost.
 * Offsets refer to the cleaned input text.
 */
export function chunkText(
  text: string,
  options: {
    targetChars?: number
    overlapChars?: number
    maxChunks?: number
  } = {},
): Chunk[] {
  const targetChars = Math.max(200, options.targetChars ?? CHUNKING.targetChars)
  const overlapChars = Math.max(0, options.overlapChars ?? CHUNKING.overlapChars)
  const maxChunks = options.maxChunks ?? CHUNKING.maxChunks

  const clean = (text ?? '').replace(/\r\n/g, '\n').trim()
  if (!clean) return []

  const sentences = splitSentences(clean)
  if (sentences.length === 0) return []

  const units = sentences.flatMap((s) => hardSplit(s, targetChars))

  const chunks: Chunk[] = []
  let current: Span[] = []
  let currentLength = 0

  const pushChunk = () => {
    const first = current[0]
    const last = current[current.length - 1]
    chunks.push({
      text: clean.slice(first.start, last.end),
      charStart: first.start,
      charEnd: last.end,
    })
  }

  /**
   * Trailing sentences of the emitted chunk, totalling ~overlapChars.
   *
   * Always takes at least the final sentence, even when that sentence alone
   * exceeds the overlap budget — otherwise prose whose sentences are longer
   * than the budget would produce chunks with no overlap at all, and a fact
   * spanning a boundary would be split with nothing carried across.
   */
  const tailForOverlap = (emitted: Span[]): Span[] => {
    if (overlapChars <= 0 || emitted.length <= 1) return []

    const carry: Span[] = []
    let carryLength = 0

    for (let i = emitted.length - 1; i >= 0; i--) {
      const candidate = emitted[i]
      const wouldExceed = carryLength + candidate.text.length > overlapChars
      if (wouldExceed && carry.length > 0) break

      carry.unshift(candidate)
      carryLength += candidate.text.length
    }

    // Carrying the entire chunk forward would prevent progress.
    return carry.length >= emitted.length ? [] : carry
  }

  for (const unit of units) {
    if (currentLength + unit.text.length > targetChars && current.length > 0) {
      pushChunk()

      if (chunks.length >= maxChunks) {
        throw new Error(
          `Document too large to index: more than ${maxChunks} chunks.`,
        )
      }

      current = tailForOverlap(current)
      currentLength = current.reduce((sum, s) => sum + s.text.length, 0)
    }

    current.push(unit)
    currentLength += unit.text.length
  }

  if (current.length > 0) pushChunk()

  if (chunks.length > maxChunks) {
    throw new Error(`Document too large to index: more than ${maxChunks} chunks.`)
  }

  return chunks
}

/** Rough token estimate for display only. Not used for billing. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}
