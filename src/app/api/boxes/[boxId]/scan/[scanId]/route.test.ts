import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const {
  mockGetAuthenticatedProfile,
  mockGetBox,
  mockGetBoxScan,
  mockUpdateBoxScan,
  mockSaveItemAssessment,
  mockAddItemToBox,
  mockAssessItem,
} = vi.hoisted(() => ({
  mockGetAuthenticatedProfile: vi.fn(),
  mockGetBox: vi.fn(),
  mockGetBoxScan: vi.fn(),
  mockUpdateBoxScan: vi.fn(),
  mockSaveItemAssessment: vi.fn(),
  mockAddItemToBox: vi.fn(),
  mockAssessItem: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthenticatedProfile: (...a: unknown[]) => mockGetAuthenticatedProfile(...a),
}))

vi.mock('@/mcp', () => ({
  getBox: (...a: unknown[]) => mockGetBox(...a),
  getBoxScan: (...a: unknown[]) => mockGetBoxScan(...a),
  updateBoxScan: (...a: unknown[]) => mockUpdateBoxScan(...a),
  saveItemAssessment: (...a: unknown[]) => mockSaveItemAssessment(...a),
  addItemToBox: (...a: unknown[]) => mockAddItemToBox(...a),
}))

vi.mock('@/lib/assess-item', () => ({
  assessItem: (...a: unknown[]) => mockAssessItem(...a),
}))

import { POST } from './route'
import { NextRequest } from 'next/server'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROFILE = { id: 'profile-1' }
const USER = { id: 'auth-1' }
const BOX_ID = 'box-1'
const SCAN_ID = 'scan-1'

const DUPLICATE_PROPOSAL = {
  box_item_id: null,
  item_assessment_id: 'item-1',
  item_name: 'Blender',
  kind: 'duplicate',
  verdict: 'SHIP',
  extracted_text: 'Blender',
  packed_box_id: 'box-3',
  packed_box_label: 'WH03-KIT',
}

const SCAN = {
  id: SCAN_ID,
  box_id: BOX_ID,
  duplicate_count: 1,
  proposed_items: [
    { box_item_id: 'bi-1', item_assessment_id: 'item-9', item_name: 'Kettle', kind: 'matched', verdict: 'SHIP' },
    DUPLICATE_PROPOSAL,
  ],
}

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/boxes/${BOX_ID}/scan/${SCAN_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function callPost(body: unknown) {
  return POST(makeRequest(body), {
    params: Promise.resolve({ boxId: BOX_ID, scanId: SCAN_ID }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetAuthenticatedProfile.mockResolvedValue({ user: USER, profile: PROFILE })
  mockGetBox.mockResolvedValue({ id: BOX_ID, user_profile_id: PROFILE.id, items: [] })
  mockGetBoxScan.mockResolvedValue(SCAN)
  mockUpdateBoxScan.mockResolvedValue({})
  mockSaveItemAssessment.mockResolvedValue({ id: 'new-item-1', item_name: 'Blender' })
  mockAddItemToBox.mockResolvedValue({ id: 'bi-new-1' })
  mockAssessItem.mockResolvedValue(undefined)
})

// ─── Guards ──────────────────────────────────────────────────────────────────

describe('POST /api/boxes/:boxId/scan/:scanId — guards', () => {
  it('401 when not authenticated', async () => {
    mockGetAuthenticatedProfile.mockResolvedValue({ user: null, profile: null })
    const res = await callPost({ action: 'skip_duplicate', item_assessment_id: 'item-1' })
    expect(res.status).toBe(401)
  })

  it("404 when the box belongs to someone else", async () => {
    mockGetBox.mockResolvedValue({ id: BOX_ID, user_profile_id: 'other-profile', items: [] })
    const res = await callPost({ action: 'skip_duplicate', item_assessment_id: 'item-1' })
    expect(res.status).toBe(404)
  })

  it('404 when the scan belongs to a different box', async () => {
    mockGetBoxScan.mockResolvedValue({ ...SCAN, box_id: 'box-2' })
    const res = await callPost({ action: 'skip_duplicate', item_assessment_id: 'item-1' })
    expect(res.status).toBe(404)
  })

  it('400 on an unknown action', async () => {
    const res = await callPost({ action: 'explode', item_assessment_id: 'item-1' })
    expect(res.status).toBe(400)
  })

  it('404 when no duplicate proposal matches the id', async () => {
    // item-9 exists in proposed_items but as kind matched, not duplicate.
    const res = await callPost({ action: 'skip_duplicate', item_assessment_id: 'item-9' })
    expect(res.status).toBe(404)
  })
})

// ─── skip_duplicate ──────────────────────────────────────────────────────────

describe('POST — skip_duplicate', () => {
  it('removes the proposal from the scan and decrements the count', async () => {
    const res = await callPost({ action: 'skip_duplicate', item_assessment_id: 'item-1' })
    expect(res.status).toBe(200)

    expect(mockSaveItemAssessment).not.toHaveBeenCalled()
    expect(mockAddItemToBox).not.toHaveBeenCalled()
    expect(mockUpdateBoxScan).toHaveBeenCalledWith(SCAN_ID, {
      proposed_items: [SCAN.proposed_items[0]],
      duplicate_count: 0,
    })
  })
})

// ─── add_duplicate ───────────────────────────────────────────────────────────

describe('POST — add_duplicate', () => {
  it('creates a fresh item, adds it to THIS box non-draft, fires assessment, drops the proposal', async () => {
    const res = await callPost({ action: 'add_duplicate', item_assessment_id: 'item-1' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    expect(mockSaveItemAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        user_profile_id: PROFILE.id,
        item_name: 'Blender',
        source: 'sticker_scan',
        verdict: null,
      })
    )
    expect(mockAddItemToBox).toHaveBeenCalledWith(
      BOX_ID,
      { itemAssessmentId: 'new-item-1', isDraft: false },
      PROFILE.id
    )
    expect(mockAssessItem).toHaveBeenCalledWith('new-item-1', PROFILE.id)
    expect(mockUpdateBoxScan).toHaveBeenCalledWith(SCAN_ID, {
      proposed_items: [SCAN.proposed_items[0]],
      duplicate_count: 0,
    })
  })

  it('500 with no scan update when the box insert fails', async () => {
    mockAddItemToBox.mockRejectedValue(new Error('insert failed'))
    const res = await callPost({ action: 'add_duplicate', item_assessment_id: 'item-1' })
    expect(res.status).toBe(500)
    expect(mockUpdateBoxScan).not.toHaveBeenCalled()
  })
})
