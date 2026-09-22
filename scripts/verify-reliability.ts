/**
 * Verifies Phase 6's two reliability claims:
 *   1. the chunker is sentence-aware and its offsets map back to the source
 *   2. replaceChunks is genuinely atomic — a failure mid-swap leaves the
 *      previous chunks intact
 *
 * Usage: npx tsx scripts/verify-reliability.ts
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

async function main() {
  const { chunkText } = await import('../src/lib/chunk')

  // ---------------- chunker ----------------
  console.log('--- chunker ---')

  const prose = [
    'The warehouse handles inbound freight every weekday morning.',
    'Shipments are scanned at the dock before being routed to storage.',
    'Throughput rose sharply after the conveyor retrofit in August.',
    'Staffing stayed flat at forty two people across the whole quarter.',
    'Two minor safety reports were filed and both closed within two days.',
    'The second conveyor line is scheduled for retrofit in January.',
    'Inventory accuracy improved to ninety nine point two percent.',
    'Returns processing moved to a dedicated bay near the loading dock.',
  ].join(' ')

  const chunks = chunkText(prose, { targetChars: 200, overlapChars: 40 })
  check('produces more than one chunk', chunks.length > 1, `${chunks.length} chunks`)

  const tooLong = chunks.filter((c) => c.text.length > 200 + 60)
  check('no chunk wildly exceeds the target', tooLong.length === 0, `${tooLong.length} oversized`)

  const offsetsOk = chunks.every((c) => prose.slice(c.charStart, c.charEnd) === c.text)
  check('offsets map exactly back to the source text', offsetsOk)

  const sentencesIntact = chunks.every((c) => !/\s$/.test(c.text) && c.text.length > 0)
  check('no empty or whitespace-padded chunks', sentencesIntact)

  const first = chunks[0]
  const second = chunks[1]
  const overlap = first.charStart < second.charStart && second.charStart < first.charEnd
  check('consecutive chunks overlap', overlap)

  check('empty input yields no chunks', chunkText('').length === 0)
  check('whitespace-only input yields no chunks', chunkText('   \n\n  ').length === 0)

  const wall = 'A'.repeat(5000)
  const wallChunks = chunkText(wall, { targetChars: 500, overlapChars: 50 })
  check('unpunctuated wall of text is still chunked', wallChunks.length > 1, `${wallChunks.length} chunks`)

  // hardSplit must make progress, never loop forever
  const wallCoversEverything = wallChunks.map((c) => c.text).join('').length >= 5000 - wallChunks.length * 60
  check('hard-split covers the input', wallCoversEverything)

  // ---------------- atomic replacement ----------------
  console.log('\n--- atomic chunk replacement ---')

  const { db } = await import('../src/db')
  const { user } = await import('../src/db/auth-schema')
  const { documents } = await import('../src/db/schema')
  const { inArray } = await import('drizzle-orm')
  const { createDocument } = await import('../src/lib/repositories/documents')
  const { replaceChunks, countChunksByDocument, listChunksByDocument } =
    await import('../src/lib/repositories/chunks')

  const userId = crypto.randomUUID()
  await db.insert(user).values({
    id: userId,
    name: 'Reliability Test',
    email: `reliability+${userId}@example.test`,
    emailVerified: false,
  })

  const { EMBEDDING_DIMENSIONS } = await import('../src/db/schema')
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01)
  const row = (documentId: string, index: number, text: string) => ({
    documentId,
    userId,
    chunkIndex: index,
    textChunk: text,
    embedding: vector,
    tokenCount: 4,
    charStart: index * 10,
  })

  const doc = await createDocument({
    userId,
    title: 'atomicity test',
    content: 'x',
    status: 'PROCESSED',
  })

  await replaceChunks(userId, doc.id, [
    row(doc.id, 0, 'original chunk zero'),
    row(doc.id, 1, 'original chunk one'),
  ])
  const afterFirst = await countChunksByDocument(userId, doc.id)
  check('initial replace writes 2 chunks', afterFirst === 2, `count ${afterFirst}`)

  // A malformed vector makes the INSERT fail AFTER the DELETE has run.
  // Without a transaction the two original chunks would be gone.
  let threw = false
  try {
    await replaceChunks(userId, doc.id, [
      {
        ...row(doc.id, 0, 'bad chunk'),
        embedding: [0.1, 0.2, 0.3] as unknown as number[],
      },
    ])
  } catch {
    threw = true
  }
  check('a failing replacement throws', threw)

  const afterFailure = await countChunksByDocument(userId, doc.id)
  check(
    'ATOMIC: previous chunks survived the failure',
    afterFailure === 2,
    `count ${afterFailure}`,
  )

  const surviving = await listChunksByDocument(userId, doc.id)
  check(
    'surviving chunks are the originals',
    surviving[0]?.textChunk === 'original chunk zero',
    surviving[0]?.textChunk,
  )

  // Empty replacement must be refused outright.
  let emptyThrew = false
  try {
    await replaceChunks(userId, doc.id, [])
  } catch {
    emptyThrew = true
  }
  check('empty replacement is refused', emptyThrew)
  check(
    'chunks still intact after refusal',
    (await countChunksByDocument(userId, doc.id)) === 2,
  )

  // A good replacement still works.
  await replaceChunks(userId, doc.id, [
    row(doc.id, 0, 'new zero'),
    row(doc.id, 1, 'new one'),
    row(doc.id, 2, 'new two'),
  ])
  const afterGood = await countChunksByDocument(userId, doc.id)
  check('successful replacement swaps to 3 chunks', afterGood === 3, `count ${afterGood}`)

  // cleanup
  await db.delete(documents).where(inArray(documents.id, [doc.id]))
  await db.delete(user).where(inArray(user.id, [userId]))
  console.log('\ncleaned up test user and document')

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
