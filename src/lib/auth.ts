import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import type { UserProfile } from '@/types/database'

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getAuthenticatedProfile(): Promise<{
  user: import('@supabase/supabase-js').User | null
  profile: UserProfile | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { user: null, profile: null }
  }

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('user_profile')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return { user, profile: profile as UserProfile | null }
}
