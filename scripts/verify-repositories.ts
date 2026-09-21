/**
 * Verifies the tenant-isolation guardrail: every repository read filters by
 * userId, so one user cannot observe another user's rows.
 *
 * Usage: npx tsx scripts/verify-repositories.ts
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

async function main() {
  const { createDocument, getDocument, listDocuments, setStatus, countDocuments } =
    await import('../src/lib/repositories/documents')
  const {
    countChunksByDocument,
    deleteChunksByDocument,
    insertChunks,
    listChunksByDocument,
  } = await import('../src/lib/repositories/chunks')
  const { matchChunks } = await import('../src/lib/repositories/search')

  const { db } = await import('../src/db')
  const { user } = await import('../src/db/auth-schema')
  const { inArray } = await import('drizzle-orm')

  const userA = crypto.randomUUID()
  const userB = crypto.randomUUID()
  const created: string[] = []

  // Real users are required now that documents.user_id has an FK.
  await db.insert(user).values([
    {
      id: userA,
      name: 'Repo Test A',
      email: `repo-a+${userA}@example.test`,
      emailVerified: false,
    },
    {
      id: userB,
      name: 'Repo Test B',
      email: `repo-b+${userB}@example.test`,
      emailVerified: false,
    },
  ])

  try {
    // --- setup: user A owns a document with one chunk ---
    const docA = await createDocument({
      userId: userA,
      title: 'user A private note',
      content: 'the quick brown fox',
      status: 'PROCESSED',
    })
    created.push(docA.id)

    const embedding = Array.from({ length: 768 }, (_, i) => Math.sin(i / 100))
    await insertChunks([
      {
        documentId: docA.id,
        userId: userA,
        chunkIndex: 0,
        textChunk: 'the quick brown fox',
        embedding,
        tokenCount: 4,
      },
    ])

    // --- ownership: reads are scoped ---
    const aList = await listDocuments(userA)
    check('owner sees own document', aList.some((d) => d.id === docA.id))

    const bList = await listDocuments(userB)
    check('other user sees NOTHING', bList.length === 0, `rows: ${bList.length}`)

    const aGet = await getDocument(userA, docA.id)
    check('owner can fetch by id', aGet?.id === docA.id)

    const bGet = await getDocument(userB, docA.id)
    check(
      'IDOR blocked: other user gets null',
      bGet === null,
      bGet === null ? '' : 'LEAKED ROW',
    )

    // --- chunks are scoped ---
    const aChunks = await listChunksByDocument(userA, docA.id)
    check('owner sees own chunks', aChunks.length === 1)

    const bChunks = await listChunksByDocument(userB, docA.id)
    check('other user sees no chunks', bChunks.length === 0, `rows: ${bChunks.length}`)

    const bChunkCount = await countChunksByDocument(userB, docA.id)
    check('chunk count is scoped', bChunkCount === 0, `count: ${bChunkCount}`)

    // --- vector search is scoped ---
    const aMatches = await matchChunks({ userId: userA, embedding, limit: 5 })
    check('owner vector search finds own chunk', aMatches.length === 1)
    check(
      'search returns document title',
      aMatches[0]?.documentTitle === 'user A private note',
      aMatches[0]?.documentTitle,
    )

    const bMatches = await matchChunks({ userId: userB, embedding, limit: 5 })
    check(
      'other user vector search returns nothing',
      bMatches.length === 0,
      `rows: ${bMatches.length}`,
    )

    // --- document-scoped search ---
    const scoped = await matchChunks({
      userId: userA,
      embedding,
      limit: 5,
      documentId: docA.id,
    })
    check('document-scoped search works', scoped.length === 1)

    const wrongScope = await matchChunks({
      userId: userA,
      embedding,
      limit: 5,
      documentId: crypto.randomUUID(),
    })
    check('scoping to an unrelated document returns nothing', wrongScope.length === 0)

    // --- status transitions are scoped ---
    await setStatus(userB, docA.id, 'FAILED', 'should not apply')
    const afterForeignWrite = await getDocument(userA, docA.id)
    check(
      'other user cannot change status',
      afterForeignWrite?.status === 'PROCESSED',
      `status: ${afterForeignWrite?.status}`,
    )

    await setStatus(userA, docA.id, 'FAILED', 'owner can')
    const afterOwnWrite = await getDocument(userA, docA.id)
    check('owner can change status', afterOwnWrite?.status === 'FAILED')

    // --- deletion is scoped ---
    await deleteChunksByDocument(userB, docA.id)
    const stillThere = await countChunksByDocument(userA, docA.id)
    check('other user cannot delete chunks', stillThere === 1, `count: ${stillThere}`)

    // --- counts are scoped ---
    const aCount = await countDocuments(userA)
    const bCount = await countDocuments(userB)
    check(
      'document count is scoped',
      aCount === 1 && bCount === 0,
      `A:${aCount} B:${bCount}`,
    )
  } catch (err) {
    console.error('\nERROR:', err instanceof Error ? err.message : err)
    failures++
  } finally {
    // Deleting the users must cascade their documents and chunks.
    await db.delete(user).where(inArray(user.id, [userA, userB]))
    console.log('\ncleaned up test users (cascaded documents + chunks)')
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
