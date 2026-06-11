/**
 * Executor selection for the AI runners — the single place that decides
 * SDK vs CLI mode, resolves the Anthropic API key, and applies the dev-only
 * 401 retry (refresh the keychain token, retry once).
 *
 * isCliMode() in claude-cli.ts remains the source of truth for mode
 * detection; this module is the shared front door for the call sites
 * (assess-item, per-item chat route, scan-sticker).
 */

import type Anthropic from '@anthropic-ai/sdk'
import { isCliMode } from '@/lib/claude-cli'
import { getAnthropicApiKey, refreshAnthropicApiKey } from '@/lib/dev-api-key'
import type { UserProfile } from '@/types/database'

export type ExecutorMode = 'sdk' | 'cli'

export function getExecutorMode(): ExecutorMode {
  return isCliMode() ? 'cli' : 'sdk'
}

/** Model used by all Aisling runners. */
export function getAislingModel(): string {
  return process.env.MODEL_AISLING ?? 'claude-sonnet-4-6'
}

/**
 * Resolve the Anthropic API key for SDK calls.
 * Dev: keychain-backed dev key. Prod: profile key, then env.
 */
export function getApiKey(profile: UserProfile): string {
  if (process.env.NODE_ENV === 'development') {
    return getAnthropicApiKey()
  }
  return profile.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? ''
}

/**
 * True when an SDK error is a dev-mode 401 worth one retry after
 * refreshing the keychain token.
 */
export function isRetryable401(err: unknown): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    err instanceof Error &&
    err.message.includes('401')
  )
}

/**
 * Create an Anthropic SDK client. Dynamic import so the SDK is only
 * loaded when the SDK path is actually taken.
 */
export async function createAnthropicClient(apiKey: string): Promise<Anthropic> {
  const AnthropicSDK = (await import('@anthropic-ai/sdk')).default
  return new AnthropicSDK({ apiKey })
}

/**
 * Run an SDK attempt with the profile's API key, retrying once on a
 * dev-mode 401 after refreshing the keychain token.
 */
export async function withSdk401Retry<T>(
  profile: UserProfile,
  logTag: string,
  attempt: (apiKey: string) => Promise<T>
): Promise<T> {
  try {
    return await attempt(getApiKey(profile))
  } catch (err) {
    if (isRetryable401(err)) {
      console.warn(`[${logTag}] Got 401 from SDK — refreshing API key and retrying`)
      return attempt(refreshAnthropicApiKey())
    }
    throw err
  }
}
