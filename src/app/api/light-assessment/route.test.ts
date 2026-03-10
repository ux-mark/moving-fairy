import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockGetAuthenticatedProfile, mockSaveItemAssessment, mockAddItemToBox, mockFindOrCreateSession, mockMessagesCreate } = vi.hoisted(
  () => ({
    mockGetAuthenticatedProfile: vi.fn(),
    mockSaveItemAssessment: vi.fn(),
    mockAddItemToBox: vi.fn(),
    mockFindOrCreateSession: vi.fn(),
    mockMessagesCreate: vi.fn(),
  })
)

vi.mock('@/lib/auth', () => ({
  getAuthenticatedProfile: (...args: unknown[]) => mockGetAuthenticatedProfile(...args),
}))

vi.mock('@/mcp', () => ({
  saveItemAssessment: (...a: unknown[]) => mockSaveItemAssessment(...a),
  addItemToBox: (...a: unknown[]) => mockAddItemToBox(...a),
  findOrCreateSession: (...a: unknown[]) => mockFindOrCreateSession(...a),
}))

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(function () {
    return {
      messages: { create: mockMessagesCreate },
    }
  })
  return { default: MockAnthropic }
})

import { POST } from './route'
import { NextRequest } from 'next/server'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'auth-user-1', email: 'test@example.com' }
const MOCK_PROFILE = {
  id: 'profile-1',
  auth_user_id: 'auth-user-1',
  departure_country: 'US',
  arrival_country: 'IE',
  onward_country: null,
  equipment: {},
  anthropic_api_key: 'sk-ant-test-key',
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/light-assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeHaikuResponse(jsonContent: string) {
  return {
    content: [{ type: 'text', text: jsonContent }],
  }
}

// ─── Auth guard ──────────────────────────────────────────────────────────────

describe('POST /api/light-assessment — auth guard', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetAuthenticatedProfile.mockResolvedValue({ user: null, profile: null })
    const res = await POST(makeRequest({ item_name: 'Books' }))
    expect(res.status).toBe(401)
  })
})

// ─── Request validation ───────────────────────────────────────────────────────

describe('POST /api/light-assessment — request validation', () => {
  beforeEach(() => {
    mockGetAuthenticatedProfile.mockResolvedValue({ user: MOCK_USER, profile: MOCK_PROFILE })
  })

  it('returns 400 when item_name is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/item_name/)
  })

  it('returns 400 when item_name is empty string', async () => {
    const res = await POST(makeRequest({ item_name: '   ' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/item_name/)
  })
})

// ─── Haiku response parsing ───────────────────────────────────────────────────

describe('POST /api/light-assessment — Haiku response parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthenticatedProfile.mockResolvedValue({ user: MOCK_USER, profile: MOCK_PROFILE })
    mockSaveItemAssessment.mockResolvedValue({ id: 'assess-1' })
    mockFindOrCreateSession.mockResolvedValue({ id: 'sess-1' })
  })

  it('handles a clean SHIP verdict with no flags — saves assessment', async () => {
    const haikuJson = JSON.stringify({
      verdict: 'SHIP',
      flags: [],
      flag_details: {},
      is_electrical: false,
      needs_confirmation: false,
    })
    mockMessagesCreate.mockResolvedValueOnce(makeHaikuResponse(haikuJson))

    const res = await POST(makeRequest({ item_name: 'Books' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.verdict).toBe('SHIP')
    expect(mockSaveItemAssessment).toHaveBeenCalledOnce()
    expect(json.flags).toEqual([])
  })

  it('handles SHIP verdict with voltage flag — returns warning card without saving', async () => {
    const haikuJson = JSON.stringify({
      verdict: 'SHIP',
      flags: ['voltage_incompatible'],
      flag_details: {
        voltage_incompatible: 'This device operates on 120V only and needs a transformer.',
      },
      is_electrical: true,
      needs_confirmation: true,
    })
    mockMessagesCreate.mockResolvedValueOnce(makeHaikuResponse(haikuJson))

    const res = await POST(makeRequest({ item_name: 'Hair dryer' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.needs_confirmation).toBe(true)
    expect(json.flags).toContain('voltage_incompatible')
    expect(json.warning_card).toBeDefined()
    expect(json.warning_card.title).toMatch(/voltage/i)
    expect(mockSaveItemAssessment).not.toHaveBeenCalled()
  })

  it('handles BLOCKED verdict — returns blocked response without saving', async () => {
    const haikuJson = JSON.stringify({
      verdict: 'BLOCKED',
      flags: ['import_restricted'],
      flag_details: {
        import_restricted: 'Certain food items are prohibited for import into Ireland.',
      },
      is_electrical: false,
      needs_confirmation: false,
    })
    mockMessagesCreate.mockResolvedValueOnce(makeHaikuResponse(haikuJson))

    const res = await POST(makeRequest({ item_name: 'Beef jerky' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.verdict).toBe('BLOCKED')
    expect(json.reason).toContain('prohibited')
    expect(mockSaveItemAssessment).not.toHaveBeenCalled()
  })

  it('handles malformed / unparseable Haiku response — returns 500', async () => {
    mockMessagesCreate.mockResolvedValueOnce(makeHaikuResponse('not valid json at all'))

    const res = await POST(makeRequest({ item_name: 'Widget' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/parse/)
  })

  it('handles Haiku response wrapped in markdown code fences', async () => {
    const jsonContent = JSON.stringify({
      verdict: 'SHIP',
      flags: [],
      flag_details: {},
      is_electrical: false,
      needs_confirmation: false,
    })
    const fenced = `\`\`\`json\n${jsonContent}\n\`\`\``
    mockMessagesCreate.mockResolvedValueOnce(makeHaikuResponse(fenced))
    mockSaveItemAssessment.mockResolvedValueOnce({ id: 'assess-2' })

    const res = await POST(makeRequest({ item_name: 'Lamp' }))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.verdict).toBe('SHIP')
  })
})
