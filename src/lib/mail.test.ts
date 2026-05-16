import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sendMail } from './mail'

describe('sendMail()', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    delete process.env.RESEND_API_KEY
    delete process.env.MAILPACE_API_TOKEN
    delete process.env.MAIL_FROM_ADDRESS
  })

  afterEach(() => {
    process.env = { ...envBackup }
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('skips with reason when no provider is configured (and does NOT throw)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await sendMail({
      to: 'seller@example.com',
      subject: 'hi',
      text: 'hello',
      html: '<p>hello</p>',
    })

    expect(result).toEqual({ skipped: true, reason: 'no_provider' })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('prefers Resend over Mailpace when both are set', async () => {
    process.env.RESEND_API_KEY = 'rk_test'
    process.env.MAILPACE_API_TOKEN = 'mp_test'
    process.env.MAIL_FROM_ADDRESS = 'noreply@example.com'

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend-id-123' }),
      text: async () => '',
    }))
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch)

    const result = await sendMail({
      to: 'seller@example.com',
      subject: 'hi',
      text: 'hello',
      html: '<p>hello</p>',
      replyTo: 'buyer@example.com',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('https://api.resend.com/emails')
    const headers = call[1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer rk_test')
    const body = JSON.parse(call[1].body as string)
    expect(body.from).toBe('noreply@example.com')
    expect(body.reply_to).toBe('buyer@example.com')
    expect(result).toEqual({ skipped: false, provider: 'resend', id: 'resend-id-123' })
  })

  it('falls back to Mailpace when only the Mailpace token is set', async () => {
    process.env.MAILPACE_API_TOKEN = 'mp_test'

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 42 }),
      text: async () => '',
    }))
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch)

    const result = await sendMail({
      to: 'seller@example.com',
      subject: 'hi',
      text: 'hello',
      html: '<p>hello</p>',
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const call = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('https://app.mailpace.com/api/v1/send')
    const headers = call[1].headers as Record<string, string>
    expect(headers['MailPace-Server-Token']).toBe('mp_test')
    expect(result).toEqual({ skipped: false, provider: 'mailpace', id: '42' })
  })
})
