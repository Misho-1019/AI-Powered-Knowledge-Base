import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { documents, type Document, type DocumentStatus } from '@/db/schema'

/**
 * Every function here takes `userId` and filters on it unconditionally.
 *
 * There is no longer a policy layer that can be wrong: ownership is enforced in
 * the query itself, so a missing or misconfigured RLS policy cannot expose
 * another tenant's rows.
 */

export type DocumentSummary = {
  id: string
  title: string
  status: DocumentStatus
  createdAt: Date
}

export async function listDocuments(
  userId: string,
  limit = 100,
): Promise<DocumentSummary[]> {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      status: documents.status,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))
    .limit(limit)
}

export async function getDocument(
  userId: string,
  documentId: string,
): Promise<Document | null> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1)

  return rows[0] ?? null
}

export async function createDocument(input: {
  userId: string
  title: string
  content?: string | null
  storagePath?: string | null
  status?: DocumentStatus
  metadata?: Record<string, unknown>
}): Promise<{ id: string }> {
  const rows = await db
    .insert(documents)
    .values({
      userId: input.userId,
      title: input.title,
      content: input.content ?? null,
      storagePath: input.storagePath ?? null,
      status: input.status ?? 'PENDING',
      metadata: input.metadata ?? {},
    })
    .returning({ id: documents.id })

  return rows[0]
}

export async function setStatus(
  userId: string,
  documentId: string,
  status: DocumentStatus,
  error?: string | null,
): Promise<void> {
  await db
    .update(documents)
    .set({ status, error: error ?? null, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
}

export async function countDocuments(userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(documents)
    .where(eq(documents.userId, userId))

  return rows[0]?.n ?? 0
}
