import { NextRequest } from 'next/server'
import { updateBoxCbm, updateBoxStatus } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { BoxStatus } from '@/lib/constants'

interface PatchBoxBody {
  status?: string
  cbm?: number
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ boxId: string }> }
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const { boxId } = await params
  const body = (await req.json()) as PatchBoxBody

  try {
    if (body.status !== undefined) {
      const box = await updateBoxStatus(boxId, body.status as BoxStatus)
      return Response.json(box)
    }

    if (body.cbm !== undefined) {
      const box = await updateBoxCbm(boxId, body.cbm)
      return Response.json(box)
    }

    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
