/**
 * Reconciles Cloudflare R2 against the database.
 *
 * There is an unavoidable window in the upload flow: presign -> PUT -> create
 * row. Abandon it after the PUT and the object has no row, so the DB cascade
 * that cleans up documents can never reach it. This finds those.
 *
 * Usage:
 *   node --env-file=.env.local scripts/cleanup-orphans.mjs           # report only
 *   node --env-file=.env.local scripts/cleanup-orphans.mjs --delete  # actually delete
 */
import { Pool } from '@neondatabase/serverless'
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'

const apply = process.argv.includes('--delete')

const s3 = new S3Client({
  region: process.env.STORAGE_REGION || 'auto',
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
})

const Bucket = process.env.STORAGE_BUCKET

async function listAllKeys() {
  const keys = []
  let token
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket, ContinuationToken: token }),
    )
    for (const obj of page.Contents ?? []) {
      if (obj.Key) keys.push({ key: obj.Key, size: obj.Size ?? 0 })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return keys
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()

try {
  const objects = await listAllKeys()

  const rows = await client.query(
    `select storage_path from documents where storage_path is not null`,
  )
  const known = new Set(rows.rows.map((r) => r.storage_path))

  const orphans = objects.filter((o) => !known.has(o.key))
  const orphanBytes = orphans.reduce((sum, o) => sum + o.size, 0)

  console.log(`objects in bucket : ${objects.length}`)
  console.log(`rows referencing  : ${known.size}`)
  console.log(`orphaned objects  : ${orphans.length} (${orphanBytes} bytes)`)

  for (const o of orphans) {
    console.log(`  - ${o.key}`)
  }

  if (orphans.length === 0) {
    console.log('\nNothing to do.')
  } else if (apply) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: orphans.map((o) => ({ Key: o.key })) },
      }),
    )
    console.log(`\nDeleted ${orphans.length} orphaned object(s).`)
  } else {
    console.log('\nDry run — re-run with --delete to remove them.')
  }

  // Housekeeping: rate-limit windows are tiny rows but accumulate forever.
  const pruned = await client.query(
    `delete from rate_limits where window_start < now() - interval '1 day'`,
  )
  console.log(`pruned ${pruned.rowCount} stale rate-limit window(s)`)
} catch (err) {
  console.error('ERROR:', err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
