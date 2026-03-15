import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted mocks (these run before imports) ──────────────────────────────

const { mockGetAuthenticatedProfile, mockCreateUserProfile } = vi.hoisted(() => ({
  mockGetAuthenticatedProfile: vi.fn(),
  mockCreateUserProfile: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getAuthenticatedProfile: (...args: unknown[]) => mockGetAuthenticatedProfile(...args),
}))

vi.mock('@/mcp', () => ({
  createUserProfile: (...args: unknown[]) => mockCreateUserProfile(...args),
}))

// Import after mocks
import { POST } from './route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_USER = { id: 'auth-user-1', email: 'test@example.com' }

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Auth guard ──────────────────────────────────────────────────────────────

describe('POST /api/onboarding — auth guard', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetAuthenticatedProfile.mockResolvedValue({ user: null, profile: null })
    const res = await POST(makeRequest({ departure_country: 'US', arrival_country: 'IE' }))
    expect(res.status).toBe(401)
  })
})

// ─── Required field validation ───────────────────────────────────────────────

describe('POST /api/onboarding — required field validation', () => {
  beforeEach(() => {
    mockGetAuthenticatedProfile.mockResolvedValue({ user: MOCK_USER, profile: null })
  })

  it('rejects missing departure_country', async () => {
    const res = await POST(makeRequest({ arrival_country: 'IE' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/departure_country/)
  })

  it('rejects invalid departure_country code', async () => {
    const res = await POST(makeRequest({ departure_country: 'XX', arrival_country: 'IE' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/departure_country/)
  })

  it('rejects missing arrival_country', async () => {
    const res = await POST(makeRequest({ departure_country: 'US' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/arrival_country/)
  })

  it('rejects invalid arrival_country code', async () => {
    const res = await POST(makeRequest({ departure_country: 'US', arrival_country: 'ZZ' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/arrival_country/)
  })

  it('rejects when departure_country === arrival_country', async () => {
    const res = await POST(makeRequest({ departure_country: 'US', arrival_country: 'US' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/must be different/)
  })

  it('rejects invalid JSON body', async () => {
    const req = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Invalid JSON/)
  })
})

// ─── Onward move validation ───────────────────────────────────────────────────

describe('POST /api/onboarding — onward move validation', () => {
  beforeEach(() => {
    mockGetAuthenticatedProfile.mockResolvedValue({ user: MOCK_USER, profile: null })
    mockCreateUserProfile.mockResolvedValue({ id: 'profile-1' })
  })

  it('rejects invalid onward_country code', async () => {
    const res = await POST(
      makeRequest({ departure_country: 'US', arrival_country: 'IE', onward_country: 'ZZ' })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/onward_country/)
  })

  it('rejects onward_country === arrival_country', async () => {
    const res = await POST(
      makeRequest({ departure_country: 'US', arrival_country: 'IE', onward_country: 'IE' })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/onward_country must differ/)
  })

  it('rejects onward_timeline without onward_country', async () => {
    const res = await POST(
      makeRequest({ departure_country: 'US', arrival_country: 'IE', onward_timeline: '1_2yr' })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/onward_country must be set/)
  })

  it('rejects invalid onward_timeline value', async () => {
    const res = await POST(
      makeRequest({
        departure_country: 'US',
        arrival_country: 'IE',
        onward_country: 'AU',
        onward_timeline: 'bad_value',
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/onward_timeline/)
  })

  it('accepts valid onward_country and onward_timeline', async () => {
    const res = await POST(
      makeRequest({
        departure_country: 'US',
        arrival_country: 'IE',
        onward_country: 'AU',
        onward_timeline: '1_2yr',
      })
    )
    expect(res.status).toBe(201)
  })
})

// ─── Equipment JSON building ──────────────────────────────────────────────────

describe('POST /api/onboarding — equipment fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthenticatedProfile.mockResolvedValue({ user: MOCK_USER, profile: null })
    mockCreateUserProfile.mockResolvedValue({ id: 'profile-1' })
  })

  it('builds equipment from transformer fields when has_transformer is true', async () => {
    await POST(
      makeRequest({
        departure_country: 'US',
        arrival_country: 'IE',
        has_transformer: true,
        transformer_model: 'Dynastar DS-5500',
        transformer_wattage: 5500,
      })
    )

    const callArg = mockCreateUserProfile.mock.calls[0]?.[0] as Record<string, unknown>
    const equipment = callArg.equipment as {
      transformer: { owned: boolean; model: string | null; wattage_w: number | null }
    }
    expect(equipment.transformer.owned).toBe(true)
    expect(equipment.transformer.model).toBe('Dynastar DS-5500')
    expect(equipment.transformer.wattage_w).toBe(5500)
  })

  it('builds lightweight equipment object when has_transformer is false', async () => {
    await POST(
      makeRequest({
        departure_country: 'US',
        arrival_country: 'IE',
        has_transformer: false,
      })
    )

    const callArg = mockCreateUserProfile.mock.calls[0]?.[0] as Record<string, unknown>
    const equipment = callArg.equipment as {
      transformer: { owned: boolean; model: string | null; wattage_w: number | null }
    }
    expect(equipment.transformer.owned).toBe(false)
    expect(equipment.transformer.model).toBeNull()
  })

  it('uses pre-built equipment object when provided', async () => {
    const prebuiltEquipment = { transformer: { owned: true, model: 'X', wattage_w: 1000 } }

    await POST(
      makeRequest({
        departure_country: 'US',
        arrival_country: 'IE',
        equipment: prebuiltEquipment,
      })
    )

    const callArg = mockCreateUserProfile.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg.equipment).toEqual(prebuiltEquipment)
  })
})

// ─── Success response ─────────────────────────────────────────────────────────

describe('POST /api/onboarding — success', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthenticatedProfile.mockResolvedValue({ user: MOCK_USER, profile: null })
    mockCreateUserProfile.mockResolvedValue({ id: 'profile-1' })
  })

  it('returns 201 with profile_id on valid input', async () => {
    const res = await POST(makeRequest({ departure_country: 'US', arrival_country: 'IE' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.profile_id).toBe('profile-1')
  })

  it('passes auth_user_id to createUserProfile', async () => {
    await POST(makeRequest({ departure_country: 'US', arrival_country: 'IE' }))
    const callArg = mockCreateUserProfile.mock.calls[0]?.[0] as Record<string, unknown>
    expect(callArg.auth_user_id).toBe('auth-user-1')
  })
})
