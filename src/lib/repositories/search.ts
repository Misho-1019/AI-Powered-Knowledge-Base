import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { extractRows } from '@/lib/drizzle-utils'
import { buildLexicalQuery, toVectorLiteral } from './search-query'

export type ChunkMatch = {
  id: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  textChunk: string
  similarity: number
  /** Reciprocal-rank-fusion score across the vector and lexical lists. */
  rrf: number
  /** 1-based rank in the vector list, or null if it did not place there. */
  vectorRank: number | null
  /** 1-based rank in the lexical list, or null if there was no keyword match. */
  lexicalRank: number | null
}

/** Standard RRF damping constant. */
const RRF_K = 60

/**
 * Hybrid semantic + keyword search over the caller's own chunks.
 *
 * Vector search alone blurs rare literal tokens — every "day N" sentence looks
 * alike, so a question about "day 12" retrieved days 5, 6, 8, 9 and 11. The
 * lexical half matches those tokens exactly, and the two ranked lists are
 * fused with reciprocal rank fusion.
 *
 * Passing no `query` (or a query with no usable tokens) degrades cleanly to
 * vector-only, because an empty tsquery simply matches nothing.
 */
export async function matchChunks(params: {
  userId: string
  embedding: number[]
  limit?: number
  documentId?: string | null
  /** The raw question. Omit for pure similarity search. */
  query?: string
}): Promise<ChunkMatch[]> {
  const vector = toVectorLiteral(params.embedding)
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 50)
  // Retrieve a wider candidate net than we return; fusion needs room.
  const candidates = Math.min(Math.max(limit * 4, 20), 100)

  const lexicalText = params.query ? buildLexicalQuery(params.query) : ''

  const userFilter = sql`user_id = ${params.userId}::uuid`
  const documentFilter = params.documentId
    ? sql`and document_id = ${params.documentId}::uuid`
    : sql``

  const result = await db.execute(sql`
    with vector_hits as (
      select id, row_number() over (order by distance) as rank
      from (
        select id, embedding <=> ${vector}::vector as distance
        from document_chunks
        where ${userFilter} ${documentFilter}
        order by embedding <=> ${vector}::vector
        limit ${candidates}
      ) v
    ),
    lexical_hits as (
      select id, row_number() over (order by score desc) as rank
      from (
        select
          id,
          ts_rank_cd(text_search, websearch_to_tsquery('english', ${lexicalText})) as score
        from document_chunks
        where ${userFilter} ${documentFilter}
          and text_search @@ websearch_to_tsquery('english', ${lexicalText})
        order by score desc
        limit ${candidates}
      ) l
    ),
    fused as (
      select
        coalesce(v.id, l.id) as id,
        coalesce(1.0 / (${RRF_K} + v.rank), 0) + coalesce(1.0 / (${RRF_K} + l.rank), 0) as rrf,
        v.rank as vector_rank,
        l.rank as lexical_rank
      from vector_hits v
      full outer join lexical_hits l on v.id = l.id
    )
    select
      c.id                                       as "id",
      c.document_id                              as "documentId",
      d.title                                    as "documentTitle",
      c.chunk_index                              as "chunkIndex",
      c.text_chunk                               as "textChunk",
      1 - (c.embedding <=> ${vector}::vector)     as "similarity",
      f.rrf                                      as "rrf",
      f.vector_rank                              as "vectorRank",
      f.lexical_rank                             as "lexicalRank"
    from fused f
    join document_chunks c on c.id = f.id
    join documents d on d.id = c.document_id
    order by f.rrf desc, "similarity" desc
    limit ${limit}
  `)

  return extractRows<Record<string, unknown>>(result).map((r) => ({
    id: String(r.id),
    documentId: String(r.documentId),
    documentTitle: String(r.documentTitle ?? 'Untitled'),
    chunkIndex: Number(r.chunkIndex),
    textChunk: String(r.textChunk),
    similarity: Number(r.similarity),
    rrf: Number(r.rrf ?? 0),
    vectorRank:
      r.vectorRank === null || r.vectorRank === undefined
        ? null
        : Number(r.vectorRank),
    lexicalRank:
      r.lexicalRank === null || r.lexicalRank === undefined
        ? null
        : Number(r.lexicalRank),
  }))
}
