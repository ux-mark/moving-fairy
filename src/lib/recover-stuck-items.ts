/**
 * Server-boot recovery: finds items orphaned by a prior crash and re-runs
 * assessment serially. Imported by src/instrumentation.ts via a path string
 * to keep the Node-only deps (fs, child_process, supabase) out of the Edge
 * bundle.
 */
import { createClient } from '@supabase/supabase-js'
import { assessItem } from '@/lib/assess-item'
import { updateItemAssessment } from '@/mcp'
import { ProcessingStatus } from '@/lib/constants'

const STUCK_PENDING_AGE_MS = 60_000      // 1min — the auto-trigger fires within seconds of upload
const STUCK_PROCESSING_AGE_MS = 180_000  // 3min — assessment normally completes in 30-60s

export async function recoverStuckItems(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: items, error } = await supabase
    .from('item_assessment')
    .select('id, user_profile_id, processing_status, updated_at, created_at')
    .in('processing_status', [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING])
    .order('updated_at', { ascending: true })

  if (error) {
    console.error('[instrumentation] Failed to fetch stuck items:', error.message)
    return
  }
  if (!items || items.length === 0) {
    console.log('[instrumentation] No stuck items to recover.')
    return
  }

  const now = Date.now()
  const stuck = items.filter((i) => {
    const lastTouched = new Date(i.updated_at ?? i.created_at).getTime()
    const age = now - lastTouched
    if (i.processing_status === ProcessingStatus.PENDING) return age > STUCK_PENDING_AGE_MS
    if (i.processing_status === ProcessingStatus.PROCESSING) return age > STUCK_PROCESSING_AGE_MS
    return false
  })

  if (stuck.length === 0) {
    console.log(`[instrumentation] ${items.length} non-completed items found, none past stuck threshold yet.`)
    return
  }

  console.log(`[instrumentation] Recovering ${stuck.length} stuck items serially…`)

  for (const item of stuck) {
    try {
      console.log(`[instrumentation] Recovering item ${item.id} (was ${item.processing_status})`)
      await updateItemAssessment(
        item.id,
        { processing_status: ProcessingStatus.PROCESSING },
        item.user_profile_id
      )
      await assessItem(item.id, item.user_profile_id)
      console.log(`[instrumentation] Finished recovering ${item.id}`)
    } catch (err) {
      console.error(`[instrumentation] Recovery failed for ${item.id}:`, err)
    }
  }

  console.log('[instrumentation] Recovery complete.')
}
