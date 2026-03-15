import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { BOX_SIZE_CBM, BoxSize, BoxStatus, BoxType, ItemSource, ProcessingStatus, Verdict } from '@/lib/constants'
import type { Box, BoxItem, ItemAssessment, ItemConversation, ItemConversationMessage, UserProfile } from '@/types/database'

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
  changes: Partial<Pick<UserProfile, 'departure_country' | 'arrival_country' | 'onward_country' | 'onward_timeline' | 'equipment' | 'anthropic_api_key'>>
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
  | 'voltage_compatible'
  | 'needs_transformer'
  | 'estimated_ship_cost'
  | 'currency'
  | 'estimated_replace_cost'
  | 'replace_currency'
  | 'user_confirmed'
  | 'processing_status'
  | 'confidence'
  | 'needs_clarification'
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
  currency: string
}> {
  const supabase = getAdminClient()

  // Get departure country to determine authoritative currency
  const { data: profile } = await supabase
    .from('user_profile')
    .select('departure_country')
    .eq('id', userProfileId)
    .single()

  const currencyMap: Record<string, string> = {
    US: 'USD', IE: 'EUR', AU: 'AUD', CA: 'CAD', UK: 'GBP', NZ: 'NZD',
  }
  const departureCurrency = profile?.departure_country
    ? currencyMap[profile.departure_country.toUpperCase()] ?? 'USD'
    : 'USD'

  const { data, error } = await supabase
    .from('item_assessment')
    .select('verdict, estimated_ship_cost')
    .eq('user_profile_id', userProfileId)
    .eq('processing_status', 'completed')

  if (error) throw new Error(error.message)

  const records = data ?? []
  const counts_by_verdict: Record<string, number> = {}
  let total_estimated_ship_cost = 0

  for (const r of records) {
    counts_by_verdict[r.verdict] = (counts_by_verdict[r.verdict] ?? 0) + 1
    if (r.estimated_ship_cost) {
      total_estimated_ship_cost += r.estimated_ship_cost
    }
  }

  return { counts_by_verdict, total_estimated_ship_cost, currency: departureCurrency }
}

// ─── Box ───────────────────────────────────────────────────────────────────

export function computeBoxLabel(
  boxType: BoxType,
  roomName: string,
  boxNumber: number,
  itemLabel?: string
): string {
  switch (boxType) {
    case BoxType.STANDARD:
      return `${roomName} ${boxNumber}`
    case BoxType.CHECKED_LUGGAGE:
      return `Checked Luggage ${boxNumber}`
    case BoxType.CARRYON:
      return 'Carry-on'
    case BoxType.SINGLE_ITEM:
      return itemLabel ?? roomName
  }
}

export async function createBox(
  userProfileId: string,
  roomName: string,
  boxType: BoxType = BoxType.STANDARD,
  size?: BoxSize,
  itemLabel?: string
): Promise<Box> {
  const supabase = getAdminClient()

  // Compute next box_number for this user + room_name
  const { data: existing, error: countErr } = await supabase
    .from('box')
    .select('box_number')
    .eq('user_profile_id', userProfileId)
    .ilike('room_name', roomName)
    .order('box_number', { ascending: false })
    .limit(1)

  if (countErr) throw new Error(countErr.message)

  const firstResult = existing && existing.length > 0 ? existing[0] : null
  const boxNumber = firstResult ? (firstResult.box_number as number) + 1 : 1
  const label = computeBoxLabel(boxType, roomName, boxNumber, itemLabel)

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
  opts: { itemAssessmentId?: string; itemName?: string }
): Promise<BoxItem> {
  const supabase = getAdminClient()

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
  }

  const { data: boxItem, error } = await supabase
    .from('box_item')
    .insert(payload)
    .select()
    .single()

  if (error || !boxItem) throw new Error(error?.message ?? 'Failed to add item to box')
  return boxItem as BoxItem
}

export async function removeItemFromBox(boxId: string, boxItemId: string): Promise<void> {
  const supabase = getAdminClient()
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
  const { data, error } = await supabase
    .from('box')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  const boxes = (data ?? []) as Box[]

  // Fetch items for each box so callers get accurate item counts
  const boxesWithItems = await Promise.all(boxes.map((box) => getBox(box.id)))
  return boxesWithItems
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

export async function setAllBoxesShipped(userProfileId: string): Promise<number> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box')
    .update({ status: BoxStatus.SHIPPED, updated_at: new Date().toISOString() })
    .eq('user_profile_id', userProfileId)
    .in('status', [BoxStatus.PACKING, BoxStatus.PACKED])
    .select('id')

  if (error) throw new Error(error.message)
  return (data ?? []).length
}

export async function updateBoxStatus(boxId: string, status: BoxStatus): Promise<Box> {
  const supabase = getAdminClient()
  const { data: box, error } = await supabase
    .from('box')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box status')
  return box as Box
}

export async function updateBoxCbm(boxId: string, cbm: number): Promise<Box> {
  const supabase = getAdminClient()
  const { data: box, error } = await supabase
    .from('box')
    .update({ cbm, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box CBM')
  return box as Box
}

export async function updateBoxLabel(boxId: string, label: string): Promise<Box> {
  const supabase = getAdminClient()
  const { data: box, error } = await supabase
    .from('box')
    .update({ label, updated_at: new Date().toISOString() })
    .eq('id', boxId)
    .select()
    .single()

  if (error || !box) throw new Error(error?.message ?? 'Failed to update box label')
  return box as Box
}

export async function updateBoxSize(boxId: string, size: BoxSize): Promise<Box> {
  const supabase = getAdminClient()
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
  role: 'user' | 'assistant',
  content: string
): Promise<ItemConversationMessage> {
  const supabase = getAdminClient()
  const id = `msg_${Date.now()}_${role}`

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
