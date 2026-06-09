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
  // Verify the JWT locally via the cached JWKS (the project uses asymmetric
  // ES256 keys), instead of auth.getUser() which calls the Auth server on every
  // page render. The middleware refreshes the token on each request, so the
  // cookie we read here is fresh and valid.
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (error || !claims?.sub) {
    return { user: null, profile: null }
  }

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('user_profile')
    .select('*')
    .eq('auth_user_id', claims.sub)
    .single()

  // Lightweight user built from the verified claims — callers only use this for
  // truthiness and, in one place, `email`.
  const user = {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
  } as unknown as import('@supabase/supabase-js').User

  return { user, profile: profile as UserProfile | null }
}
