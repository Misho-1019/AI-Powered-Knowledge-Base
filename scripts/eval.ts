/**
 * Minimal retrieval eval — measures whether the correct chunk is retrieved.
 *
 * Runs every question twice: vector-only (no query text → lexical half matches
 * nothing) and hybrid (vector + keyword, fused with RRF). The comparison
 * isolates the effect of the hybrid change rather than just asserting it helps.
 *
 * Usage: npx tsx scripts/eval.ts
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

const DAYS = 20
const TOP_K = 3

type Question = { q: string; marker: string | null }

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

/** Builds a corpus of near-identical daily reports — the shape that broke vector-only retrieval. */
function buildFixture(): { text: string; questions: Question[] } {
  const parts: string[] = ['Operations Report — monthly compilation.']

  for (let day = 1; day <= DAYS; day++) {
    const units = 800 + day * 17
    const exceptions = 2 + (day % 5)
    const hours = 18 + (day % 6)
    const shiftFive = 900 + day * 13

    parts.push(
      [
        `Day ${day} operations summary.`,
        `Shift 5 processed ${shiftFive} units with ${exceptions} exceptions logged during the run.`,
        `The conveyor line ran for ${hours} hours with no unplanned stops.`,
        `Total throughput for the day reached ${units} units across all shifts.`,
        `Safety observations were reviewed and closed by the duty supervisor.`,
        `Inventory accuracy for day ${day} was confirmed during the evening audit.`,
        `The second conveyor line remained available as a standby unit throughout.`,
        `Maintenance completed its scheduled inspection without finding any faults.`,
        `Outbound trailers were loaded and dispatched according to the published schedule.`,
        `The returns bay processed its backlog and cleared all pending items.`,
        `Cycle counting continued across aisles seven through fourteen without discrepancy.`,
        `The night shift handover documented outstanding tasks for the following morning.`,
        `Ambient temperature remained within the required range for stored goods.`,
        `Forklift utilisation stayed within the planned threshold for the full period.`,
        `Any damaged pallets were segregated and recorded for replacement.`,
        `The shift supervisor signed off the day ${day} record before departure.`,
      ].join(' '),
    )
  }

  const questions: Question[] = [
    { q: 'What did shift 5 process on day 12?', marker: 'Day 12 operations summary' },
    { q: 'How many units did shift 5 handle on day 3?', marker: 'Day 3 operations summary' },
    { q: 'What did shift 5 process on day 7?', marker: 'Day 7 operations summary' },
    { q: 'Tell me about shift 5 output on day 19?', marker: 'Day 19 operations summary' },
    { q: 'What did shift 5 process on day 15?', marker: 'Day 15 operations summary' },
    { q: 'Shift 5 output for day 9?', marker: 'Day 9 operations summary' },
    { q: 'What did shift 5 process on day 20?', marker: 'Day 20 operations summary' },
    { q: 'What is the parental leave policy in the Berlin office?', marker: null },
  ]

  return { text: parts.join('\n\n'), questions }
}

async function main() {
  const { chunkText } = await import('../src/lib/chunk')
  const { embedMany, embedText } = await import('../src/lib/ai/embeddings')
  const { matchChunks } = await import('../src/lib/repositories/search')
  const { db } = await import('../src/db')
  const { user } = await import('../src/db/auth-schema')
  const { documents } = await import('../src/db/schema')
  const { inArray } = await import('drizzle-orm')
  const { createDocument } = await import('../src/lib/repositories/documents')
  const { replaceChunks } = await import('../src/lib/repositories/chunks')
  const { estimateTokens } = await import('../src/lib/chunk')

  const { text, questions } = buildFixture()
  const chunks = chunkText(text)
  console.log(`fixture: ${text.length} chars → ${chunks.length} chunks`)
  console.log(`questions: ${questions.length}\n`)

  const userId = crypto.randomUUID()
  await db.insert(user).values({
    id: userId,
    name: 'Eval Fixture',
    email: `eval+${userId}@example.test`,
    emailVerified: false,
  })

  const doc = await createDocument({
    userId,
    title: 'monthly-operations-report.txt',
    content: text,
    status: 'PROCESSED',
  })

  try {
    console.log('embedding fixture (loading the local model)…')
    const vectors = await embedMany(chunks.map((c) => c.text))
    await replaceChunks(
      userId,
      doc.id,
      chunks.map((chunk, index) => ({
        documentId: doc.id,
        userId,
        chunkIndex: index,
        textChunk: chunk.text,
        embedding: vectors[index],
        tokenCount: estimateTokens(chunk.text),
        charStart: chunk.charStart,
      })),
    )

    let vectorHits = 0
    let hybridHits = 0
    let answerable = 0
    let abstainVector = 0
    let abstainHybrid = 0

    console.log('\nquestion                                                    vector  hybrid')
    console.log('-'.repeat(78))

    for (const item of questions) {
      const embedding = await embedText(item.q)

      const vectorOnly = await matchChunks({
        userId,
        embedding,
        limit: TOP_K,
        // no `query` → lexical half contributes nothing
      })

      const hybrid = await matchChunks({
        userId,
        embedding,
        limit: TOP_K,
        query: item.q,
      })

      const label = item.q.length > 56 ? item.q.slice(0, 53) + '…' : item.q

      if (item.marker === null) {
        // Unanswerable: the correct behaviour is to retrieve nothing relevant.
        const vRelevant = vectorOnly.some((m) => m.lexicalRank !== null)
        const hRelevant = hybrid.some((m) => m.lexicalRank !== null)
        const vClean = !vRelevant
        const hClean = !hRelevant
        if (vClean) abstainVector++
        if (hClean) abstainHybrid++
        console.log(
          `${label.padEnd(58)} ${(vClean ? 'clean' : 'match').padEnd(7)} ${hClean ? 'clean' : 'match'}`,
        )
        continue
      }

      answerable++
      const vHit = vectorOnly.some((m) => m.textChunk.includes(item.marker!))
      const hHit = hybrid.some((m) => m.textChunk.includes(item.marker!))
      if (vHit) vectorHits++
      if (hHit) hybridHits++

      console.log(
        `${label.padEnd(58)} ${(vHit ? 'HIT' : 'miss').padEnd(7)} ${hHit ? 'HIT' : 'miss'}`,
      )
    }

    const vRate = answerable ? (vectorHits / answerable) * 100 : 0
    const hRate = answerable ? (hybridHits / answerable) * 100 : 0

    console.log('-'.repeat(78))
    console.log(`answerable questions : ${answerable}`)
    console.log(`vector-only hit rate : ${vectorHits}/${answerable}  (${vRate.toFixed(0)}%)`)
    console.log(`hybrid hit rate      : ${hybridHits}/${answerable}  (${hRate.toFixed(0)}%)`)
    console.log(`unanswerable handled : vector ${abstainVector}/1, hybrid ${abstainHybrid}/1`)

    check('hybrid retrieves at least as many correct chunks as vector-only', hybridHits >= vectorHits,
      `hybrid ${hybridHits} vs vector ${vectorHits}`)
    check('the day-12 style question is retrieved by hybrid', hybridHits > 0)
  } catch (err) {
    console.error('\nERROR:', err instanceof Error ? err.message : err)
    failures++
  } finally {
    await db.delete(documents).where(inArray(documents.id, [doc.id]))
    await db.delete(user).where(inArray(user.id, [userId]))
    console.log('\ncleaned up eval fixture')
  }

  console.log(`\n${failures === 0 ? 'EVAL PASSED' : failures + ' CHECK(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
