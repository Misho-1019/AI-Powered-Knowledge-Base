/**
 * DB smoke test — verifies the Neon schema is present and functional.
 * Usage: node --env-file=.env.local scripts/db-smoke.mjs
 */
import { Pool } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
let failures = 0

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
  if (!ok) failures++
}

try {
  const ext = await client.query(`select extname from pg_extension order by extname`)
  const extNames = ext.rows.map((r) => r.extname)
  check('vector extension installed', extNames.includes('vector'), extNames.join(', '))

  const tables = await client.query(
    `select table_name from information_schema.tables
     where table_schema='public' order by table_name`,
  )
  const tableNames = tables.rows.map((r) => r.table_name)
  check('documents table exists', tableNames.includes('documents'))
  check('document_chunks table exists', tableNames.includes('document_chunks'))

  const cols = await client.query(
    `select column_name, udt_name from information_schema.columns
     where table_schema='public' and table_name='document_chunks'`,
  )
  const embCol = cols.rows.find((c) => c.column_name === 'embedding')
  check('embedding column is a vector', embCol?.udt_name === 'vector', embCol?.udt_name)

  const dim = await client.query(
    `select atttypmod from pg_attribute
     where attrelid='public.document_chunks'::regclass and attname='embedding'`,
  )
  check('embedding is 768-dim', dim.rows[0]?.atttypmod === 768, String(dim.rows[0]?.atttypmod))

  const idx = await client.query(
    `select indexname, indexdef from pg_indexes where schemaname='public'`,
  )
  const idxNames = idx.rows.map((r) => r.indexname)
  check('hnsw index exists', idxNames.includes('document_chunks_embedding_hnsw'))
  const hnsw = idx.rows.find((r) => r.indexname === 'document_chunks_embedding_hnsw')
  check('hnsw uses vector_cosine_ops', /vector_cosine_ops/.test(hnsw?.indexdef ?? ''))
  check('chunk uniqueness index exists', idxNames.includes('document_chunks_doc_index_uq'))

  // round-trip: insert doc + chunk, read back, verify cosine operator, then cascade delete
  const userId = crypto.randomUUID()
  const doc = await client.query(
    `insert into documents (user_id, title, content, status)
     values ($1, $2, $3, 'PENDING') returning id`,
    [userId, 'smoke test document', 'hello world'],
  )
  const docId = doc.rows[0].id
  check('insert document', !!docId)

  const vec = '[' + Array.from({ length: 768 }, () => 0.001).join(',') + ']'
  await client.query(
    `insert into document_chunks (document_id, user_id, chunk_index, text_chunk, embedding, token_count)
     values ($1, $2, 0, 'smoke chunk', $3::vector, 2)`,
    [docId, userId, vec],
  )

  const back = await client.query(
    `select d.title, c.text_chunk, vector_dims(c.embedding) as dims
     from documents d join document_chunks c on c.document_id = d.id
     where d.id = $1`,
    [docId],
  )
  check('read back joined row', back.rows.length === 1, JSON.stringify(back.rows[0]))
  check('stored vector has 768 dims', back.rows[0]?.dims === 768, String(back.rows[0]?.dims))

  const sim = await client.query(
    `select 1 - (embedding <=> $1::vector) as cosine_similarity
     from document_chunks where document_id = $2`,
    [vec, docId],
  )
  check('cosine operator (<=>) works', sim.rows.length === 1, `rows: ${sim.rows.length}`)

  await client.query(`delete from documents where id = $1`, [docId])
  const orphans = await client.query(
    `select count(*)::int as n from document_chunks where document_id = $1`,
    [docId],
  )
  check('ON DELETE CASCADE removed chunks', orphans.rows[0].n === 0, `left: ${orphans.rows[0].n}`)
} catch (err) {
  console.error('\nERROR:', err.message)
  failures++
} finally {
  client.release()
  await pool.end()
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
