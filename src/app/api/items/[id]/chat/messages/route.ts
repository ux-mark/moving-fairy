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
      return Response.json({ error: message }, { status: 404 })
    }
    return Response.json({ error: message }, { status: 500 })
  }
}
