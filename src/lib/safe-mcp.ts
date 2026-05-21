/**
 * Wrap an MCP call so a missing-table error (schema not migrated yet) or any
 * other backend failure degrades to a safe fallback instead of throwing and
 * rendering a Next 500. Use only on the owner-side server components that
 * depend on the new sale-fairy-merge tables until the migration is applied.
 *
 * Logs the error so it shows up in the server logs but doesn't propagate.
 */
export async function safeMcp<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await call()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[safeMcp] degraded to fallback:', msg)
    return fallback
  }
}
