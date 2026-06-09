import { NextRequest } from 'next/server'
import { getManifest, getShipment } from '@/mcp'
import { getAuthenticatedProfile } from '@/lib/auth'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Escape if it contains comma, quote, or newline
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// GET /api/shipments/:id/export — CSV manifest download
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const ship = await getShipment(id)
  if (!ship || ship.user_profile_id !== profile.id) {
    return Response.json({ ok: false, error: 'Shipment not found' }, { status: 404 })
  }

  try {
    const manifest = await getManifest(id)

    const headers = [
      'box_label',
      'box_name',
      'item_name',
      'item_value',
      'currency',
      'biosecurity_flag',
      'biosecurity_category',
      'biosecurity_note',
    ]
    const lines: string[] = [headers.join(',')]

    for (const boxRow of manifest.boxes) {
      for (const { box_item, item_assessment } of boxRow.items) {
        const name =
          item_assessment?.item_name ?? box_item.item_name ?? ''
        const declared = item_assessment?.estimated_replace_cost ?? ''
        const currency = item_assessment?.replace_currency ?? ''
        const flag = item_assessment?.biosecurity_flag ?? ''
        const category = item_assessment?.biosecurity_category ?? ''
        const note = item_assessment?.biosecurity_note ?? ''
        lines.push(
          [
            csvEscape(boxRow.box.label),
            csvEscape(boxRow.box.room_name),
            csvEscape(name),
            csvEscape(declared),
            csvEscape(currency),
            csvEscape(flag),
            csvEscape(category),
            csvEscape(note),
          ].join(','),
        )
      }
    }

    const csv = lines.join('\n') + '\n'
    const filename = `manifest-${manifest.shipment.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${id}.csv`

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
