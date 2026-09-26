/**
 * Seeds the demo account: a fixed Lumenfield user holding the
 * `DEMO_CORPUS` documents, pre-chunked and pre-embedded, with the hand-curated
 * suggested questions stored in each document's metadata.
 *
 * Idempotent: any previous demo account is deleted first (documents, chunks,
 * sessions, accounts and rate-limit rows cascade with it).
 *
 * Usage: npm run seed:demo
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const { chunkText, estimateTokens } = await import('../src/lib/chunk')
  const { embedMany } = await import('../src/lib/ai/embeddings')
  const { db } = await import('../src/db')
  const { user, account } = await import('../src/db/auth-schema')
  const {
    createDocument,
    setStatus,
  } = await import('../src/lib/repositories/documents')
  const { replaceChunks } = await import('../src/lib/repositories/chunks')
  const { eq } = await import('drizzle-orm')
  const {
    DEMO_CORPUS,
    DEMO_EMAIL,
    DEMO_NAME,
    DEMO_PASSWORD,
  } = await import('../src/lib/demo/corpus')
  const { hashPassword } = await import('better-auth/crypto')

  // Clear any previous seed so re-running never duplicates.
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
  for (const row of existing) {
    await db.delete(user).where(eq(user.id, row.id))
  }
  if (existing.length > 0) {
    console.log(`removed previous demo account (${existing.length})`)
  }

  // The demo user logs in through the normal /auth page, so it needs a real
  // credential account. `hashPassword` is the same function Better Auth uses
  // internally, so sign-in verifies against this hash.
  const userId = crypto.randomUUID()
  await db.insert(user).values({
    id: userId,
    name: DEMO_NAME,
    email: DEMO_EMAIL,
    emailVerified: false,
  })
  await db.insert(account).values({
    accountId: userId,
    providerId: 'credential',
    userId,
    password: await hashPassword(DEMO_PASSWORD),
  })
  console.log(`demo user: ${DEMO_EMAIL}`)

  let totalChunks = 0

  for (const demo of DEMO_CORPUS) {
    const chunks = chunkText(demo.text)

    const doc = await createDocument({
      userId,
      title: demo.title,
      content: demo.text,
      status: 'PROCESSING',
      metadata: {
        source: 'demo-seed',
        suggestedQuestions: demo.questions.map((item) => item.q),
      },
    })

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
    await setStatus(userId, doc.id, 'PROCESSED')

    totalChunks += chunks.length
    console.log(
      `  ${demo.title}: ${chunks.length} chunk(s), ${demo.questions.length} curated question(s)`,
    )
  }

  console.log(
    `\nseeded ${DEMO_CORPUS.length} document(s), ${totalChunks} chunk(s)`,
  )
  console.log(`sign in as ${DEMO_EMAIL} with password: ${DEMO_PASSWORD}`)
}

main()
