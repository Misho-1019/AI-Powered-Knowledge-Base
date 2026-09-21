import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { EMBEDDING_DIMENSIONS } from '@/db/schema'

export type ChunkMatch = {
  id: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  textChunk: string
  similarity: number
}

/**
 * Semantic search over the caller's own chunks.
 *
 * This deliberately replaces the previous `match_chunks` Postgres RPC. The RPC
 * signature had drifted out of sync with the generated types (the generated
 * types said 3 arguments, the caller passed 4 with `as any` to silence it), so
 * it was unknowable whether the flagship endpoint had ever worked. Raw SQL in
 * one place, parameterised, has no such gap.
 *
 * Table and column names are written literally on purpose: this query is the
 * performance-critical path and should be readable as SQL.
 */
export async function matchChunks(params: {
  userId: string
  embedding: number[]
  limit?: number
  documentId?: string | null
}): Promise<ChunkMatch[]> {
  const vector = toVectorLiteral(params.embedding)
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 50)

  const documentFilter = params.documentId
    ? sql`and c.document_id = ${params.documentId}::uuid`
    : sql``

  const result = await db.execute(sql`
    select
      c.id                                      as "id",
      c.document_id                             as "documentId",
      d.title                                   as "documentTitle",
      c.chunk_index                             as "chunkIndex",
      c.text_chunk                              as "textChunk",
      1 - (c.embedding <=> ${vector}::vector)    as "similarity"
    from document_chunks c
    join documents d on d.id = c.document_id
    where c.user_id = ${params.userId}::uuid
      and d.user_id = ${params.userId}::uuid
      ${documentFilter}
    order by c.embedding <=> ${vector}::vector
    limit ${limit}
  `)

  return extractRows<Record<string, unknown>>(result).map((r) => ({
    id: String(r.id),
    documentId: String(r.documentId),
    documentTitle: String(r.documentTitle ?? 'Untitled'),
    chunkIndex: Number(r.chunkIndex),
    textChunk: String(r.textChunk),
    similarity: Number(r.similarity),
  }))
}

function toVectorLiteral(embedding: number[]): string {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding must have ${EMBEDDING_DIMENSIONS} dimensions, received ${embedding?.length ?? 0}`,
    )
  }
  if (!embedding.every((n) => Number.isFinite(n))) {
    throw new Error('Embedding contains non-finite values')
  }
  return `[${embedding.join(',')}]`
}

/**
 * `db.execute` returns different shapes across Drizzle drivers, so accept both
 * rather than depending on one.
 */
function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const maybe = result as { rows?: unknown } | null
  if (maybe && Array.isArray(maybe.rows)) return maybe.rows as T[]
  return []
}
