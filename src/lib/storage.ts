import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Object storage, backed by Cloudflare R2 through its S3-compatible API.
 *
 * Everything that touches storage goes through this module, so the provider is
 * a one-file decision. Phase 3 removed Supabase Storage; this is its
 * replacement.
 */

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new StorageUnavailableError(`Missing ${name}`)
  return value
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY,
  )
}

let cached: S3Client | null = null

function getClient(): S3Client {
  if (cached) return cached
  cached = new S3Client({
    // R2's S3 region is literally "auto".
    region: process.env.STORAGE_REGION || 'auto',
    endpoint: requireEnv('STORAGE_ENDPOINT'),
    credentials: {
      accessKeyId: requireEnv('STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('STORAGE_SECRET_ACCESS_KEY'),
    },
  })
  return cached
}

function getBucket(): string {
  return requireEnv('STORAGE_BUCKET')
}

const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

/**
 * Object key for a user's upload: `<userId>/<timestamp>-<slug>`.
 *
 * The userId prefix is what makes ownership checkable later, so Phase 5 can
 * verify a claimed path actually belongs to the caller.
 */
export function buildObjectKey(userId: string, filename: string): string {
  const slug =
    filename
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(-120) || 'file'

  return `${userId}/${Date.now()}-${slug}`
}

export type PresignedUpload = {
  key: string
  uploadUrl: string
  contentType: string
}

/**
 * Presigned PUT so the browser uploads straight to R2.
 *
 * Going direct matters: Vercel caps serverless request bodies at ~4.5 MB, and
 * routing file bytes through an API route would silently break larger files.
 *
 * `contentLength` is signed into the URL, so R2 itself rejects an oversized
 * upload rather than trusting the client's claim. The content type is part of
 * the signature too, so the caller MUST send back the exact `contentType`
 * returned here.
 */
export async function presignUpload(params: {
  key: string
  contentType?: string
  contentLength?: number
  expiresInSeconds?: number
}): Promise<PresignedUpload> {
  const contentType = params.contentType?.trim() || DEFAULT_CONTENT_TYPE

  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: params.key,
    ContentType: contentType,
    ...(params.contentLength ? { ContentLength: params.contentLength } : {}),
  })

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: params.expiresInSeconds ?? 600,
  })

  return { key: params.key, uploadUrl, contentType }
}

export async function presignDownload(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key })
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds })
}

export async function downloadObject(key: string): Promise<Buffer> {
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
  )

  if (!result.Body) {
    throw new StorageUnavailableError(`Empty object body for ${key}`)
  }

  const bytes = await result.Body.transformToByteArray()
  return Buffer.from(bytes)
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
    )
    return true
  } catch {
    return false
  }
}

export type ObjectInfo = { size: number; contentType: string | null }

/** Returns object metadata, or null when the object does not exist. */
export async function headObject(key: string): Promise<ObjectInfo | null> {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
    )
    return {
      size: Number(result.ContentLength ?? 0),
      contentType: result.ContentType ?? null,
    }
  } catch {
    return null
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  )
}

/**
 * Applies the CORS rule the browser needs for direct presigned PUTs.
 * Only works if the R2 token has bucket-configuration permission.
 */
export async function applyBucketCors(origins: string[]): Promise<void> {
  await getClient().send(
    new PutBucketCorsCommand({
      Bucket: getBucket(),
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ['PUT', 'GET', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  )
}
