import { EMBEDDING_DIMENSIONS } from '@/db/schema'

/**
 * Pure query-building helpers for hybrid search.
 *
 * They live apart from `search.ts` (which executes SQL against Neon) so unit
 * tests can cover the lexical semantics and vector validation without a
 * database. The fused SQL itself stays covered by `verify:repos` and the eval
 * harnesses against real Postgres.
 */

/**
 * Turns a natural-language question into an OR-ed websearch query.
 *
 * OR semantics matter: with AND semantics a question like "how many units did
 * shift 5 process on day 12" requires every content word to appear in one
 * chunk, so it matches nothing and the lexical half contributes nothing. OR
 * lets the ranker sort by how much matched.
 *
 * Quotes and backslashes are stripped so a caller cannot inject phrase or
 * negation syntax, and `websearch_to_tsquery` is designed for raw user input,
 * so malformed leftovers degrade rather than throw.
 */
export function buildLexicalQuery(query: string): string {
  const cleaned = query
    .replace(/["'\\:&|!()<>*]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()

  if (!cleaned) return ''

  const tokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 16)

  return tokens.length > 0 ? tokens.join(' or ') : ''
}

export function toVectorLiteral(embedding: number[]): string {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding must have ${EMBEDDING_DIMENSIONS} dimensions, received ${embedding?.length ?? 0}`,
    )
  }
  if (!embedding.every((n) => Number.isFinite(n))) {
    throw new Error('Embedding contains non-finite values')
  }
  return `[${embedding.join(',')}]`
}
