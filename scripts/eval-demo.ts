/**
 * Demo-corpus eval — the Phase 11 proof.
 *
 * ~25 hand-written questions over the Lumenfield corpus, each graded on the
 * FULL answer path (`runRag`), not just retrieval. Every question carries
 * `expected` marker phrases (empty = must abstain). Retrieval columns
 * (vector-only vs hybrid) are kept so a miss can be blamed on retrieval or
 * generation honestly.
 *
 * Hermetic: seeds an isolated temp user from DEMO_CORPUS and deletes it
 * afterwards. Never touches demo@acme.test.
 *
 * README is frozen, so the headline number is reported here, not written
 * anywhere. Usage: npm run eval:demo
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

const TOP_K = 3

/**
 * Milliseconds between questions. Groq's free tier rate-limits rapid bursts;
 * without pacing, calls fail fast and grade as degraded.
 * Sequential + spaced keeps the eval honest about quality, not quota.
 */
const SLEEP_MS_BETWEEN_QUESTIONS = 6000

/**
 * A `degraded` answer means the model was unreachable (e.g. a 429), not that
 * the question is bad — so retry spaced-out before grading it a miss. A
 * persistent outage still fails after these, rather than hanging the eval.
 */
const ANSWER_ATTEMPTS = 3
const RETRY_WAIT_MS = 15000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type EvalQuestion = {
  q: string
  expected: string[]
  answerable: boolean
  /** Phrases only a hallucinating model would write (unanswerable only). */
  traps?: string[]
}

const QUESTIONS: EvalQuestion[] = [
  // ---- Employee Handbook (curated) ----
  { q: 'How many days of paid annual leave do employees get?', expected: ['25 days'], answerable: true },
  { q: 'What is the parental leave policy in the Berlin office?', expected: [], answerable: false, traps: ['berlin office offers', 'berlin office provides', 'berlin office employees receive'] },
  { q: 'How many days per week may employees work from home?', expected: ['three days', '3 days'], answerable: true },
  { q: 'Which offices does Lumenfield operate?', expected: ['London', 'Austin'], answerable: true },
  // ---- Operations Runbook (curated) ----
  { q: 'For a SEV-1 incident, how quickly must the on-call engineer page the incident commander?', expected: ['5 minutes'], answerable: true },
  { q: 'What is runbook ORB-17 for?', expected: ['database failover', 'read replica'], answerable: true },
  { q: 'What is the standard return window?', expected: ['30 days'], answerable: true },
  // ---- Q3 Business Review (curated) ----
  { q: 'How did refund volume change in Q3?', expected: ['rose 12%', '12%'], answerable: true },
  { q: 'What is the current return window, and how did it affect Q3 refunds?', expected: ['30 days', 'rose 12%', '12%'], answerable: true },
  { q: 'What was total revenue in Q3?', expected: ['$4.2M', '4.2'], answerable: true },
  // ---- Paraphrases (hand-written, one lexical anchor each) ----
  { q: "What's the annual leave allowance for full-time employees?", expected: ['25 days'], answerable: true },
  { q: 'How much paid vacation do employees receive each year?', expected: ['25 days'], answerable: true },
  { q: 'What is the remote work policy?', expected: ['three days', 'work from home', 'hybrid'], answerable: true },
  { q: 'How often can staff work from home?', expected: ['three days', '3 days'], answerable: true },
  { q: "Where are Lumenfield's offices located?", expected: ['London', 'Austin'], answerable: true },
  { q: 'How fast must the on-call engineer page the incident commander for a SEV-1?', expected: ['5 minutes'], answerable: true },
  { q: 'What is the paging requirement for a SEV-1 incident?', expected: ['5 minutes', 'page the incident commander'], answerable: true },
  { q: 'What does runbook ORB-17 cover?', expected: ['database failover', 'read replica'], answerable: true },
  { q: 'How long is the standard return window?', expected: ['30 days'], answerable: true },
  { q: 'Within how many days of delivery can customers return items?', expected: ['30 days'], answerable: true },
  { q: 'By how much did refund volume rise in Q3?', expected: ['12%'], answerable: true },
  { q: 'What return window change led to higher refunds in Q3?', expected: ['30 days', '12%'], answerable: true },
  { q: 'How much revenue did Lumenfield make in Q3?', expected: ['$4.2M', '4.2'], answerable: true },
  // ---- Extra unanswerables (nothing in the corpus covers these) ----
  { q: 'What is the dress code for the Berlin office?', expected: [], answerable: false, traps: ['dress code is', 'must wear', 'business casual', 'smart casual'] },
  { q: 'Does Lumenfield offer a pension match?', expected: [], answerable: false, traps: ['pension match is', 'matches contributions', 'offers a pension', 'pension plan'] },
]

/** The prose must state absence, not just dodge. Seen in the wild: "There is
 *  no mention of … in the provided sources", "do not specify", "couldn't find". */
const ABSENCE_RE =
  /no mention|couldn'?t find|do not specify|does not specify|not (?:specified|mentioned|found|covered|included)|no information|don't (?:have|know)|unable to/i

const CITATION_RE = /\[\d+\]/

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

function normalizeForMatch(text: string): string {
  // Models emit non-breaking spaces (notably around units: "30 days" with
  // U+202F). A literal substring check would miss those on a correct answer,
  // so fold all whitespace runs to a plain space on both sides.
  return text.toLowerCase().replace(/\s+/g, ' ')
}

function containsMarker(text: string, markers: string[]): boolean {
  const haystack = normalizeForMatch(text)
  return markers.some((m) => haystack.includes(normalizeForMatch(m)))
}

async function main() {
  const { chunkText, estimateTokens } = await import('../src/lib/chunk')
  const { embedMany, embedText } = await import('../src/lib/ai/embeddings')
  const { matchChunks } = await import('../src/lib/repositories/search')
  const { runRag } = await import('../src/lib/services/ragService')
  const { db } = await import('../src/db')
  const { user } = await import('../src/db/auth-schema')
  const { documents } = await import('../src/db/schema')
  const { inArray } = await import('drizzle-orm')
  const { createDocument } = await import('../src/lib/repositories/documents')
  const { replaceChunks } = await import('../src/lib/repositories/chunks')
  const { DEMO_CORPUS } = await import('../src/lib/demo/corpus')

  async function runRagWithRetry(params: {
    userId: string
    query: string
  }): Promise<Awaited<ReturnType<typeof runRag>>> {
    let last = await runRag(params)
    for (
      let attempt = 1;
      attempt < ANSWER_ATTEMPTS &&
      last.ok &&
      (last.answer === null || last.degraded);
      attempt++
    ) {
      await sleep(RETRY_WAIT_MS)
      last = await runRag(params)
    }
    return last
  }

  console.log(`questions: ${QUESTIONS.length} (${QUESTIONS.filter((item) => item.answerable).length} answerable, ${QUESTIONS.filter((item) => !item.answerable).length} unanswerable)\n`)

  const userId = crypto.randomUUID()
  await db.insert(user).values({
    id: userId,
    name: 'Demo Eval',
    email: `demoeval+${userId}@example.test`,
    emailVerified: false,
  })

  const docIds: string[] = []

  try {
    console.log('seeding demo corpus (loading the local model)…')
    for (const demo of DEMO_CORPUS) {
      const chunks = chunkText(demo.text)
      const doc = await createDocument({
        userId,
        title: demo.title,
        content: demo.text,
        status: 'PROCESSED',
      })
      docIds.push(doc.id)

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
    }
    console.log(`seeded ${docIds.length} documents\n`)

    let vectorHits = 0
    let hybridHits = 0
    let answerPasses = 0
    let answerable = 0
    let totalMs = 0

    console.log('question                                                     vector  hybrid  answer')
    console.log('-'.repeat(95))

    let firstQuestion = true
    for (const item of QUESTIONS) {
      if (!firstQuestion) await sleep(SLEEP_MS_BETWEEN_QUESTIONS)
      firstQuestion = false

      const label = item.q.length > 59 ? item.q.slice(0, 56) + '…' : item.q
      const started = Date.now()

      const embedding = await embedText(item.q)
      const vectorOnly = await matchChunks({ userId, embedding, limit: TOP_K })
      const hybrid = await matchChunks({ userId, embedding, limit: TOP_K, query: item.q })

      const result = await runRagWithRetry({ userId, query: item.q })
      const ms = Date.now() - started
      totalMs += ms

      if (!item.answerable) {
        // Unanswerable: the prose must refuse, without hallucinating.
        // Retrieval columns are meaningless here (a keyword can match while
        // the topic stays uncovered, e.g. "parental leave" vs "Berlin").
        let verdict = 'FAIL'
        let detail = ''
        if (!result.ok) {
          detail = `runRag error: ${result.error}`
        } else if (result.answer === null || result.degraded) {
          detail = 'degraded (no answer)'
        } else {
          const text = result.answer ?? ''
          const absence = ABSENCE_RE.test(text)
          const trap = (item.traps ?? []).some((t) =>
            text.toLowerCase().includes(t.toLowerCase()),
          )
          if (absence && !trap) verdict = 'PASS'
          else detail = `absence=${absence} trap=${trap} :: ${text.slice(0, 140)}`
          if (verdict === 'PASS') answerPasses++
        }
        console.log(
          `${label.padEnd(61)} ${'—'.padEnd(7)} ${'—'.padEnd(7)} ${verdict} (${(ms / 1000).toFixed(1)}s)${detail ? '  — ' + detail : ''}`,
        )
        if (verdict === 'FAIL') failures++
        continue
      }

      answerable++
      const vHit = vectorOnly.some((m) => containsMarker(m.textChunk, item.expected))
      const hHit = hybrid.some((m) => containsMarker(m.textChunk, item.expected))
      if (vHit) vectorHits++
      if (hHit) hybridHits++

      let verdict = 'FAIL'
      let detail = ''
      if (!result.ok) {
        detail = `runRag error: ${result.error}`
      } else if (result.answer === null || result.degraded) {
        detail = 'degraded (no answer)'
      } else {
        const grounded = containsMarker(result.answer, item.expected)
        const cited = CITATION_RE.test(result.answer)
        if (grounded && cited) {
          verdict = 'PASS'
          answerPasses++
        } else {
          detail = `expected=${grounded} cited=${cited} :: ${result.answer.slice(0, 140)}`
        }
      }

      console.log(
        `${label.padEnd(61)} ${(vHit ? 'HIT' : 'miss').padEnd(7)} ${(hHit ? 'HIT' : 'miss').padEnd(7)} ${verdict} (${(ms / 1000).toFixed(1)}s)${detail ? '  — ' + detail : ''}`,
      )
      if (verdict === 'FAIL') failures++
    }

    const total = QUESTIONS.length
    console.log('-'.repeat(95))
    console.log(`answerable               : ${answerable}`)
    console.log(`vector-only retrieval    : ${vectorHits}/${answerable}`)
    console.log(`hybrid retrieval         : ${hybridHits}/${answerable}`)
    console.log(`full answers correct     : ${answerPasses}/${total}  (${((answerPasses / total) * 100).toFixed(0)}%)`)
    console.log(`total LLM time           : ${(totalMs / 1000).toFixed(0)}s`)

    check('every question produced a graded answer (no harness errors)', failures === 0, `${failures} failed`)
  } catch (err) {
    console.error('\nERROR:', err instanceof Error ? err.message : err)
    failures++
  } finally {
    if (docIds.length > 0) {
      await db.delete(documents).where(inArray(documents.id, docIds))
    }
    await db.delete(user).where(inArray(user.id, [userId]))
    console.log('\ncleaned up eval fixture')
  }

  console.log(`\n${failures === 0 ? 'EVAL PASSED' : failures + ' CHECK(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
