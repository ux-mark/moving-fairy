import { removeItemFromBox } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ boxId: string; itemId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { boxId, itemId } = await params
  try {
    await removeItemFromBox(boxId, itemId)
    return Response.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
