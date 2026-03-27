import { NextRequest } from 'next/server'
import { updateBoxCbm, updateBoxLabel, updateBoxManifestUrl, updateBoxSize, updateBoxStatus } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'
import { BoxSize, BoxStatus } from '@/lib/constants'

interface PatchBoxBody {
  status?: string
  cbm?: number
  label?: string
  size?: string
  manifest_image_url?: string
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

    if (body.label !== undefined) {
      const trimmed = body.label.trim()
      if (!trimmed) {
        return Response.json({ ok: false, error: 'Label cannot be empty' }, { status: 400 })
      }
      const box = await updateBoxLabel(boxId, trimmed)
      return Response.json(box)
    }

    if (body.size !== undefined) {
      const validSizes = Object.values(BoxSize) as string[]
      if (!validSizes.includes(body.size)) {
        return Response.json({ ok: false, error: 'Invalid box size' }, { status: 400 })
      }
      const box = await updateBoxSize(boxId, body.size as BoxSize)
      return Response.json(box)
    }

    if (body.manifest_image_url !== undefined) {
      if (typeof body.manifest_image_url !== 'string' || !body.manifest_image_url.trim()) {
        return Response.json({ ok: false, error: 'manifest_image_url must be a non-empty string' }, { status: 400 })
      }
      const box = await updateBoxManifestUrl(boxId, body.manifest_image_url.trim())
      return Response.json(box)
    }

    return Response.json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
