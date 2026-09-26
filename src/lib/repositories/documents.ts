import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
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
  /** Curated or generated questions, for the Ask page. Empty when none. */
  suggestions: string[]
}

export async function listDocuments(
  userId: string,
  limit = 100,
): Promise<DocumentSummary[]> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      status: documents.status,
      createdAt: documents.createdAt,
      metadata: documents.metadata,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt,
    suggestions: questionsFromMetadata(row.metadata),
  }))
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

/**
 * Deletes a document row. Chunks go with it via ON DELETE CASCADE.
 * Returns false when no row matched, which is also how another user's
 * document id reports as "not found".
 */
export async function deleteDocument(
  userId: string,
  documentId: string,
): Promise<boolean> {
  const rows = await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .returning({ id: documents.id })

  return rows.length > 0
}

/** Every referenced R2 key. Used by orphan reconciliation. */
export async function listAllStoragePaths(): Promise<string[]> {
  const rows = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .where(isNotNull(documents.storagePath))

  return rows
    .map((row) => row.storagePath)
    .filter((path): path is string => typeof path === 'string')
}

/** Suggested questions live in `documents.metadata.suggestedQuestions`. */
const SUGGESTED_QUESTIONS_KEY = 'suggestedQuestions'

function questionsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const value = (metadata as Record<string, unknown>)[SUGGESTED_QUESTIONS_KEY]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * Merges suggested questions into the document's metadata.
 *
 * A jsonb merge (`||`) rather than a read-modify-write, so it cannot clobber
 * other metadata keys (sizeBytes, originalFilename, …) even if two writers race.
 */
export async function setSuggestedQuestions(
  userId: string,
  documentId: string,
  questions: string[],
): Promise<void> {
  await db
    .update(documents)
    .set({
      metadata: sql`coalesce(${documents.metadata}, '{}'::jsonb) || jsonb_build_object(${SUGGESTED_QUESTIONS_KEY}::text, ${JSON.stringify(questions)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
}

export async function getDocumentSuggestions(
  userId: string,
  documentId: string,
): Promise<string[]> {
  const rows = await db
    .select({ metadata: documents.metadata })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1)

  return questionsFromMetadata(rows[0]?.metadata)
}

export type DocumentSuggestions = {
  documentId: string
  title: string
  questions: string[]
}

/** Suggested questions for every document that has any. */
export async function listDocumentSuggestions(
  userId: string,
  limit = 100,
): Promise<DocumentSuggestions[]> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      metadata: documents.metadata,
    })
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))
    .limit(limit)

  return rows
    .map((row) => ({
      documentId: row.id,
      title: row.title,
      questions: questionsFromMetadata(row.metadata),
    }))
    .filter((row) => row.questions.length > 0)
}
