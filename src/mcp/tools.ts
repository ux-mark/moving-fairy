import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { BOX_SIZE_CBM, BoxSize, BoxStatus, BoxType, Verdict } from '@/lib/constants'
import type { Box, BoxItem, ItemAssessment, Message, Session, UserProfile } from '@/types/database'

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

export async function getUserProfile(sessionId: string): Promise<UserProfile | null> {
  const supabase = getAdminClient()
  // Resolve session → user_profile_id → profile
  const { data: session, error: sessionErr } = await supabase
    .from('session')
    .select('user_profile_id')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) return null

  const { data: profile, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', session.user_profile_id)
    .single()

  if (error || !profile) return null
  return profile as UserProfile
}

export async function createUserProfile(data: {
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

// ─── Session ───────────────────────────────────────────────────────────────

export async function createSession(userProfileId: string): Promise<Session> {
  const supabase = getAdminClient()
  const { data: session, error } = await supabase
    .from('session')
    .insert({
      user_profile_id: userProfileId,
      messages: [],
    })
    .select()
    .single()

  if (error || !session) throw new Error(error?.message ?? 'Failed to create session')
  return session as Session
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const supabase = getAdminClient()
  const { data: session, error } = await supabase
    .from('session')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error || !session) return null
  return session as Session
}

export async function appendMessage(sessionId: string, message: Message): Promise<void> {
  const supabase = getAdminClient()

  // Fetch current messages, append, update
  const { data: session, error: fetchErr } = await supabase
    .from('session')
    .select('messages')
    .eq('id', sessionId)
    .single()

  if (fetchErr || !session) throw new Error(fetchErr?.message ?? 'Session not found')

  const messages: Message[] = Array.isArray(session.messages) ? session.messages : []
  messages.push(message)

  const { error } = await supabase
    .from('session')
    .update({ messages, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)
}

// ─── ItemAssessment ────────────────────────────────────────────────────────

type ItemAssessmentInsert = {
  user_profile_id: string
  session_id: string | null
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
}

export async function saveItemAssessment(data: {
  user_profile_id: string
  session_id?: string | null
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
}): Promise<ItemAssessment> {
  const supabase = getAdminClient()
  const verdict = data.verdict

  // Enforce lightweight vs full record rule
  const isLightweight =
    verdict === Verdict.SELL || verdict === Verdict.DONATE || verdict === Verdict.DISCARD

  const payload: ItemAssessmentInsert = {
    user_profile_id: data.user_profile_id,
    session_id: data.session_id ?? null,
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
  }

  const { data: record, error } = await supabase
    .from('item_assessment')
    .insert(payload)
    .select()
    .single()

  if (error || !record) throw new Error(error?.message ?? 'Failed to save item assessment')
  return record as ItemAssessment
}

export async function updateItemAssessment(
  assessmentId: string,
  changes: Partial<ItemAssessment>
): Promise<ItemAssessment> {
  const supabase = getAdminClient()

  const { data: record, error } = await supabase
    .from('item_assessment')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('id', assessmentId)
    .select()
    .single()

  if (error || !record) throw new Error(error?.message ?? 'Failed to update item assessment')
  return record as ItemAssessment
}

export async function getItemAssessments(
  userProfileId: string,
  filters?: { verdict?: ItemAssessment['verdict']; session_id?: string; user_confirmed?: boolean }
): Promise<ItemAssessment[]> {
  const supabase = getAdminClient()
  let query = supabase
    .from('item_assessment')
    .select('*')
    .eq('user_profile_id', userProfileId)

  if (filters?.verdict) query = query.eq('verdict', filters.verdict)
  if (filters?.session_id) query = query.eq('session_id', filters.session_id)
  if (filters?.user_confirmed !== undefined)
    query = query.eq('user_confirmed', filters.user_confirmed)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ItemAssessment[]
}

// ─── Cost summary ──────────────────────────────────────────────────────────

export async function getCostSummary(userProfileId: string): Promise<{
  counts_by_verdict: Record<string, number>
  total_estimated_ship_cost: number
  currency: string
}> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('item_assessment')
    .select('verdict, estimated_ship_cost, currency')
    .eq('user_profile_id', userProfileId)

  if (error) throw new Error(error.message)

  const records = data ?? []
  const counts_by_verdict: Record<string, number> = {}
  let total_estimated_ship_cost = 0
  let currency = 'USD'

  for (const r of records) {
    counts_by_verdict[r.verdict] = (counts_by_verdict[r.verdict] ?? 0) + 1
    if (r.estimated_ship_cost) {
      total_estimated_ship_cost += r.estimated_ship_cost
      if (r.currency) currency = r.currency
    }
  }

  return { counts_by_verdict, total_estimated_ship_cost, currency }
}

// ─── Box ───────────────────────────────────────────────────────────────────

function computeBoxLabel(
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
    // Validate verdict gate
    const { data: assessment, error: aErr } = await supabase
      .from('item_assessment')
      .select('verdict, item_name')
      .eq('id', opts.itemAssessmentId)
      .single()

    if (aErr || !assessment) throw new Error('Item assessment not found')

    const blocked: string[] = [Verdict.SELL, Verdict.DONATE, Verdict.DISCARD]
    if (blocked.includes(assessment.verdict)) {
      throw new Error(
        `Cannot add item with verdict ${assessment.verdict} to a box. Only SHIP or CARRY items are allowed.`
      )
    }

    itemName = assessment.item_name as string
    fromAssessment = true
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

  return { ...(box as Box), items: (items ?? []) as BoxItem[] }
}

export async function getBoxes(userProfileId: string): Promise<Box[]> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('box')
    .select('*')
    .eq('user_profile_id', userProfileId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Box[]
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
): Promise<{ label: string; items: { item_name: string; quantity: number }[] }> {
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
