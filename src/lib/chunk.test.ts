import { describe, expect, it } from 'vitest'
import { chunkText, estimateTokens } from './chunk'

/**
 * Unit coverage for the sentence-aware chunker. Atomic replacement and
 * embedding behaviour stay in `verify:reliability` (they need a database);
 * everything here is pure and runs in milliseconds.
 */

const PROSE = [
  'The warehouse handles inbound freight every weekday morning.',
  'Shipments are scanned at the dock before being routed to storage.',
  'Throughput rose sharply after the conveyor retrofit in August.',
  'Staffing stayed flat at forty two people across the whole quarter.',
  'Two minor safety reports were filed and both closed within two days.',
  'The second conveyor line is scheduled for retrofit in January.',
  'Inventory accuracy improved to ninety nine point two percent.',
  'Returns processing moved to a dedicated bay near the loading dock.',
].join(' ')

describe('chunkText', () => {
  it('packs whole sentences into more than one chunk', () => {
    const chunks = chunkText(PROSE, { targetChars: 200, overlapChars: 40 })
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('maps every chunk exactly back to the source offsets', () => {
    const chunks = chunkText(PROSE, { targetChars: 200, overlapChars: 40 })
    for (const chunk of chunks) {
      expect(PROSE.slice(chunk.charStart, chunk.charEnd)).toBe(chunk.text)
    }
  })

  it('overlaps consecutive chunks so boundary facts survive', () => {
    const chunks = chunkText(PROSE, { targetChars: 200, overlapChars: 40 })
    expect(chunks.length).toBeGreaterThan(1)
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].charStart).toBeLessThan(chunks[i - 1].charEnd)
      expect(chunks[i].charStart).toBeGreaterThan(chunks[i - 1].charStart)
    }
  })

  it('carries overlap even when the trailing sentence exceeds the overlap budget', () => {
    // Regression test for the Phase 6 overlap bug: the first version carried
    // nothing when the final sentence alone was longer than the overlap
    // budget, so consecutive chunks shared nothing. The fix always carries at
    // least the final sentence — here short2 (52 chars) against a 40 budget.
    const short1 = 'Alpha beta gamma delta epsilon zeta eta theta.'
    const short2 = 'Iota kappa lambda mu nu xi omicron pi rho sigma tau.'
    const long = `${'L'.repeat(140)}.`
    const text = [short1, short2, long].join(' ')

    const chunks = chunkText(text, { targetChars: 200, overlapChars: 40 })
    expect(chunks.length).toBeGreaterThan(1)
    const [first, second] = chunks
    expect(second.charStart).toBeLessThan(first.charEnd)
    expect(first.charEnd - second.charStart).toBeGreaterThan(40)
  })

  it('returns no chunks for empty or whitespace-only input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('hard-splits unpunctuated walls of text without losing content', () => {
    const wall = 'A'.repeat(5000)
    const chunks = chunkText(wall, { targetChars: 500, overlapChars: 50 })
    expect(chunks.length).toBeGreaterThan(1)
    const covered = chunks.map((c) => c.text).join('').length
    expect(covered).toBeGreaterThanOrEqual(5000 - chunks.length * 60)
  })

  it('refuses documents beyond the chunk ceiling instead of grinding', () => {
    const wall = 'A'.repeat(5000)
    expect(() =>
      chunkText(wall, { targetChars: 200, overlapChars: 0, maxChunks: 2 }),
    ).toThrow(/too large to index/)
  })

  it('never emits empty or whitespace-padded chunks', () => {
    const chunks = chunkText(PROSE, { targetChars: 200, overlapChars: 40 })
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(0)
      expect(chunk.text).not.toMatch(/\s$/)
    }
  })
})

describe('estimateTokens', () => {
  it('estimates roughly four characters per token', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100)
  })

  it('floors at one token', () => {
    expect(estimateTokens('')).toBe(1)
  })
})
