import { describe, expect, it } from 'vitest'
import { EMBEDDING_DIMENSIONS } from '@/db/schema'
import { buildLexicalQuery, toVectorLiteral } from './search-query'

/**
 * Unit coverage for the pure half of hybrid search. The fused SQL stays
 * covered by `verify:repos` and the evals against real Postgres; what is
 * pinned here is the query semantics that made vector-only retrieval miss
 * ("day 12") and the vector-shape contract the SQL depends on.
 */

describe('buildLexicalQuery', () => {
  it('joins content words with OR so one chunk need not match everything', () => {
    expect(buildLexicalQuery('shift 5 day 12')).toBe('shift or 5 or day or 12')
  })

  it('strips phrase, negation and operator syntax that callers could inject', () => {
    const query = buildLexicalQuery('"day 12" or (shift & 5) | !drop')
    expect(query).not.toContain('"')
    expect(query).not.toMatch(/[&|!():<>*]/)
    expect(query).toContain(' or ')
  })

  it('caps runaway questions at sixteen tokens', () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`).join(' ')
    const tokens = buildLexicalQuery(words).split(' or ')
    expect(tokens).toHaveLength(16)
  })

  it('degrades to empty for punctuation-only or blank input', () => {
    expect(buildLexicalQuery('')).toBe('')
    expect(buildLexicalQuery('   ')).toBe('')
    expect(buildLexicalQuery('!!! ??? ...')).toBe('')
  })

  it('keeps unicode letters and numbers', () => {
    expect(buildLexicalQuery('Zürich 2026')).toBe('Zürich or 2026')
  })
})

describe('toVectorLiteral', () => {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01)

  it('serialises a well-formed embedding', () => {
    const literal = toVectorLiteral(vector)
    expect(literal.startsWith('[')).toBe(true)
    expect(literal.endsWith(']')).toBe(true)
    expect(literal.split(',')).toHaveLength(EMBEDDING_DIMENSIONS)
  })

  it('rejects the wrong dimensionality — the failure that once wiped an index', () => {
    expect(() => toVectorLiteral([0.1, 0.2, 0.3])).toThrow(/dimensions/)
    expect(() => toVectorLiteral('nope' as unknown as number[])).toThrow(
      /dimensions/,
    )
  })

  it('rejects non-finite values before they reach Postgres', () => {
    const bad = [...vector]
    bad[0] = Number.NaN
    expect(() => toVectorLiteral(bad)).toThrow(/non-finite/)

    const infinite = [...vector]
    infinite[1] = Number.POSITIVE_INFINITY
    expect(() => toVectorLiteral(infinite)).toThrow(/non-finite/)
  })
})
