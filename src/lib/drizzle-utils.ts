/**
 * `db.execute` returns different shapes across Drizzle drivers, so accept both
 * rather than depending on one.
 */
export function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  const maybe = result as { rows?: unknown } | null
  if (maybe && Array.isArray(maybe.rows)) return maybe.rows as T[]
  return []
}
