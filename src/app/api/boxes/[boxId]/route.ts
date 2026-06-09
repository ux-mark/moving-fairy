import { NextRequest } from 'next/server'
import { getBoxRoomName, renameBoxRoom, setBoxBiosecurity, setBoxNumber, setRoomCode, updateBoxCbm, updateBoxLabel, updateBoxManifestUrl, updateBoxSize, updateBoxStatus } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { BoxSize, BoxStatus } from '@/lib/constants'

interface PatchBoxBody {
  status?: string
  cbm?: number
  label?: string
  room_name?: string
  room_code?: string
  box_number?: number
  size?: string
  manifest_image_url?: string
  is_biosecurity?: boolean
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
      const box = await updateBoxStatus(boxId, body.status as BoxStatus, profile.id)
      return Response.json(box)
    }

    if (body.cbm !== undefined) {
      const box = await updateBoxCbm(boxId, body.cbm, profile.id)
      return Response.json(box)
    }

    if (body.room_name !== undefined) {
      if (typeof body.room_name !== 'string' || !body.room_name.trim()) {
        return Response.json({ ok: false, error: 'Name cannot be empty' }, { status: 400 })
      }
      // Renaming re-derives the warehouse label suffix (WH05-K → WH05-A).
      const box = await renameBoxRoom(boxId, body.room_name.trim(), profile.id)
      return Response.json(box)
    }

    if (body.room_code !== undefined) {
      if (typeof body.room_code !== 'string') {
        return Response.json({ ok: false, error: 'Code must be a string' }, { status: 400 })
      }
      // Room-scoped: the code applies to every box in this box's room.
      const roomName = await getBoxRoomName(boxId, profile.id)
      try {
        const boxes = await setRoomCode(profile.id, roomName, body.room_code)
        return Response.json({ boxes })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid code'
        if (message === 'Box not found') throw err
        // Validation / collision errors are user-fixable → 400.
        return Response.json({ ok: false, error: message }, { status: 400 })
      }
    }

    if (body.box_number !== undefined) {
      if (typeof body.box_number !== 'number' || !Number.isInteger(body.box_number) || body.box_number < 1) {
        return Response.json({ ok: false, error: 'Box number must be a positive whole number' }, { status: 400 })
      }
      // Returns 1 box, or 2 when a swap happened (target + the box it traded with).
      const boxes = await setBoxNumber(boxId, body.box_number, profile.id)
      return Response.json({ boxes })
    }

    if (body.label !== undefined) {
      const trimmed = body.label.trim()
      if (!trimmed) {
        return Response.json({ ok: false, error: 'Label cannot be empty' }, { status: 400 })
      }
      const box = await updateBoxLabel(boxId, trimmed, profile.id)
      return Response.json(box)
    }

    if (body.size !== undefined) {
      const validSizes = Object.values(BoxSize) as string[]
      if (!validSizes.includes(body.size)) {
        return Response.json({ ok: false, error: 'Invalid box size' }, { status: 400 })
      }
      const box = await updateBoxSize(boxId, body.size as BoxSize, profile.id)
      return Response.json(box)
    }

    if (body.manifest_image_url !== undefined) {
      if (typeof body.manifest_image_url !== 'string' || !body.manifest_image_url.trim()) {
        return Response.json({ ok: false, error: 'manifest_image_url must be a non-empty string' }, { status: 400 })
      }
      const box = await updateBoxManifestUrl(boxId, body.manifest_image_url.trim(), profile.id)
      return Response.json(box)
    }

    if (body.is_biosecurity !== undefined) {
      if (typeof body.is_biosecurity !== 'boolean') {
        return Response.json({ ok: false, error: 'is_biosecurity must be a boolean' }, { status: 400 })
      }
      const box = await setBoxBiosecurity(boxId, body.is_biosecurity, profile.id)
      return Response.json(box)
    }

    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    if (message === 'Box not found') {
      return Response.json({ ok: false, error: message }, { status: 404 })
    }
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
