/**
 * Object storage abstraction.
 *
 * Phase 3 removed Supabase Storage (the bucket lived in the deleted project).
 * Phase 4 implements these functions against Cloudflare R2 via the S3 API.
 *
 * Every caller goes through this module, so the provider swap touches one file.
 * Until Phase 4 lands, operations fail with an explicit, honest error rather
 * than a DNS failure against a host that no longer exists.
 */

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}

const NOT_MIGRATED =
  'Object storage is not configured yet — file storage is being migrated to Cloudflare R2 (Phase 4).'

export async function downloadObject(key: string): Promise<Buffer> {
  throw new StorageUnavailableError(`${NOT_MIGRATED} (requested: ${key})`)
}

export async function putObject(): Promise<never> {
  throw new StorageUnavailableError(NOT_MIGRATED)
}

export async function deleteObject(key: string): Promise<void> {
  throw new StorageUnavailableError(`${NOT_MIGRATED} (requested: ${key})`)
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY,
  )
}
