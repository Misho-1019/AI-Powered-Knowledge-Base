import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  documentChunks,
  type NewDocumentChunk,
} from '@/db/schema'

export type ChunkRow = {
  id: string
  chunkIndex: number
  textChunk: string
  tokenCount: number | null
  charStart: number | null
  createdAt: Date
}

export async function insertChunks(rows: NewDocumentChunk[]): Promise<void> {
  if (rows.length === 0) return
  await db.insert(documentChunks).values(rows)
}

/**
 * Swaps a document's chunks atomically.
 *
 * The previous flow deleted all chunks and *then* embedded and inserted them.
 * Any failure in between destroyed a working index and left the document with
 * zero searchable chunks. Both statements now run in one transaction, so the
 * old chunks survive unless the new ones are fully ready.
 *
 * Refuses an empty replacement on purpose: "processed" must never mean
 * "no chunks".
 */
export async function replaceChunks(
  userId: string,
  documentId: string,
  rows: NewDocumentChunk[],
): Promise<void> {
  if (rows.length === 0) {
    throw new Error('Refusing to replace chunks with an empty set')
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(documentChunks)
      .where(
        and(
          eq(documentChunks.documentId, documentId),
          eq(documentChunks.userId, userId),
        ),
      )

    await tx.insert(documentChunks).values(rows)
  })
}

export async function deleteChunksByDocument(
  userId: string,
  documentId: string,
): Promise<void> {
  await db
    .delete(documentChunks)
    .where(
      and(
        eq(documentChunks.documentId, documentId),
        eq(documentChunks.userId, userId),
      ),
    )
}

export async function listChunksByDocument(
  userId: string,
  documentId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<ChunkRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const offset = Math.max(opts.offset ?? 0, 0)

  return db
    .select({
      id: documentChunks.id,
      chunkIndex: documentChunks.chunkIndex,
      textChunk: documentChunks.textChunk,
      tokenCount: documentChunks.tokenCount,
      charStart: documentChunks.charStart,
      createdAt: documentChunks.createdAt,
    })
    .from(documentChunks)
    .where(
      and(
        eq(documentChunks.documentId, documentId),
        eq(documentChunks.userId, userId),
      ),
    )
    .orderBy(asc(documentChunks.chunkIndex))
    .limit(limit)
    .offset(offset)
}

export async function countChunksByDocument(
  userId: string,
  documentId: string,
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(documentChunks)
    .where(
      and(
        eq(documentChunks.documentId, documentId),
        eq(documentChunks.userId, userId),
      ),
    )

  return rows[0]?.n ?? 0
}
