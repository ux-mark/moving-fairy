import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { BOX_SIZE_CBM, BoxScanStatus, BoxSize, BoxStatus, BoxType, ItemSource, ProcessingStatus, Verdict, computeBoxLabel, roomCode, roomFamily, uniqueRoomCode } from '@/lib/constants'
import type { Box, BoxItem, BoxScan, ItemAssessment, ItemConversation, ItemConversationMessage, UserProfile } from '@/types/database'

// ─── Supabase client helpers ───────────────────────────────────────────────

/**
 * Anon client using @supabase/ssr — for row-level operations where we honour
 * auth. For API routes that run outside a full Next.js request context (no
 * cookies needed) we can use the service-role client below instead.
 *
 * In practice the MCP tools are called from API route handlers, so we use the
 * service-role client for all DB operations for simplicity.
 */
function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── UserProfile ───────────────────────────────────────────────────────────

export async function updateUserProfile(
  profileId: string,
  changes: Partial<Pick<UserProfile, 'departure_country' | 'arrival_country' | 'onward_country' | 'onward_timeline' | 'equipment' | 'anthropic_api_key' | 'assessment_guidance'>>
): Promise<UserProfile> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('user_profile')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update profile')
  return data as UserProfile
}

export async function getUserProfile(userProfileId: string): Promise<UserProfile | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', userProfileId)
    .single()
  if (error || !data) return null
  return data as UserProfile
}

export async function createUserProfile(data: {
  auth_user_id: string
  departure_country: UserProfile['departure_country']
  arrival_country: UserProfile['arrival_country']
  onward_country?: UserProfile['onward_country']
  onward_timeline?: UserProfile['onward_timeline']
  equipment?: UserProfile['equipment']
  anthropic_api_key?: string | null
}): Promise<UserProfile> {
  const supabase = getAdminClient()
  const { data: profile, error } = await supabase
    .from('user_profile')
    .insert({
      auth_user_id: data.auth_user_id,
      departure_country: data.departure_country,
      arrival_country: data.arrival_country,
      onward_country: data.onward_country ?? null,
      onward_timeline: data.onward_timeline ?? null,
      equipment: data.equipment ?? {},
      anthropic_api_key: data.anthropic_api_key ?? null,
    })
    .select()
    .single()

  if (error || !profile) throw new Error(error?.message ?? 'Failed to create user profile')
  return profile as UserProfile
}

export async function getProfileByAuthUser(authUserId: string): Promise<UserProfile | null> {
  const supabase = getAdminClient()
  const { data: profile, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (error || !profile) return null
  return profile as UserProfile
}

// ─── ItemAssessment ────────────────────────────────────────────────────────

type ItemAssessmentInsert = {
  user_profile_id: string
  item_name: string
  item_description: string | null
  verdict: ItemAssessment['verdict']
  advice_text: string | null
  image_url: string | null
  voltage_compatible: boolean | null
  needs_transformer: boolean | null
  estimated_ship_cost: number | null
  currency: string | null
  estimated_replace_cost: number | null
  replace_currency: string | null
  user_confirmed: boolean
  processing_status: ProcessingStatus
  confidence: number | null
  needs_clarification: boolean
  source: ItemSource
}

export async function saveItemAssessment(data: {
  user_profile_id: string
  item_name: string
  verdict: ItemAssessment['verdict']
  advice_text?: string | null
  item_description?: string | null
  image_url?: string | null
  voltage_compatible?: boolean | null
  needs_transformer?: boolean | null
  estimated_ship_cost?: number | null
  currency?: string | null
  estimated_replace_cost?: number | null
  replace_currency?: string | null
  user_confirmed?: boolean
  processing_status?: ProcessingStatus
  confidence?: number | null
  needs_clarification?: boolean
  source?: ItemSource
}): Promise<ItemAssessment> {
  const supabase = getAdminClient()
  const verdict = data.verdict

  // Enforce lightweight vs full record rule
  const isLightweight =
    verdict === Verdict.SELL || verdict === Verdict.DONATE || verdict === Verdict.DISCARD

  // In the item-centric model every POST /api/items creates a distinct record.
  // Name-based dedup is removed — users may have multiple items with the same name.

  const payload: ItemAssessmentInsert = {
    user_profile_id: data.user_profile_id,
    item_name: data.item_name,
    item_description: isLightweight ? null : (data.item_description ?? null),
    verdict: data.verdict,
    advice_text: data.advice_text ?? null,
    image_url: isLightweight ? null : (data.image_url ?? null),
    voltage_compatible: isLightweight ? null : (data.voltage_compatible ?? null),
    needs_transformer: isLightweight ? null : (data.needs_transformer ?? null),
    estimated_ship_cost: isLightweight ? null : (data.estimated_ship_cost ?? null),
    currency: isLightweight ? null : (data.currency ?? null),
    estimated_replace_cost: isLightweight ? null : (data.estimated_replace_cost ?? null),
    replace_currency: isLightweight ? null : (data.replace_currency ?? null),
    user_confirmed: data.user_confirmed ?? false,
    processing_status: data.processing_status ?? ProcessingStatus.COMPLETED,
    confidence: data.confidence ?? null,
    needs_clarification: data.needs_clarification ?? false,
    source: data.source ?? ItemSource.MANUAL,
  }

  const { data: record, error } = await supabase
    .from('item_assessment')
    .insert(payload)
    .select()
    .single()

  if (error || !record) throw new Error(error?.message ?? 'Failed to save item assessment')
  return record as ItemAssessment
}

// Narrowed type for updatable fields — prevents accidental mutation of
// system-managed fields like id, user_profile_id, created_at.
type ItemAssessmentUpdatable = Partial<Pick<ItemAssessment,
  | 'item_name'
  | 'verdict'
  | 'advice_text'
  | 'item_description'
  | 'image_url'
  | 'images'
  | 'voltage_compatible'
  | 'needs_transformer'
  | 'estimated_ship_cost'
  | 'currency'
  | 'estimated_replace_cost'
  | 'replace_currency'
  | 'user_confirmed'
  | 'user_confirmed_biosecurity'
  | 'biosecurity_flag'
  | 'biosecurity_category'
  | 'biosecurity_note'
  | 'processing_status'
  | 'confidence'
  | 'needs_clarification'
  | 'target_shipment_id'
  | 'category'
  | 'care'
>>

export async function updateItemAssessment(
  assessmentId: string,
  changes: ItemAssessmentUpdatable,
  userProfileId?: string
): Promise<ItemAssessment> {
  const supabase = getAdminClient()

  let query = supabase
    .from('item_assessment')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', assessmentId)

  if (userProfileId) {
    query = query.eq('user_profile_id', userProfileId)
  }

  const { data: record, error } = await query.select().single()

  if (error || !record) throw new Error(error?.message ?? 'Failed to update item assessment')
  return record as ItemAssessment
}

export async function getItemAssessment(
  assessmentId: string,
  userProfileId: string
): Promise<ItemAssessment | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('item_assessment')
    .select('*')
    .eq('id', assessmentId)
    .eq('user_profile_id', userProfileId)
    .single()
  if (error || !data) return null
  return data as ItemAssessment
}

export async function getItemAssessments(
  userProfileId: string,
  filters?: { verdict?: ItemAssessment['verdict']; user_confirmed?: boolean; processing_status?: ProcessingStatus }
): Promise<ItemAssessment[]> {
  const supabase = getAdminClient()
  let query = supabase
    .from('item_assessment')
    .select('*')
    .eq('user_profile_id', userProfileId)

  if (filters?.verdict) query = query.eq('verdict', filters.verdict)
  if (filters?.processing_status) query = query.eq('processing_status', filters.processing_status)
  if (filters?.user_confirmed !== undefined)
    query = query.eq('user_confirmed', filters.user_confirmed)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ItemAssessment[]
}

// ─── Delete ItemAssessment ──────────────────────────────────────────────────

/**
 * Deletes an item assessment and all associated data:
 * 1. Verifies the assessment exists and belongs to the given user profile
 * 2. Deletes any box_item rows referencing this assessment
 * 3. Deletes the item_assessment row itself
 * 4. If the assessment had an image_url, attempts to delete from Supabase Storage
 */
export async function deleteItemAssessment(
  assessmentId: string,
  userProfileId: string
): Promise<void> {
  const supabase = getAdminClient()

  // 1. Fetch and verify ownership
  const { data: assessment, error: fetchErr } = await supabase
    .from('item_assessment')
    .select('id, user_profile_id, image_url')
    .eq('id', assessmentId)
    .single()

  if (fetchErr || !assessment) {
    throw new Error('Item assessment not found')
  }

  if (assessment.user_profile_id !== userProfileId) {
    throw new Error('Not authorised to delete this item')
  }

  // 2. Delete associated box_item rows
  const { error: boxItemErr } = await supabase
    .from('box_item')
    .delete()
    .eq('item_assessment_id', assessmentId)

  if (boxItemErr) throw new Error(boxItemErr.message)

  // 3. Delete the item_assessment row
  const { error: deleteErr } = await supabase
    .from('item_assessment')
    .delete()
    .eq('id', assessmentId)

  if (deleteErr) throw new Error(deleteErr.message)

  // 4. Delete image from Supabase Storage if present
  if (assessment.image_url) {
    try {
      // URL format: https://<project>.supabase.co/storage/v1/object/public/item-images/{profile_id}/{uuid}.webp
      const url = new URL(assessment.image_url as string)
      // Extract path after /item-images/ — e.g. "{profile_id}/{uuid}.webp"
      const match = url.pathname.match(/\/item-images\/(.+)$/)
      if (match?.[1]) {
        await supabase.storage.from('item-images').remove([match[1]])
      }
    } catch {
      // Non-fatal: image deletion failure should not block the response
    }
  }
}

// ─── Cost summary ──────────────────────────────────────────────────────────

export async function getCostSummary(userProfileId: string): Promise<{
  counts_by_verdict: Record<string, number>
  total_estimated_ship_cost: number
  ship_currency: string
  total_estimated_replace_cost: number
  replace_currency: string
}> {
  const supabase = getAdminClient()

  // Get departure and arrival countries to determine authoritative currencies
  const { data: profile } = await supabase
    .from('user_profile')
    .select('departure_country, arrival_country')
    .eq('id', userProfileId)
    .single()

  const currencyMap: Record<string, string> = {
    US: 'USD', IE: 'EUR', AU: 'AUD', CA: 'CAD', UK: 'GBP', NZ: 'NZD',
  }
  const shipCurrency = profile?.departure_country
    ? currencyMap[profile.departure_country.toUpperCase()] ?? 'USD'
    : 'USD'
  const replaceCurrency = profile?.arrival_country
    ? currencyMap[profile.arrival_country.toUpperCase()] ?? 'EUR'
    : 'EUR'

  const { data, error } = await supabase
    .from('item_assessment')
    .select('verdict, estimated_ship_cost, estimated_replace_cost')
    .eq('user_profile_id', userProfileId)
    .eq('processing_status', 'completed')

  if (error) throw new Error(error.message)

  const records = data ?? []
  const counts_by_verdict: Record<string, number> = {}
  let total_estimated_ship_cost = 0
  let total_estimated_replace_cost = 0

  for (const r of records) {
    counts_by_verdict[r.verdict] = (counts_by_verdict[r.verdict] ?? 0) + 1
    if (r.estimated_ship_cost) {
      total_estimated_ship_cost += r.estimated_ship_cost
    }
    if (r.estimated_replace_cost) {
      total_estimated_replace_cost += r.estimated_replace_cost
    }
  }

  return {
    counts_by_verdict,
    total_estimated_ship_cost,
    ship_currency: shipCurrency,
    total_estimated_replace_cost,
    replace_currency: replaceCurrency,
  }
}

/**
 * Ids of items that have never been successfully assessed (pending or failed) —
 * i.e. the inventory items still missing a value. Drives the bulk "value my
 * inventory" action. Completed items are left alone so a re-value never clobbers
 * a verdict the owner already confirmed.
 */
export async function getUnassessedItemIds(userProfileId: string): Promise<string[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('item_assessment')
    .select('id')
    .eq('user_profile_id', userProfileId)
    .in('processing_status', [ProcessingStatus.PENDING, ProcessingStatus.FAILED])
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
}

// ─── Box ───────────────────────────────────────────────────────────────────

/**
 * Ownership guard for box mutations. The MCP layer uses the service-role client
 * (bypasses RLS), so ownership must be enforced in code. Throws a clear error
 * when the box is missing or owned by another user — callers map this to 404.
 */
async function assertBoxOwner(boxId: string, userProfileId: string): Promise<void> {
  const supabase = getAdminClient()
  const { data: box, error } = await supabase
    .from('box')
    .select('user_profile_id')
    .eq('id', boxId)
    .single()

  if (error || !box || box.user_profile_id !== userProfileId) {
    throw new Error('Box not found')
  }
}

// computeBoxLabel lives in @/lib/constants (pure + client-safe); re-export the
// imported binding so existing `@/mcp` / `./tools` importers keep working.
export { computeBoxLabel }

/**
 * The stored code for a box, resilient to a NULL `room_code` on legacy rows:
 * luggage/carryon are fixed L/C, standard falls back to roomCode(room_name),
 * single_item has no code.
 */
function effectiveRoomCode(box: { box_type: BoxType; room_name: string; room_code: string | null }): string | null {
  if (box.room_code) return box.room_code
  switch (box.box_type) {
    case BoxType.CHECKED_LUGGAGE:
      return 'L'
    case BoxType.CARRYON:
      return 'C'
    case BoxType.STANDARD:
      return roomCode(box.room_name)
    case BoxType.SINGLE_ITEM:
      return null
  }
}

/**
 * Build this user's room-family → code map (from standard boxes that already
 * carry a room_code) plus the set of codes in use. Codes group by family — the
 * first word of the room name (see roomFamily) — so name variants like
 * "Bedroom 1"/"Bedroom 2" share one code. Used to reuse a family's existing
 * code or resolve a fresh collision-free one for a new/renamed room.
 */
async function loadRoomCodeMap(
  supabase: ReturnType<typeof getAdminClient>,
  userProfileId: string
): Promise<{ byFamily: Map<string, string>; used: Set<string> }> {
  const { data, error } = await supabase
    .from('box')
    .select('room_name, room_code, box_type')
    .eq('user_profile_id', userProfileId)
    .eq('box_type', BoxType.STANDARD)
  if (error) throw new Error(error.message)

  const byFamily = new Map<string, string>()
  const used = new Set<string>()
  for (const b of data ?? []) {
    const code = (b.room_code as string | null) ?? roomCode(b.room_name as string)
    byFamily.set(roomFamily(b.room_name as string), code)
    used.add(code)
  }
  return { byFamily, used }
}

export async function createBox(
  userProfileId: string,
  roomName: string,
  boxType: BoxType = BoxType.STANDARD,
  size?: BoxSize,
  itemLabel?: string
): Promise<Box> {
  const supabase = getAdminClient()

  // Box numbers are a single per-user sequence, never reused — the next box is
  // simply max(box_number) + 1 across all of this user's boxes, regardless of
  // room or type. The room only decides the label suffix (WH<nn>-<letter>).
  const { data: existing, error: countErr } = await supabase
    .from('box')
    .select('box_number')
    .eq('user_profile_id', userProfileId)

  if (countErr) throw new Error(countErr.message)

  const maxNumber = (existing ?? []).reduce(
    (max, b) => Math.max(max, (b.box_number as number) ?? 0),
    0
  )

  const boxNumber = maxNumber + 1

  // Resolve this box's room code. Only standard boxes carry a room-code suffix.
  // Single-item boxes use a bare warehouse number (WH<nn>); luggage/carryon use
  // a descriptive name with no warehouse code at all — so all of them have a
  // null room_code.
  let roomCodeValue: string | null
  switch (boxType) {
    case BoxType.CHECKED_LUGGAGE:
    case BoxType.CARRYON:
    case BoxType.SINGLE_ITEM:
      roomCodeValue = null
      break
    case BoxType.STANDARD: {
      const { byFamily, used } = await loadRoomCodeMap(supabase, userProfileId)
      roomCodeValue = byFamily.get(roomFamily(roomName)) ?? uniqueRoomCode(roomName, used)
      break
    }
  }

  const label = computeBoxLabel(boxType, roomName, boxNumber, itemLabel, roomCodeValue ?? undefined)

  // CBM from size for standard/checked_luggage boxes
  const cbm = size ? BOX_SIZE_CBM[size] : null

  const { data: box, error } = await supabase
    .from('box')
    .insert({
      user_profile_id: userProfileId,
      box_type: boxType,
      size: size ?? null,
      cbm,
      room_name: roomName,
      box_number: boxNumber,
      room_code: roomCodeValue,
      label,
      status: BoxStatus.PACKING,
    })
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to create box')
  return box as Box
}

export async function addItemToBox(
  boxId: string,
  opts: { itemAssessmentId?: string; itemName?: string; isDraft?: boolean },
  userProfileId?: string
): Promise<BoxItem> {
  const supabase = getAdminClient()

  if (userProfileId) await assertBoxOwner(boxId, userProfileId)

  let itemName = opts.itemName ?? ''
  let fromAssessment = false

  if (opts.itemAssessmentId) {
    // Validate verdict gate — also fetch item_name for the insert payload
    const { data: assessment, error: aErr } = await supabase
      .from('item_assessment')
      .select('verdict, item_name')
      .eq('id', opts.itemAssessmentId)
      .single()

    if (aErr || !assessment) throw new Error('Item assessment not found')

    const blocked: string[] = [Verdict.SELL, Verdict.DONATE, Verdict.DISCARD, Verdict.REVISIT]
    if (blocked.includes(assessment.verdict)) {
      throw new Error(
        `Cannot add item with verdict ${assessment.verdict} to a box. Only SHIP or CARRY items are allowed.`
      )
    }

    fromAssessment = true
    itemName = assessment.item_name

    // Check if this assessed item is already in a box (partial unique index)
    const { data: existing } = await supabase
      .from('box_item')
      .select('*')
      .eq('item_assessment_id', opts.itemAssessmentId)
      .limit(1)
      .single()

    if (existing) {
      if (existing.box_id === boxId) {
        // Already in this box — return existing record (idempotent)
        return existing as BoxItem
      }
      // In a different box — move it: delete from old box, then insert into new
      await supabase
        .from('box_item')
        .delete()
        .eq('id', existing.id)
    }
  }

  const payload = {
    box_id: boxId,
    item_assessment_id: opts.itemAssessmentId ?? null,
    item_name: itemName,
    quantity: 1,
    from_handwritten_list: false,
    needs_assessment: !fromAssessment,
    is_draft: opts.isDraft ?? false,
  }

  const { data: boxItem, error } = await supabase
    .from('box_item')
    .insert(payload)
    .select()
    .single()

  if (error || !boxItem) throw new Error(error?.message ?? 'Failed to add item to box')
  return boxItem as BoxItem
}

/**
 * The items in a box together with their embedded assessments — one round-trip.
 * Used to refresh a box's contents on the client after a sticker scan adds
 * drafts. Includes drafts (is_draft true); callers filter as needed.
 */
export async function getBoxItemsDetailed(
  boxId: string,
  userProfileId?: string
): Promise<{ items: BoxItem[]; assessments: ItemAssessment[] }> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)

  const { data, error } = await supabase
    .from('box_item')
    .select('*, item_assessment(*)')
    .eq('box_id', boxId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  type NestedBoxItem = BoxItem & { item_assessment: ItemAssessment | null }
  const assessments: ItemAssessment[] = []
  const items = ((data ?? []) as NestedBoxItem[]).map(({ item_assessment, ...bi }) => {
    if (item_assessment) assessments.push(item_assessment)
    return bi as BoxItem
  })
  return { items, assessments }
}

export async function removeItemFromBox(
  boxId: string,
  boxItemId: string,
  userProfileId?: string
): Promise<void> {
  const supabase = getAdminClient()

  if (userProfileId) await assertBoxOwner(boxId, userProfileId)

  const { error } = await supabase
    .from('box_item')
    .delete()
    .eq('id', boxItemId)
    .eq('box_id', boxId)

  if (error) throw new Error(error.message)
}

export async function getBox(boxId: string): Promise<Box & { items: BoxItem[] }> {
  const supabase = getAdminClient()
  const { data: box, error: boxErr } = await supabase
    .from('box')
    .select('*')
    .eq('id', boxId)
    .single()

  if (boxErr || !box) throw new Error(boxErr?.message ?? 'Box not found')

  const { data: items, error: itemsErr } = await supabase
    .from('box_item')
    .select('*')
    .eq('box_id', boxId)
    .order('created_at', { ascending: true })

  if (itemsErr) throw new Error(itemsErr.message)

  const rawItems = (items ?? []) as BoxItem[]

  // Resolve canonical names for assessed items from item_assessment.item_name
  const assessmentIds = rawItems
    .map((i) => i.item_assessment_id)
    .filter((id): id is string => id !== null)

  let assessmentNames: Record<string, string> = {}
  if (assessmentIds.length > 0) {
    const { data: assessments } = await supabase
      .from('item_assessment')
      .select('id, item_name')
      .in('id', assessmentIds)
    if (assessments) {
      assessmentNames = Object.fromEntries(assessments.map((a) => [a.id, a.item_name]))
    }
  }

  const resolvedItems = rawItems.map((item) => ({
    ...item,
    // For assessed items, resolve the canonical name from item_assessment.
    // Fall back to box_item.item_name for unassessed items (handwritten lists).
    item_name: item.item_assessment_id
      ? (assessmentNames[item.item_assessment_id] ?? item.item_name ?? '[Item name unavailable]')
      : item.item_name,
  }))

  return { ...(box as Box), items: resolvedItems }
}

export async function getBoxes(userProfileId: string): Promise<(Box & { items: BoxItem[] })[]> {
  const supabase = getAdminClient()
  // Single round-trip: boxes + their box_items + each item's canonical name,
  // via PostgREST embeds. Replaces the old N+1 (one getBox() = 3 queries per
  // box, so ~40 round-trips for a 13-box account → 1 here).
  const { data, error } = await supabase
    .from('box')
    .select('*, box_item(*, item_assessment(item_name))')
    .eq('user_profile_id', userProfileId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  type NestedItem = BoxItem & { item_assessment: { item_name: string | null } | null }
  type NestedBox = Box & { box_item: NestedItem[] }

  return ((data ?? []) as NestedBox[]).map((row) => {
    const { box_item, ...box } = row
    const items: BoxItem[] = [...(box_item ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ item_assessment, ...bi }) => ({
        ...bi,
        // Resolve canonical name from item_assessment for assessed items; fall
        // back to box_item.item_name for unassessed (handwritten) entries.
        item_name: bi.item_assessment_id
          ? (item_assessment?.item_name ?? bi.item_name ?? '[Item name unavailable]')
          : bi.item_name,
      }))
    return { ...(box as Box), items }
  })
}

export async function saveBoxManifestPhoto(boxId: string, imageUrl: string): Promise<Box> {
  const supabase = getAdminClient()
  const { data: box, error } = await supabase
    .from('box')
    .update({ manifest_image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to save manifest photo')
  return box as Box
}

export async function getBoxManifest(
  boxId: string
): Promise<{ label: string; items: { item_name: string | null; quantity: number }[] }> {
  const { label, items } = await getBox(boxId)
  return {
    label,
    items: items.map((i) => ({ item_name: i.item_name, quantity: i.quantity })),
  }
}

export async function setAllBoxesPacked(userProfileId: string): Promise<number> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box')
    .update({ status: BoxStatus.PACKED, updated_at: new Date().toISOString() })
    .eq('user_profile_id', userProfileId)
    .eq('status', BoxStatus.PACKING)
    .select('id')

  if (error) throw new Error(error.message)
  return (data ?? []).length
}

export async function updateBoxStatus(
  boxId: string,
  status: BoxStatus,
  userProfileId?: string
): Promise<Box> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)
  const { data: box, error } = await supabase
    .from('box')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box status')
  return box as Box
}

export async function updateBoxCbm(
  boxId: string,
  cbm: number,
  userProfileId?: string
): Promise<Box> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)
  const { data: box, error } = await supabase
    .from('box')
    .update({ cbm, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box CBM')
  return box as Box
}

export async function updateBoxLabel(
  boxId: string,
  label: string,
  userProfileId?: string
): Promise<Box> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)
  const { data: box, error } = await supabase
    .from('box')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box label')
  return box as Box
}

/**
 * Rename a box's room (its human name) and keep the warehouse `label` in sync.
 *
 * The label encodes the room as a single letter — `WH<code><nn>` — so renaming
 * may change that letter. Behaviour by box type:
 *   - single_item: the label *is* the name → update both.
 *   - checked_luggage / carryon: the code is fixed (L / C), independent of the
 *     name → update the name only.
 *   - standard: derive the code from the new name. If the code is unchanged the
 *     label stays put; if it changes, take the next free number for the new code
 *     (mirrors createBox's per-code numbering) and recompute the label. This can
 *     leave a gap in the old code's numbering, which is fine — warehouse numbers
 *     tolerate gaps, and renumbering siblings would surprise the user by changing
 *     labels they didn't touch.
 */
export async function renameBoxRoom(
  boxId: string,
  newRoomName: string,
  userProfileId?: string
): Promise<Box> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)

  const trimmed = newRoomName.trim()
  if (!trimmed) throw new Error('Room name cannot be empty')

  const { data: current, error: loadErr } = await supabase
    .from('box')
    .select('user_profile_id, box_type, box_number, room_name')
    .eq('id', boxId)
    .single()
  if (loadErr || !current) throw new Error(loadErr?.message ?? 'Box not found')

  const boxType = current.box_type as BoxType

  // Resolve the destination room's code. Reuse the target room's existing code
  // if it already exists for this user, else resolve a fresh collision-free one.
  // Exclude this box's own current room from the used-set so renaming back and
  // forth doesn't needlessly inflate the code. Luggage/carryon keep their fixed
  // L/C code; single_item has none.
  let newCode: string | null
  if (boxType === BoxType.STANDARD) {
    const { byFamily, used } = await loadRoomCodeMap(supabase, current.user_profile_id as string)
    const oldFamily = roomFamily(current.room_name as string)
    const newFamily = roomFamily(trimmed)
    const existingForTarget = byFamily.get(newFamily)
    if (existingForTarget) {
      newCode = existingForTarget
    } else {
      // Free the old family's code if this is the only standard box in it, so a
      // rename can reclaim that letter for the new room.
      const oldCode = byFamily.get(oldFamily)
      const usedForResolve = new Set(used)
      if (oldCode && oldFamily !== newFamily) {
        const { data: familyBoxes } = await supabase
          .from('box')
          .select('room_name')
          .eq('user_profile_id', current.user_profile_id as string)
          .eq('box_type', BoxType.STANDARD)
        const count = (familyBoxes ?? []).filter(
          (b) => roomFamily(b.room_name as string) === oldFamily
        ).length
        if (count <= 1) usedForResolve.delete(oldCode)
      }
      newCode = uniqueRoomCode(trimmed, usedForResolve)
    }
  } else {
    // Single-item, checked-luggage and carry-on boxes have no room-code suffix.
    newCode = null
  }

  // The number is the box's permanent ID — renaming only re-derives the label
  // suffix (WH05-K → WH05-A), or the descriptive label for single-item boxes.
  const label = computeBoxLabel(boxType, trimmed, current.box_number as number, trimmed, newCode ?? undefined)

  const { data: box, error } = await supabase
    .from('box')
    .update({ room_name: trimmed, room_code: newCode, label, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to rename box')
  return box as Box
}

/**
 * Set the code for a whole room family (every standard box whose room name
 * shares the first word of `roomName` for the user — see roomFamily). The code
 * is family-scoped, so editing it relabels all of the family's standard boxes
 * ("Bedroom 1"/"Bedroom 2" together) and new boxes in the family inherit it.
 *
 * Validates: trim; 1–4 chars; letters/digits only; non-blank; and rejects a
 * code already used by a DIFFERENT family of this user's (collision → Error the
 * route maps to 400). Owner-guarded via the passed `userProfileId`.
 *
 * Returns every box in the family that was updated so the client can relabel
 * them together.
 */
export async function setRoomCode(
  userProfileId: string,
  roomName: string,
  newCode: string
): Promise<Box[]> {
  const supabase = getAdminClient()

  const code = (newCode ?? '').trim()
  if (!code) throw new Error('Code cannot be empty')
  if (code.length > 4) throw new Error('Code must be 1–4 characters')
  if (!/^[A-Za-z0-9]+$/.test(code)) throw new Error('Code may only contain letters and digits')

  const family = roomFamily(roomName)

  // Fetch the user's standard boxes once: drives both the collision check and
  // the family fan-out below.
  const { data: others, error: othersErr } = await supabase
    .from('box')
    .select('id, box_type, room_name, room_code, box_number')
    .eq('user_profile_id', userProfileId)
    .eq('box_type', BoxType.STANDARD)
  if (othersErr) throw new Error(othersErr.message)

  // Collision check: reject if a DIFFERENT family (same user) already uses this
  // code, case-insensitively (codes are short identifiers — treat AB and ab as
  // one).
  for (const b of others ?? []) {
    if (roomFamily(b.room_name as string) === family) continue
    const existing = (b.room_code as string | null) ?? roomCode(b.room_name as string)
    if (existing.toLowerCase() === code.toLowerCase()) {
      throw new Error(`Code "${code}" is already used by ${b.room_name}`)
    }
  }

  // Every standard box in this family, relabelled from its own number.
  const roomBoxes = (others ?? []).filter(
    (b) => roomFamily(b.room_name as string) === family
  )
  if (roomBoxes.length === 0) throw new Error('Room not found')

  const stamp = new Date().toISOString()
  const updated: Box[] = []
  for (const b of roomBoxes) {
    const label = computeBoxLabel(
      b.box_type as BoxType,
      b.room_name as string,
      b.box_number as number,
      b.room_name as string,
      code
    )
    const { data: box, error } = await supabase
      .from('box')
      .update({ room_code: code, label, updated_at: stamp })
      .eq('id', b.id)
      .select()
      .single()
    if (error || !box) throw new Error(error?.message ?? 'Failed to set room code')
    updated.push(box as Box)
  }

  return updated
}

/**
 * Resolve a box's `room_name`, owner-guarded. Used by the PATCH route to scope
 * a room-code edit (which is room-wide) from a single box id.
 */
export async function getBoxRoomName(boxId: string, userProfileId: string): Promise<string> {
  const supabase = getAdminClient()
  const { data: box, error } = await supabase
    .from('box')
    .select('user_profile_id, room_name')
    .eq('id', boxId)
    .single()
  if (error || !box || box.user_profile_id !== userProfileId) throw new Error('Box not found')
  return box.room_name as string
}

/**
 * Set a box's number (manual renumber). Numbers are a per-user global sequence
 * and unique, so if the target number is already taken the two boxes **swap**
 * numbers. The caller (UI) is expected to confirm the swap with the user first.
 *
 * Returns every box whose number/label changed (1 or 2) so the client can
 * update them together. The swap parks the moving box on a temporary negative
 * number to avoid tripping the (user, box_number) unique constraint mid-swap.
 */
export async function setBoxNumber(
  boxId: string,
  newNumber: number,
  userProfileId?: string
): Promise<Box[]> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)

  if (!Number.isInteger(newNumber) || newNumber < 1) {
    throw new Error('Box number must be a positive whole number')
  }

  const { data: target, error: loadErr } = await supabase
    .from('box')
    .select('id, user_profile_id, box_type, room_name, room_code, box_number, label')
    .eq('id', boxId)
    .single()
  if (loadErr || !target) throw new Error(loadErr?.message ?? 'Box not found')

  const oldNumber = target.box_number as number
  if (oldNumber === newNumber) return [target as Box]

  // Relabel from the box's stored room_code (fall back to roomCode if null) so
  // we never re-derive a collision-resolved code from the name.
  const relabel = (b: { box_type: BoxType; room_name: string; room_code: string | null }, n: number) =>
    computeBoxLabel(b.box_type as BoxType, b.room_name, n, b.room_name, effectiveRoomCode(b) ?? undefined)

  // Is another of this user's boxes already on the target number?
  const { data: clashRows, error: clashErr } = await supabase
    .from('box')
    .select('id, box_type, room_name, room_code, box_number')
    .eq('user_profile_id', target.user_profile_id)
    .eq('box_number', newNumber)
    .neq('id', boxId)
  if (clashErr) throw new Error(clashErr.message)
  const clash = clashRows?.[0]

  if (!clash) {
    const { data: box, error } = await supabase
      .from('box')
      .update({
        box_number: newNumber,
        label: relabel(target, newNumber),
        updated_at: new Date().toISOString(),
      })
      .eq('id', boxId)
      .select()
      .single()
    if (error || !box) throw new Error(error?.message ?? 'Failed to renumber box')
    return [box as Box]
  }

  // Swap: park target on a temp negative number, move the clashing box onto the
  // target's old number, then move target onto the requested number.
  const stamp = new Date().toISOString()
  const park = await supabase.from('box').update({ box_number: -1, updated_at: stamp }).eq('id', boxId)
  if (park.error) throw new Error(park.error.message)

  const moveClash = await supabase
    .from('box')
    .update({ box_number: oldNumber, label: relabel(clash, oldNumber), updated_at: stamp })
    .eq('id', clash.id)
    .select()
    .single()
  if (moveClash.error || !moveClash.data) throw new Error(moveClash.error?.message ?? 'Renumber swap failed')

  const moveTarget = await supabase
    .from('box')
    .update({ box_number: newNumber, label: relabel(target, newNumber), updated_at: stamp })
    .eq('id', boxId)
    .select()
    .single()
  if (moveTarget.error || !moveTarget.data) throw new Error(moveTarget.error?.message ?? 'Renumber swap failed')

  return [moveTarget.data as Box, moveClash.data as Box]
}

export async function updateBoxSize(
  boxId: string,
  size: BoxSize,
  userProfileId?: string
): Promise<Box> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)
  const cbm = BOX_SIZE_CBM[size]
  const { data: box, error } = await supabase
    .from('box')
    .update({ size, cbm, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box size')
  return box as Box
}

export async function updateBoxManifestUrl(
  boxId: string,
  manifestImageUrl: string,
  userProfileId?: string
): Promise<Box> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)
  const { data: box, error } = await supabase
    .from('box')
    .update({ manifest_image_url: manifestImageUrl, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box manifest URL')
  return box as Box
}

export async function setBoxBiosecurity(
  boxId: string,
  value: boolean,
  userProfileId?: string
): Promise<Box> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)
  const { data: box, error } = await supabase
    .from('box')
    .update({ is_biosecurity: value, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box biosecurity flag')
  return box as Box
}

/**
 * Reassign a box_item to a different box. Guards that both the source box (the
 * one currently holding the item) and the destination box belong to the same
 * owner, so items can't be moved across user boundaries.
 */
export async function moveItemToBox(
  boxItemId: string,
  toBoxId: string,
  userProfileId?: string
): Promise<BoxItem> {
  const supabase = getAdminClient()

  // Fetch the box_item and its current box's owner
  const { data: boxItem, error: itemErr } = await supabase
    .from('box_item')
    .select('id, box_id')
    .eq('id', boxItemId)
    .single()

  if (itemErr || !boxItem) throw new Error('Box item not found')

  // Resolve owners of both source and destination boxes
  const { data: boxes, error: boxesErr } = await supabase
    .from('box')
    .select('id, user_profile_id')
    .in('id', [boxItem.box_id as string, toBoxId])

  if (boxesErr) throw new Error(boxesErr.message)

  const fromBox = (boxes ?? []).find((b) => b.id === boxItem.box_id)
  const toBox = (boxes ?? []).find((b) => b.id === toBoxId)

  if (!toBox) throw new Error('Destination box not found')
  if (!fromBox) throw new Error('Source box not found')
  if (fromBox.user_profile_id !== toBox.user_profile_id) {
    throw new Error('Cannot move item between boxes owned by different users')
  }
  // Enforce caller ownership of both boxes (service-role bypasses RLS)
  if (userProfileId && fromBox.user_profile_id !== userProfileId) {
    throw new Error('Box item not found')
  }

  if (boxItem.box_id === toBoxId) return boxItem as BoxItem

  const { data: updated, error: updateErr } = await supabase
    .from('box_item')
    .update({ box_id: toBoxId })
    .eq('id', boxItemId)
    .select()
    .single()

  if (updateErr || !updated) throw new Error(updateErr?.message ?? 'Failed to move item to box')
  return updated as BoxItem
}

// ─── BoxScan ─────────────────────────────────────────────────────────────────

export async function createBoxScan(boxId: string): Promise<BoxScan> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box_scan')
    .insert({
      box_id: boxId,
      status: BoxScanStatus.PROCESSING,
      total_found: 0,
      matched_count: 0,
      new_count: 0,
      flagged_count: 0,
      illegible_count: 0,
      illegible_entries: [],
      flagged_items: [],
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create box scan')
  return data as BoxScan
}

export async function updateBoxScan(
  scanId: string,
  changes: Partial<Pick<BoxScan, 'status' | 'total_found' | 'matched_count' | 'new_count' | 'flagged_count' | 'illegible_count' | 'illegible_entries' | 'flagged_items' | 'proposed_items'>>
): Promise<BoxScan> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box_scan')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', scanId)
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update box scan')
  return data as BoxScan
}

export async function getBoxScan(scanId: string): Promise<BoxScan | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box_scan')
    .select('*')
    .eq('id', scanId)
    .single()

  if (error || !data) return null
  return data as BoxScan
}

/**
 * Confirm every draft item in a box — flips is_draft to false so the items
 * become part of the official manifest. Returns the confirmed box_item rows.
 */
export async function confirmBoxDrafts(
  boxId: string,
  userProfileId?: string
): Promise<BoxItem[]> {
  const supabase = getAdminClient()
  if (userProfileId) await assertBoxOwner(boxId, userProfileId)

  const { data, error } = await supabase
    .from('box_item')
    .update({ is_draft: false })
    .eq('box_id', boxId)
    .eq('is_draft', true)
    .select()

  if (error) throw new Error(error.message)
  return (data ?? []) as BoxItem[]
}

/**
 * The set of item_assessment ids that are already in some box for this user —
 * i.e. "packed". Used by the sticker scan to avoid re-proposing items the owner
 * has already placed (the brief is "scanned but NOT packed").
 */
export async function getPackedAssessmentIds(
  userProfileId: string
): Promise<Set<string>> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box_item')
    .select('item_assessment_id, box!inner(user_profile_id)')
    .eq('box.user_profile_id', userProfileId)
    .not('item_assessment_id', 'is', null)

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ item_assessment_id: string | null }>
  return new Set(rows.map((r) => r.item_assessment_id).filter((id): id is string => !!id))
}

export async function getLatestBoxScan(boxId: string): Promise<BoxScan | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box_scan')
    .select('*')
    .eq('box_id', boxId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as BoxScan
}

// ─── ItemConversation ─────────────────────────────────────────────────────────

/**
 * Get or create a conversation for an item. Lazy creation — the conversation
 * record is created on first message, not when the item is assessed.
 */
export async function getOrCreateItemConversation(
  itemAssessmentId: string,
  userProfileId: string
): Promise<ItemConversation> {
  const supabase = getAdminClient()

  // Verify ownership
  const { data: item } = await supabase
    .from('item_assessment')
    .select('id')
    .eq('id', itemAssessmentId)
    .eq('user_profile_id', userProfileId)
    .single()

  if (!item) throw new Error('Item not found or not owned by user')

  // Try to find existing
  const { data: existing } = await supabase
    .from('item_conversation')
    .select('*')
    .eq('item_assessment_id', itemAssessmentId)
    .single()

  if (existing) return existing as ItemConversation

  // Create new
  const { data: created, error } = await supabase
    .from('item_conversation')
    .insert({ item_assessment_id: itemAssessmentId })
    .select()
    .single()

  if (error || !created) throw new Error(error?.message ?? 'Failed to create conversation')
  return created as ItemConversation
}

/**
 * Get all messages for a conversation, ordered by creation time.
 */
export async function getConversationMessages(
  conversationId: string
): Promise<ItemConversationMessage[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('item_conversation_message')
    .select('*')
    .eq('item_conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ItemConversationMessage[]
}

/**
 * Append a message to a conversation.
 */
export async function appendConversationMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<ItemConversationMessage> {
  const supabase = getAdminClient()
  const id = randomUUID()

  const { data, error } = await supabase
    .from('item_conversation_message')
    .insert({
      id,
      item_conversation_id: conversationId,
      role,
      content,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to append message')

  // Update conversation timestamp
  await supabase
    .from('item_conversation')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data as ItemConversationMessage
}

// ─── Item edit system messages ─────────────────────────────────────────────

// Verdict labels for human-readable messages
const VERDICT_LABELS: Record<string, string> = {
  SHIP: 'Ship',
  CARRY: 'Carry',
  SELL: 'Sell',
  DONATE: 'Donate',
  DISCARD: 'Discard',
  REVISIT: 'Decide later',
}

// Human-readable labels for the biosecurity risk flags.
const BIOSECURITY_FLAG_LABELS: Record<string, string> = {
  none: 'No biosecurity risk',
  declare: 'Declare on arrival',
  high_risk: 'High biosecurity risk',
  prohibited: 'Prohibited',
}

/**
 * After a user edits an item, persist system messages into the item's
 * conversation so that Aisling (and the user) can see what changed.
 *
 * Only called for meaningful field changes: verdict, item_name,
 * estimated_ship_cost, estimated_replace_cost, advice_text.
 *
 * This is best-effort — failures are non-fatal and do not affect the item
 * update response.
 */
export async function appendItemEditSystemMessages(
  itemAssessmentId: string,
  userProfileId: string,
  before: Pick<ItemAssessment, 'verdict' | 'item_name' | 'estimated_ship_cost' | 'estimated_replace_cost' | 'advice_text' | 'currency' | 'replace_currency' | 'biosecurity_flag'>,
  after: Pick<ItemAssessment, 'verdict' | 'item_name' | 'estimated_ship_cost' | 'estimated_replace_cost' | 'advice_text' | 'currency' | 'replace_currency' | 'biosecurity_flag'>
): Promise<void> {
  const notes: string[] = []

  if (before.item_name !== after.item_name && after.item_name) {
    notes.push(`You renamed this item to "${after.item_name}".`)
  }

  if (before.verdict !== after.verdict && after.verdict) {
    const label = VERDICT_LABELS[after.verdict] ?? after.verdict
    notes.push(`You changed the decision to ${label}.`)
  }

  if (before.biosecurity_flag !== after.biosecurity_flag) {
    if (after.biosecurity_flag) {
      const label = BIOSECURITY_FLAG_LABELS[after.biosecurity_flag] ?? after.biosecurity_flag
      notes.push(`You changed the biosecurity status to ${label}.`)
    } else {
      notes.push('You cleared the biosecurity status.')
    }
  }

  if (before.estimated_ship_cost !== after.estimated_ship_cost) {
    if (after.estimated_ship_cost != null) {
      const sym = after.currency ?? 'USD'
      notes.push(`You updated the estimated shipping cost to ${sym} ${after.estimated_ship_cost.toFixed(2)}.`)
    } else {
      notes.push('You removed the estimated shipping cost.')
    }
  }

  if (before.estimated_replace_cost !== after.estimated_replace_cost) {
    if (after.estimated_replace_cost != null) {
      const sym = after.replace_currency ?? 'EUR'
      notes.push(`You updated the estimated replacement cost to ${sym} ${after.estimated_replace_cost.toFixed(2)}.`)
    } else {
      notes.push('You removed the estimated replacement cost.')
    }
  }

  if (before.advice_text !== after.advice_text) {
    notes.push("You updated Aisling's advice text.")
  }

  if (notes.length === 0) return

  try {
    const conversation = await getOrCreateItemConversation(itemAssessmentId, userProfileId)
    for (const note of notes) {
      await appendConversationMessage(conversation.id, 'system', note)
    }
  } catch {
    // Best-effort — system message failures must not surface to the user
  }
}
