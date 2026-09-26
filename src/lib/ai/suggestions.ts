import { RETRIEVAL, SUGGESTIONS } from '@/lib/config'
import { log as systemLog, type Logger } from '@/lib/log'
import { setSuggestedQuestions } from '@/lib/repositories/documents'
import { matchChunks } from '@/lib/repositories/search'
import { embedText } from './embeddings'
import { chatComplete } from './llm'

/**
 * Suggested questions ("ask about this") for the Ask page.
 *
 * Two sources, one shape: the demo corpus ships hand-curated questions, and
 * user uploads get questions generated at processing time. Generated questions
 * are only kept if retrieval can actually reach an answer for them, so the UI
 * never offers a question that leads to an abstention.
 */

function buildExcerpts(chunks: string[]): string {
  return chunks
    .slice(0, SUGGESTIONS.maxExcerptChunks)
    .join('\n\n---\n\n')
    .slice(0, SUGGESTIONS.maxExcerptChars)
}

function buildSystemPrompt(): string {
  return [
    'You propose suggested questions for a document search tool.',
    `Given excerpts from one document, write ${SUGGESTIONS.generate} short questions that the document can answer.`,
    'Rules:',
    '- One question per line. No numbering, no bullets, no quotation marks.',
    '- Each question must be answerable from the excerpts alone.',
    '- Vary them; do not ask the same fact twice.',
    '- Output only the questions, with no preamble or closing text.',
  ].join('\n')
}

/** Strips bullets/numbering and rejects anything that is not a real question. */
function parseQuestions(text: string): string[] {
  const lines = text.split('\n')
  const seen = new Set<string>()
  const questions: string[] = []

  for (const raw of lines) {
    const line = raw
      .replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '')
      .replace(/^["'“”]+|["'“”]+$/g, '')
      .trim()

    if (line.length < SUGGESTIONS.minQuestionChars) continue
    if (line.length > SUGGESTIONS.maxQuestionChars) continue
    // The model sometimes narrates its own uncertainty despite instructions.
    if (
      /\b(i (?:cannot|can't|don't)|not present|no information)\b/i.test(line)
    ) {
      continue
    }

    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    questions.push(line)
  }

  return questions
}

/**
 * A question is "answerable" only if retrieval finds real support for it:
 * either a keyword hit or a similarity above the abstention threshold —
 * the same bar the answer path uses.
 */
async function isAnswerable(params: {
  userId: string
  documentId: string
  question: string
}): Promise<boolean> {
  const embedding = await embedText(params.question)

  const matches = await matchChunks({
    userId: params.userId,
    embedding,
    limit: 3,
    documentId: params.documentId,
    query: params.question,
  })

  if (matches.length === 0) return false

  const hasLexicalHit = matches.some((m) => m.lexicalRank !== null)
  const bestSimilarity = matches.reduce((best, m) => {
    const value = Number(m.similarity)
    return Number.isFinite(value) ? Math.max(best, value) : best
  }, Number.NEGATIVE_INFINITY)

  return hasLexicalHit || bestSimilarity >= RETRIEVAL.minSimilarity
}

/**
 * Generates questions for a document, keeps only the ones retrieval can
 * answer, and stores them in the document's metadata.
 *
 * Best-effort by design: it is called from `after()` on the processing path, so
 * a missing LLM key or a slow model must never affect the upload itself.
 * Returns the questions it kept (empty on any failure).
 */
export async function generateAndStoreSuggestions(params: {
  userId: string
  documentId: string
  title: string
  chunks: string[]
  log?: Logger
}): Promise<string[]> {
  const log = params.log ?? systemLog
  try {
    const excerpts = buildExcerpts(params.chunks)
    if (!excerpts.trim()) return []

    const completion = await chatComplete({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: `Document title: ${params.title}\n\nExcerpts:\n"""\n${excerpts}\n"""`,
        },
      ],
      maxTokens: SUGGESTIONS.maxTokens,
      temperature: SUGGESTIONS.temperature,
    })

    const candidates = parseQuestions(completion.text)
    if (candidates.length === 0) return []

    // Verify before trusting: a suggested question that retrieves nothing is
    // worse than showing fewer questions.
    const verdicts = await Promise.all(
      candidates.map((question) =>
        isAnswerable({
          userId: params.userId,
          documentId: params.documentId,
          question,
        }).catch(() => false),
      ),
    )

    const verified = candidates
      .filter((_, index) => verdicts[index])
      .slice(0, SUGGESTIONS.keep)

    if (verified.length > 0) {
      await setSuggestedQuestions(params.userId, params.documentId, verified)
    }

    return verified
  } catch (err) {
    log.error('[suggestions] generation failed (non-fatal)', { error: err })
    return []
  }
}
