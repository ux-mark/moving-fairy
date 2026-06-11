import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface PanelStateRow {
  user_profile_id: string
  state: Record<string, unknown>
  updated_at: string
}

/** Read a user's panel state. Null when they've never opened a panel. */
export async function getPanelState(userProfileId: string): Promise<PanelStateRow | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('user_panel_state')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as PanelStateRow | null
}

/** Upsert a user's panel state; returns the row (with the new updated_at). */
export async function upsertPanelState(
  userProfileId: string,
  state: Record<string, unknown>
): Promise<PanelStateRow> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('user_panel_state')
    .upsert(
      { user_profile_id: userProfileId, state, updated_at: new Date().toISOString() },
      { onConflict: 'user_profile_id' }
    )
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to save panel state')
  return data as PanelStateRow
}
