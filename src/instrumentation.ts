/**
 * Next.js instrumentation hook — runs once when the server boots.
 *
 * On the Node.js runtime we load `recover-stuck-items` via a path string the
 * Edge bundler can't statically trace. This prevents Edge from trying to
 * bundle Node-only deps (fs, child_process, supabase-js).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Defer recovery a few seconds so the server is fully accepting requests
  // before we start firing Claude CLI subprocesses.
  setTimeout(() => {
    void runRecovery()
  }, 5_000)
}

async function runRecovery() {
  try {
    // Path stored in a variable so Turbopack/webpack can't statically trace
    // this import into the Edge bundle.
    const modulePath = '@/lib/recover-stuck-items'
    const mod = (await import(modulePath)) as typeof import('@/lib/recover-stuck-items')
    await mod.recoverStuckItems()
  } catch (err) {
    console.error('[instrumentation] Stuck-item recovery failed:', err)
  }
}
