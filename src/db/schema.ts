import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

/**
 * Lifecycle of a document through the ingestion pipeline.
 * FAILED exists so a broken ingest is recorded rather than silently lost.
 */
export const documentStatus = pgEnum('document_status', [
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
])

/**
 * Embedding width for sentence-transformers/all-mpnet-base-v2.
 * Changing the embedding model means a migration + full re-embed.
 */
export const EMBEDDING_DIMENSIONS = 768

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Owning user. Real FK with ON DELETE CASCADE — possible only because
     * Better Auth keeps its `user` table in this same database. Deleting a
     * user removes their documents (and, via a second cascade, their chunks).
     */
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Full note text for note-type documents. Never truncated. */
    content: text('content'),
    /** Object key in R2. Null for text notes. */
    storagePath: text('storage_path'),
    status: documentStatus('status').notNull().default('PENDING'),
    /** Reason recorded when status = FAILED. */
    error: text('error'),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('documents_user_created_idx').on(t.userId, t.createdAt.desc()),
  ],
)

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    textChunk: text('text_chunk').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    tokenCount: integer('token_count'),
    /** Offset of this chunk in the source text, for citation highlighting. */
    charStart: integer('char_start'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('document_chunks_doc_index_uq').on(t.documentId, t.chunkIndex),
    index('document_chunks_user_idx').on(t.userId),
    index('document_chunks_embedding_hnsw').using(
      'hnsw',
      t.embedding.op('vector_cosine_ops'),
    ),
  ],
)

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert
export type DocumentStatus = (typeof documentStatus.enumValues)[number]
