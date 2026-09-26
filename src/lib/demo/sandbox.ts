import { and, eq, gt, inArray, like, lt, sql } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { db } from '@/db'
import { account, user } from '@/db/auth-schema'
import { documentChunks, documents } from '@/db/schema'
import { SANDBOX } from '@/lib/config'
import { log } from '../log'
import { DEMO_EMAIL } from './corpus'
import { copyObject, deleteObjects } from '@/lib/storage'

/**
 * Throwaway demo accounts ("Option C" sandbox).
 *
 * A visitor clicks "Try it" and gets an isolated account whose documents are
 * byte-identical clones of the demo corpus — including the already-embedded
 * vectors — so the sandbox is ready in milliseconds with no re-embedding and
 * no shared rows. The visitor can still upload their own files afterwards.
 */

export type SandboxAccount = {
  userId: string
  email: string
  password: string
}

export async function createSandboxAccount(): Promise<SandboxAccount> {
  const userId = crypto.randomUUID()
  const email =
    `${SANDBOX.emailPrefix}${Date.now().toString(36)}-` +
    `${crypto.randomUUID().slice(0, 8)}@example.test`
  const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`

  await db.insert(user).values({
    id: userId,
    name: 'Sandbox',
    email,
    emailVerified: false,
  })
  await db.insert(account).values({
    accountId: userId,
    providerId: 'credential',
    userId,
    password: await hashPassword(password),
  })

  return { userId, email, password }
}

/** The demo account doubles as the clone template. Null when not seeded. */
export async function findTemplateUserId(): Promise<string | null> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1)

  return rows[0]?.id ?? null
}

export type CloneResult = {
  documents: number
  chunks: number
}

/**
 * Copies every document (and its chunks) from one user to another.
 *
 * File documents get a real server-side R2 copy under the new user's prefix,
 * so the `<userId>/…` ownership invariant holds for clones too. Text notes
 * copy as pure rows. The whole row swap runs in one transaction; R2 copies
 * run first because they cannot participate in it — if the transaction then
 * fails, the orphaned copies are picked up by housekeeping.
 */
export async function cloneTemplateDocuments(
  sourceUserId: string,
  targetUserId: string,
): Promise<CloneResult> {
  const sourceDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, sourceUserId))

  if (sourceDocs.length === 0) {
    throw new Error('Demo template has no documents to clone')
  }

  // R2 copies first (outside the transaction).
  const destPaths = new Map<string, string | null>()
  for (const doc of sourceDocs) {
    if (!doc.storagePath) {
      destPaths.set(doc.id, null)
      continue
    }

    const basename = doc.storagePath.includes('/')
      ? doc.storagePath.slice(doc.storagePath.indexOf('/') + 1)
      : doc.storagePath
    const dest = `${targetUserId}/${Date.now()}-${basename}`
    await copyObject(doc.storagePath, dest)
    destPaths.set(doc.id, dest)
  }

  let chunkCount = 0

  await db.transaction(async (tx) => {
    for (const doc of sourceDocs) {
      const sourceMetadata =
        doc.metadata && typeof doc.metadata === 'object'
          ? (doc.metadata as Record<string, unknown>)
          : {}

      const inserted = await tx
        .insert(documents)
        .values({
          userId: targetUserId,
          title: doc.title,
          content: doc.content,
          storagePath: destPaths.get(doc.id) ?? null,
          status: doc.status,
          error: doc.error,
          metadata: { ...sourceMetadata, source: 'sandbox-clone' },
        })
        .returning({ id: documents.id })

      const newDocId = inserted[0].id

      const sourceChunks = await tx
        .select()
        .from(documentChunks)
        .where(
          and(
            eq(documentChunks.documentId, doc.id),
            eq(documentChunks.userId, sourceUserId),
          ),
        )

      if (sourceChunks.length > 0) {
        await tx.insert(documentChunks).values(
          sourceChunks.map((chunk) => ({
            documentId: newDocId,
            userId: targetUserId,
            chunkIndex: chunk.chunkIndex,
            textChunk: chunk.textChunk,
            embedding: chunk.embedding,
            tokenCount: chunk.tokenCount,
            charStart: chunk.charStart,
          })),
        )
        chunkCount += sourceChunks.length
      }
    }
  })

  return { documents: sourceDocs.length, chunks: chunkCount }
}

/** How many sandbox accounts were created in the last hour (abuse guard). */
export async function countRecentSandboxes(): Promise<number> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000)
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(user)
    .where(
      and(
        like(user.email, `${SANDBOX.emailPrefix}%`),
        gt(user.createdAt, cutoff),
      ),
    )

  return rows[0]?.n ?? 0
}

/** Ids of sandbox accounts older than the TTL. */
export async function listStaleSandboxUserIds(
  ttlHours: number,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000)
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        like(user.email, `${SANDBOX.emailPrefix}%`),
        lt(user.createdAt, cutoff),
      ),
    )

  return rows.map((row) => row.id)
}

export async function listStoragePathsForUsers(
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return []

  const rows = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .where(inArray(documents.userId, userIds))

  return rows
    .map((row) => row.storagePath)
    .filter((path): path is string => typeof path === 'string')
}

export async function deleteUsersByIds(userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0

  const removed = await db
    .delete(user)
    .where(inArray(user.id, userIds))
    .returning({ id: user.id })

  return removed.length
}

/**
 * Removes stale sandbox accounts *and* their R2 objects.
 *
 * Object first, then the user row — the same ordering the document DELETE
 * endpoint uses. Anything left behind by a crash is caught by the orphan
 * scan that runs right after this.
 */
export async function pruneStaleSandboxes(ttlHours: number): Promise<{
  users: number
  objects: number
}> {
  const stale = await listStaleSandboxUserIds(ttlHours)
  if (stale.length === 0) return { users: 0, objects: 0 }

  const paths = await listStoragePathsForUsers(stale)
  if (paths.length > 0) {
    await deleteObjects(paths).catch((err) => {
      log.error('[housekeeping] sandbox object delete failed', { error: err })
    })
  }

  const users = await deleteUsersByIds(stale)
  return { users, objects: paths.length }
}
