import { NextRequest } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/auth'
import { getOrCreateItemConversation, getConversationMessages } from '@/mcp'

// GET /api/items/:id/chat/messages
// Returns the conversation history for an item.
// Creates the conversation record lazily if it doesn't exist yet — returns an
// empty messages array when the conversation is brand new.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  try {
    const conversation = await getOrCreateItemConversation(id, profile.id)
    const messages = await getConversationMessages(conversation.id)
    return Response.json({ messages })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    if (message.includes('not found') || message.includes('not owned')) {
      // These are safe to surface — they describe ownership/existence, not internals
      return Response.json({ error: message }, { status: 404 })
    }
    // Log full error server-side; return a generic message to avoid leaking
    // internal details (table names, column names, raw Supabase errors).
    console.error('[chat-messages] Error:', err)
    return Response.json(
      { error: 'Something went wrong loading the conversation.' },
      { status: 500 }
    )
  }
}
