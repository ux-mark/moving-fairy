import { NextRequest } from 'next/server'
import { getBoxes, createBox } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { BoxType, BoxSize } from '@/lib/constants'

export async function GET() {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  try {
    const boxes = await getBoxes(profile.id)
    return Response.json(boxes)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

interface CreateBoxBody {
  room_name: string
  box_type?: string
  size?: string
  item_label?: string
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })

  const body = (await req.json()) as CreateBoxBody
  if (!body.room_name) {
    return Response.json({ ok: false, error: 'room_name is required' }, { status: 400 })
  }

  try {
    const box = await createBox(
      profile.id,
      body.room_name,
      (body.box_type as BoxType) ?? BoxType.STANDARD,
      body.size ? (body.size as BoxSize) : undefined,
      body.item_label
    )
    return Response.json(box, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
