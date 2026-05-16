import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const sendMailMock = vi.fn()
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }))

vi.mock('nodemailer', () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}))

import { sendMail } from './mail'

describe('sendMail()', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    delete process.env.SMTP_SECURE
    delete process.env.MAILPACE_API_TOKEN
    delete process.env.MAIL_FROM_ADDRESS
    sendMailMock.mockReset()
    createTransportMock.mockClear()
    createTransportMock.mockImplementation(() => ({ sendMail: sendMailMock }))
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
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('sends via SMTP (nodemailer) when SMTP_HOST is set', async () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'smtp-user'
    process.env.SMTP_PASS = 'smtp-pass'
    process.env.MAIL_FROM_ADDRESS = 'noreply@example.com'

    sendMailMock.mockResolvedValueOnce({ messageId: '<abc@smtp>' })

    const result = await sendMail({
      to: 'seller@example.com',
      subject: 'hi',
      text: 'hello',
      html: '<p>hello</p>',
      replyTo: 'buyer@example.com',
    })

    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-pass' },
    })
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    const envelope = sendMailMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(envelope.from).toBe('noreply@example.com')
    expect(envelope.to).toBe('seller@example.com')
    expect(envelope.subject).toBe('hi')
    expect(envelope.text).toBe('hello')
    expect(envelope.html).toBe('<p>hello</p>')
    expect(envelope.replyTo).toBe('buyer@example.com')
    expect(result).toEqual({ skipped: false, provider: 'smtp', id: '<abc@smtp>' })
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
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(result).toEqual({ skipped: false, provider: 'mailpace', id: '42' })
  })
})
