import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { BoxStatus, ShipmentStatus } from '@/lib/constants'
import { getCountryName } from '@/lib/countries'
import type { BiosecurityCategory, Country } from '@/lib/constants'
import type { Box, BoxItem, ItemAssessment, Shipment } from '@/types/database'

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function getAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function legLabel(origin: Country, destination: Country): string {
  return `${getCountryName(origin)} → ${getCountryName(destination)}`
}

/**
 * Idempotently ensure the right number of shipment legs exist for this user.
 *
 *   no onward_country     → 1 leg  (departure → arrival)
 *   has onward_country    → 2 legs (departure → arrival, arrival → onward)
 *
 * Existing rows are not modified — call `updateShipment` for renames or
 * status changes.
 */
export async function ensureShipmentsForProfile(userProfileId: string): Promise<Shipment[]> {
  const supabase = getAdminClient()

  const { data: profile, error: pErr } = await supabase
    .from('user_profile')
    .select('id, departure_country, arrival_country, onward_country')
    .eq('id', userProfileId)
    .single()

  if (pErr || !profile) throw new Error('User profile not found')

  const { data: existing, error: exErr } = await supabase
    .from('shipment')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('leg_order', { ascending: true })

  if (exErr) throw new Error(exErr.message)

  const existingByLeg = new Map<number, Shipment>(
    (existing ?? []).map((s) => [s.leg_order as number, s as Shipment]),
  )

  const toInsert: Array<Omit<Shipment, 'id' | 'created_at' | 'updated_at' | 'share_token' | 'target_date'>> = []

  if (!existingByLeg.has(1)) {
    toInsert.push({
      user_profile_id: userProfileId,
      leg_order: 1,
      label: legLabel(profile.departure_country as Country, profile.arrival_country as Country),
      origin_country: profile.departure_country as Country,
      destination_country: profile.arrival_country as Country,
      status: ShipmentStatus.PLANNED,
    })
  }

  if (profile.onward_country && !existingByLeg.has(2)) {
    toInsert.push({
      user_profile_id: userProfileId,
      leg_order: 2,
      label: legLabel(profile.arrival_country as Country, profile.onward_country as Country),
      origin_country: profile.arrival_country as Country,
      destination_country: profile.onward_country as Country,
      status: ShipmentStatus.PLANNED,
    })
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('shipment').insert(toInsert)
    if (insErr) throw new Error(insErr.message)
  }

  const { data: final, error: finalErr } = await supabase
    .from('shipment')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('leg_order', { ascending: true })

  if (finalErr) throw new Error(finalErr.message)
  return (final ?? []) as Shipment[]
}

export async function getShipmentsForUser(userProfileId: string): Promise<Shipment[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('shipment')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('leg_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Shipment[]
}

export async function getShipment(shipmentId: string): Promise<Shipment | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('shipment')
    .select('*')
    .eq('id', shipmentId)
    .single()
  if (error || !data) return null
  return data as Shipment
}

type ShipmentUpdatable = Partial<Pick<Shipment, 'label' | 'status' | 'target_date'>>

export async function updateShipment(
  shipmentId: string,
  changes: ShipmentUpdatable,
): Promise<Shipment> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('shipment')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', shipmentId)
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to update shipment')
  return data as Shipment
}

/** Create (or rotate) a 24-char hex share token for read-only public access. */
export async function generateShareToken(shipmentId: string): Promise<string> {
  const supabase = getAdminClient()
  const token = randomBytes(12).toString('hex') // 24 hex chars
  const { error } = await supabase
    .from('shipment')
    .update({ share_token: token, updated_at: new Date().toISOString() })
    .eq('id', shipmentId)
  if (error) throw new Error(error.message)
  return token
}

/**
 * Public, read-only lookup by share token. Uses anon client so a missing or
 * malformed token cannot be turned into an arbitrary read.
 */
// The shipment table has no anon SELECT policy — the share-link gate IS the
// unguessable 24-char token. Use the service-role client so we can find the
// row by token without RLS blocking it. Returning null when the token isn't
// known means a leaked-but-revoked token degrades safely.
export async function getShipmentByShareToken(token: string): Promise<Shipment | null> {
  if (!token || token.length < 16) return null
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('shipment')
    .select('*')
    .eq('share_token', token)
    .maybeSingle()
  if (error || !data) return null
  return data as Shipment
}

/** Attach a box to a shipment (or detach with `null`). Owner-scoped via service role. */
export async function assignBoxToShipment(
  boxId: string,
  shipmentId: string | null,
): Promise<Box> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box')
    .update({ shipment_id: shipmentId, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to assign box to shipment')
  return data as Box
}

// ─── Manifest ──────────────────────────────────────────────────────────────

export type ManifestBox = {
  box: Box
  items: Array<{
    box_item: BoxItem
    item_assessment: ItemAssessment | null
  }>
  cbm: number | null
  declared_value: number
}

export type ManifestTotals = {
  cbm: number
  declared_value: number
  currency: string
  biosecurity_counts: {
    declare: number
    high_risk: number
    prohibited: number
  }
  biosecurity_by_category: Partial<Record<BiosecurityCategory, number>>
}

export type Manifest = {
  shipment: Shipment
  boxes: ManifestBox[]
  totals: ManifestTotals
}

/**
 * Build an export-ready manifest for a shipment.
 *
 * - Walks shipment → boxes → box_items → item_assessment.
 * - `item_assessment.target_shipment_id` overrides the box's shipment:
 *     • items with a target set to a different shipment are *excluded* from
 *       this manifest;
 *     • items from boxes on other shipments whose target is *this* shipment
 *       are *included* (they appear under their original box label so the
 *       user still knows where the physical item lives).
 *     • null target = fall back to the box's shipment (legacy behaviour).
 * - For single-leg moves there is only one shipment, so the override is a
 *   no-op (every item lands on the same manifest regardless).
 * - Declared value uses each item's `estimated_replace_cost` as the best
 *   available proxy (we do not have an authoritative declared value field).
 * - Biosecurity flags are rolled up by severity and by category.
 */
export async function getManifest(shipmentId: string): Promise<Manifest> {
  const supabase = getAdminClient()

  const shipment = await getShipment(shipmentId)
  if (!shipment) throw new Error('Shipment not found')

  // Is this the default (first) leg for the user? Unassigned boxes — ones the
  // user packed without ever explicitly routing to a leg — fall back to the
  // default leg, mirroring the per-item `target_shipment_id` fallback below.
  // These four reads only need the shipment row, so fire them in one parallel
  // batch instead of four sequential round-trips:
  //   - the user's first leg (to decide the default-leg fallback),
  //   - boxes routed to this shipment,
  //   - unassigned packed boxes (default-leg fallback candidates),
  //   - assessments explicitly retargeted to this shipment.
  const [legRowsRes, boxesRes, unassignedRes, retargetedRes] = await Promise.all([
    supabase
      .from('shipment')
      .select('leg_order')
      .eq('user_profile_id', shipment.user_profile_id)
      .order('leg_order', { ascending: true })
      .limit(1),
    supabase
      .from('box')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: true }),
    // We can't know `isDefaultLeg` until legRows resolves, so fetch the
    // fallback candidates unconditionally here (a parallel query is free) and
    // discard them below on non-default legs.
    supabase
      .from('box')
      .select('*')
      .eq('user_profile_id', shipment.user_profile_id)
      .is('shipment_id', null)
      .in('status', [BoxStatus.PACKED, BoxStatus.SHIPPED, BoxStatus.ARRIVED])
      .order('created_at', { ascending: true }),
    supabase
      .from('item_assessment')
      .select('*')
      .eq('target_shipment_id', shipmentId),
  ])
  if (boxesRes.error) throw new Error(boxesRes.error.message)
  if (unassignedRes.error) throw new Error(unassignedRes.error.message)
  if (retargetedRes.error) throw new Error(retargetedRes.error.message)

  const firstLeg = legRowsRes.data?.[0]
  const defaultLegOrder = firstLeg ? (firstLeg.leg_order as number) : 1
  const isDefaultLeg = shipment.leg_order === defaultLegOrder

  // On the default leg, surface those unassigned packed/shipped/arrived boxes
  // (nothing auto-assigns a shipment when a box is packed); on other legs they
  // don't belong here.
  const unassignedBoxes: Box[] = isDefaultLeg ? ((unassignedRes.data ?? []) as Box[]) : []
  const boxList = [...((boxesRes.data ?? []) as Box[]), ...unassignedBoxes]

  const retargeted = (retargetedRes.data ?? []) as ItemAssessment[]

  // Find the box_items for those retargeted assessments so we can render
  // them with their physical box label intact.
  let retargetedBoxItems: BoxItem[] = []
  const retargetedAssessmentIds = retargeted.map((a) => a.id)
  if (retargetedAssessmentIds.length > 0) {
    const { data: riData, error: riErr } = await supabase
      .from('box_item')
      .select('*')
      .in('item_assessment_id', retargetedAssessmentIds)
    if (riErr) throw new Error(riErr.message)
    retargetedBoxItems = (riData ?? []) as BoxItem[]
  }

  // Boxes referenced by retargeted items that aren't already in `boxList`.
  const knownBoxIds = new Set(boxList.map((b) => b.id))
  const missingBoxIds = Array.from(
    new Set(retargetedBoxItems.map((bi) => bi.box_id).filter((id) => !knownBoxIds.has(id))),
  )
  let extraBoxes: Box[] = []
  if (missingBoxIds.length > 0) {
    const { data: ebData, error: ebErr } = await supabase
      .from('box')
      .select('*')
      .in('id', missingBoxIds)
    if (ebErr) throw new Error(ebErr.message)
    extraBoxes = (ebData ?? []) as Box[]
  }

  const allBoxes = [...boxList, ...extraBoxes]

  // Fetch all box_items for these boxes WITH their assessment embedded — one
  // round-trip instead of (box_items) then (item_assessment) separately.
  const boxIds = allBoxes.map((b) => b.id)
  let boxItems: BoxItem[] = []
  const assessments: Record<string, ItemAssessment> = {}
  if (boxIds.length > 0) {
    const { data: biData, error: biErr } = await supabase
      .from('box_item')
      .select('*, item_assessment(*)')
      .in('box_id', boxIds)
    if (biErr) throw new Error(biErr.message)
    type NestedBoxItem = BoxItem & { item_assessment: ItemAssessment | null }
    boxItems = ((biData ?? []) as NestedBoxItem[]).map(({ item_assessment, ...bi }) => {
      if (item_assessment) assessments[item_assessment.id] = item_assessment
      return bi as BoxItem
    })
  }

  // Apply the per-item target override. An item belongs on this shipment iff:
  //   - it has no assessment (handwritten/unassessed), AND its box is on
  //     this shipment (legacy default); OR
  //   - its assessment.target_shipment_id === shipmentId; OR
  //   - its assessment.target_shipment_id IS NULL, AND its box is on this
  //     shipment (legacy default).
  const belongsHere = (bi: BoxItem, box: Box): boolean => {
    const a = bi.item_assessment_id ? assessments[bi.item_assessment_id] : null
    const target = a?.target_shipment_id ?? null
    if (target) return target === shipmentId
    // Unassigned boxes (no shipment_id) fall back to the default leg.
    if (!box.shipment_id) return isDefaultLeg
    return box.shipment_id === shipmentId
  }

  const manifestBoxes: ManifestBox[] = allBoxes
    .map((box) => {
      const itemsForBox = boxItems.filter((i) => i.box_id === box.id && belongsHere(i, box))
      const items = itemsForBox.map((bi) => ({
        box_item: bi,
        item_assessment: bi.item_assessment_id ? assessments[bi.item_assessment_id] ?? null : null,
      }))
      const declared_value = items.reduce((sum, { item_assessment }) => {
        const cost = item_assessment?.estimated_replace_cost
        return sum + (typeof cost === 'number' ? cost : 0)
      }, 0)
      return { box, items, cbm: box.cbm ?? null, declared_value }
    })
    // Suppress boxes that ended up with no items on this leg — they would
    // otherwise render as empty rows in the itinerary.
    .filter((b) => b.items.length > 0)

  // Totals.
  const totalCbm = manifestBoxes.reduce((sum, b) => sum + (b.cbm ?? 0), 0)
  const totalDeclared = manifestBoxes.reduce((sum, b) => sum + b.declared_value, 0)

  // Pick the dominant replace_currency for the totals row — first non-null wins.
  let currency = 'EUR'
  for (const { item_assessment } of manifestBoxes.flatMap((b) => b.items)) {
    if (item_assessment?.replace_currency) {
      currency = item_assessment.replace_currency
      break
    }
  }

  const biosecurity_counts = { declare: 0, high_risk: 0, prohibited: 0 }
  const biosecurity_by_category: Partial<Record<BiosecurityCategory, number>> = {}

  for (const { item_assessment } of manifestBoxes.flatMap((b) => b.items)) {
    const flag = item_assessment?.biosecurity_flag
    if (flag === 'declare') biosecurity_counts.declare++
    else if (flag === 'high_risk') biosecurity_counts.high_risk++
    else if (flag === 'prohibited') biosecurity_counts.prohibited++

    const cat = item_assessment?.biosecurity_category
    if (cat && flag && flag !== 'none') {
      biosecurity_by_category[cat] = (biosecurity_by_category[cat] ?? 0) + 1
    }
  }

  return {
    shipment,
    boxes: manifestBoxes,
    totals: {
      cbm: Number(totalCbm.toFixed(4)),
      declared_value: Number(totalDeclared.toFixed(2)),
      currency,
      biosecurity_counts,
      biosecurity_by_category,
    },
  }
}
