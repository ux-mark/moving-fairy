import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const {
  mockGetBox,
  mockGetUserProfile,
  mockGetItemAssessments,
  mockGetPackedAssessmentBoxes,
  mockAddItemToBox,
  mockSaveItemAssessment,
  mockUpdateBoxScan,
  mockCallCli,
  mockAssessItem,
} = vi.hoisted(() => ({
  mockGetBox: vi.fn(),
  mockGetUserProfile: vi.fn(),
  mockGetItemAssessments: vi.fn(),
  mockGetPackedAssessmentBoxes: vi.fn(),
  mockAddItemToBox: vi.fn(),
  mockSaveItemAssessment: vi.fn(),
  mockUpdateBoxScan: vi.fn(),
  mockCallCli: vi.fn(),
  mockAssessItem: vi.fn(),
}))

vi.mock('@/mcp', () => ({
  getBox: (...a: unknown[]) => mockGetBox(...a),
  getUserProfile: (...a: unknown[]) => mockGetUserProfile(...a),
  getItemAssessments: (...a: unknown[]) => mockGetItemAssessments(...a),
  getPackedAssessmentBoxes: (...a: unknown[]) => mockGetPackedAssessmentBoxes(...a),
  addItemToBox: (...a: unknown[]) => mockAddItemToBox(...a),
  saveItemAssessment: (...a: unknown[]) => mockSaveItemAssessment(...a),
  updateBoxScan: (...a: unknown[]) => mockUpdateBoxScan(...a),
}))

vi.mock('@/lib/claude-cli', () => ({
  callCli: (...a: unknown[]) => mockCallCli(...a),
}))

vi.mock('@/lib/ai/executor', () => ({
  getExecutorMode: () => 'cli',
  getAislingModel: () => 'test-model',
  createAnthropicClient: vi.fn(),
  withSdk401Retry: vi.fn(),
}))

vi.mock('@/lib/ai/image-attachment', () => ({
  downloadImageToTmp: vi.fn().mockResolvedValue(undefined),
  cleanupTmpImage: vi.fn(),
  fetchImageAsBase64: vi.fn(),
}))

vi.mock('@/lib/assess-item', () => ({
  assessItem: (...a: unknown[]) => mockAssessItem(...a),
}))

import { runStickerScan } from './scan-sticker'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROFILE_ID = 'profile-1'
const BOX_ID = 'box-1'
const SCAN_ID = 'scan-1'

function assessment(id: string, name: string, verdict: string | null = 'SHIP') {
  return { id, item_name: name, verdict }
}

function setup({
  labelEntries,
  existingItems = [],
  packedBoxes = new Map<string, { box_id: string; box_label: string }>(),
  boxItems = [] as Array<{ item_assessment_id: string | null }>,
}: {
  labelEntries: Array<string | null>
  existingItems?: Array<{ id: string; item_name: string; verdict: string | null }>
  packedBoxes?: Map<string, { box_id: string; box_label: string }>
  boxItems?: Array<{ item_assessment_id: string | null }>
}) {
  mockGetBox.mockResolvedValue({ id: BOX_ID, user_profile_id: PROFILE_ID, items: boxItems })
  mockGetUserProfile.mockResolvedValue({ id: PROFILE_ID })
  mockGetItemAssessments.mockResolvedValue(existingItems)
  mockGetPackedAssessmentBoxes.mockResolvedValue(packedBoxes)
  mockCallCli.mockResolvedValue(JSON.stringify(labelEntries))
  mockAddItemToBox.mockImplementation((_boxId: string, opts: { itemAssessmentId: string }) =>
    Promise.resolve({ id: `bi-${opts.itemAssessmentId}` })
  )
  mockSaveItemAssessment.mockImplementation((data: { item_name: string }) =>
    Promise.resolve({ id: `new-${data.item_name}`, item_name: data.item_name })
  )
  mockUpdateBoxScan.mockResolvedValue({})
  mockAssessItem.mockResolvedValue(undefined)
}

function finalScanUpdate() {
  const call = mockUpdateBoxScan.mock.calls.at(-1)
  expect(call?.[0]).toBe(SCAN_ID)
  return call?.[1] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Duplicate handling ──────────────────────────────────────────────────────

describe('runStickerScan — match packed in ANOTHER box', () => {
  it('records a duplicate proposal with the packed box label, creates nothing', async () => {
    setup({
      labelEntries: ['Blender'],
      existingItems: [assessment('item-1', 'Blender')],
      packedBoxes: new Map([['item-1', { box_id: 'box-3', box_label: 'WH03-KIT' }]]),
    })

    await runStickerScan(SCAN_ID, BOX_ID, 'http://img', PROFILE_ID)

    expect(mockAddItemToBox).not.toHaveBeenCalled()
    expect(mockSaveItemAssessment).not.toHaveBeenCalled()

    const update = finalScanUpdate()
    expect(update['matched_count']).toBe(0)
    expect(update['duplicate_count']).toBe(1)
    expect(update['proposed_items']).toEqual([
      {
        box_item_id: null,
        item_assessment_id: 'item-1',
        item_name: 'Blender',
        kind: 'duplicate',
        verdict: 'SHIP',
        extracted_text: 'Blender',
        packed_box_id: 'box-3',
        packed_box_label: 'WH03-KIT',
      },
    ])
  })

  it('dedupes the same label entry — one proposal, repeats count as matched', async () => {
    setup({
      labelEntries: ['Blender', 'Blender'],
      existingItems: [assessment('item-1', 'Blender')],
      packedBoxes: new Map([['item-1', { box_id: 'box-3', box_label: 'WH03-KIT' }]]),
    })

    await runStickerScan(SCAN_ID, BOX_ID, 'http://img', PROFILE_ID)

    const update = finalScanUpdate()
    expect(update['duplicate_count']).toBe(1)
    expect(update['matched_count']).toBe(1)
    expect((update['proposed_items'] as unknown[]).length).toBe(1)
  })
})

describe('runStickerScan — match packed in THIS box', () => {
  it('counts silently: no proposal, no creation', async () => {
    setup({
      labelEntries: ['Blender'],
      existingItems: [assessment('item-1', 'Blender')],
      // Packed map includes this box too — the in-this-box check wins.
      packedBoxes: new Map([['item-1', { box_id: BOX_ID, box_label: 'WH01-KIT' }]]),
      boxItems: [{ item_assessment_id: 'item-1' }],
    })

    await runStickerScan(SCAN_ID, BOX_ID, 'http://img', PROFILE_ID)

    expect(mockAddItemToBox).not.toHaveBeenCalled()

    const update = finalScanUpdate()
    expect(update['matched_count']).toBe(1)
    expect(update['duplicate_count']).toBe(0)
    expect(update['proposed_items']).toEqual([])
  })
})

describe('runStickerScan — unpacked match (unchanged behaviour)', () => {
  it('adds the match to the box as a draft proposal', async () => {
    setup({
      labelEntries: ['Blender'],
      existingItems: [assessment('item-1', 'Blender')],
    })

    await runStickerScan(SCAN_ID, BOX_ID, 'http://img', PROFILE_ID)

    expect(mockAddItemToBox).toHaveBeenCalledWith(BOX_ID, {
      itemAssessmentId: 'item-1',
      isDraft: true,
    })

    const update = finalScanUpdate()
    expect(update['matched_count']).toBe(1)
    expect(update['duplicate_count']).toBe(0)
    expect(update['proposed_items']).toEqual([
      {
        box_item_id: 'bi-item-1',
        item_assessment_id: 'item-1',
        item_name: 'Blender',
        kind: 'matched',
        verdict: 'SHIP',
      },
    ])
  })

  it('still flags non-ship verdicts instead of proposing', async () => {
    setup({
      labelEntries: ['Old sofa'],
      existingItems: [assessment('item-2', 'Old sofa', 'SELL')],
    })

    await runStickerScan(SCAN_ID, BOX_ID, 'http://img', PROFILE_ID)

    const update = finalScanUpdate()
    expect(update['flagged_count']).toBe(1)
    expect(update['duplicate_count']).toBe(0)
    expect(update['flagged_items']).toEqual([
      { item_assessment_id: 'item-2', verdict: 'SELL', item_name: 'Old sofa' },
    ])
  })

  it('creates a new draft item for an unmatched entry', async () => {
    setup({ labelEntries: ['Mystery gadget'] })

    await runStickerScan(SCAN_ID, BOX_ID, 'http://img', PROFILE_ID)

    expect(mockSaveItemAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ item_name: 'Mystery gadget', source: 'sticker_scan' })
    )
    expect(mockAssessItem).toHaveBeenCalledWith('new-Mystery gadget', PROFILE_ID)

    const update = finalScanUpdate()
    expect(update['new_count']).toBe(1)
    expect(update['duplicate_count']).toBe(0)
  })
})

describe('runStickerScan — mixed label', () => {
  it('routes each entry to the right bucket', async () => {
    setup({
      labelEntries: ['Blender', 'Kettle', 'Mystery gadget', null],
      existingItems: [assessment('item-1', 'Blender'), assessment('item-2', 'Kettle')],
      packedBoxes: new Map([['item-1', { box_id: 'box-3', box_label: 'WH03-KIT' }]]),
    })

    await runStickerScan(SCAN_ID, BOX_ID, 'http://img', PROFILE_ID)

    const update = finalScanUpdate()
    expect(update['total_found']).toBe(4)
    expect(update['duplicate_count']).toBe(1)
    expect(update['matched_count']).toBe(1)
    expect(update['new_count']).toBe(1)
    expect(update['illegible_count']).toBe(1)

    const kinds = (update['proposed_items'] as Array<{ kind: string }>).map((p) => p.kind)
    expect(kinds.sort()).toEqual(['duplicate', 'matched', 'new'])
  })
})
