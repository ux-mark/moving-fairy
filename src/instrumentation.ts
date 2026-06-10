/**
 * Next.js instrumentation hook — runs once when the server boots.
 *
 * The Node-only stuck-item recovery is imported with a STATIC path, guarded by
 * `NEXT_RUNTIME === 'nodejs'`. In the Edge build the compiler replaces
 * NEXT_RUNTIME with 'edge', so the early return makes everything below dead
 * code — the import (and its Node-only deps: fs, child_process, supabase-js) is
 * eliminated and never traced into the Edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { recoverStuckItems } = await import('@/lib/recover-stuck-items')
  // Defer a few seconds so the server is fully accepting requests before we
  // start firing Claude CLI subprocesses.
  setTimeout(() => {
    void recoverStuckItems()
  }, 5_000)
}
