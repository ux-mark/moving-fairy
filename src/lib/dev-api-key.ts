/**
 * Dev-only utility to auto-refresh the Anthropic API key from the macOS keychain.
 *
 * In production: returns process.env.ANTHROPIC_API_KEY unchanged.
 * In development on macOS: reads a fresh OAuth token from the Claude Code
 * keychain entry when the env var is missing or has expired (401).
 *
 * SAFETY: The keychain read NEVER runs when NODE_ENV !== 'development'.
 */

import { execSync } from 'child_process'

// Module-level cache so we only hit the keychain once per server lifecycle
// (or once per refresh after a 401).
let cachedToken: string | null = null

const isDev = process.env.NODE_ENV === 'development'

/**
 * Attempt to read the Claude Code OAuth token from the macOS keychain.
 * Returns the access token string, or null if anything goes wrong.
 */
function readTokenFromKeychain(): string | null {
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()

    const parsed = JSON.parse(raw) as {
      claudeAiOauth?: { accessToken?: string }
    }
    const token = parsed?.claudeAiOauth?.accessToken
    if (token && typeof token === 'string') {
      return token
    }
    console.warn('[dev-api-key] Keychain entry found but no accessToken in claudeAiOauth')
    return null
  } catch (err) {
    // Not on macOS, no Claude Code installed, keychain locked, etc.
    console.warn(
      '[dev-api-key] Could not read token from keychain:',
      err instanceof Error ? err.message : err
    )
    return null
  }
}

/**
 * Get the Anthropic API key to use for requests.
 *
 * - Production: returns process.env.ANTHROPIC_API_KEY
 * - Development: returns cached keychain token, falling back to env var.
 *   On first call, proactively reads from the keychain if the env var is
 *   missing or empty.
 */
export function getAnthropicApiKey(): string {
  if (!isDev) {
    return process.env.ANTHROPIC_API_KEY ?? ''
  }

  // If we have a cached token from the keychain, use it
  if (cachedToken) {
    return cachedToken
  }

  // If the env var is set, try using it first
  const envKey = process.env.ANTHROPIC_API_KEY
  if (envKey) {
    return envKey
  }

  // No env key -- proactively read from keychain on first use
  const keychainToken = readTokenFromKeychain()
  if (keychainToken) {
    cachedToken = keychainToken
    console.log('[dev-api-key] Loaded fresh token from macOS keychain')
    return cachedToken
  }

  // Nothing available
  return ''
}

/**
 * Force a re-read of the token from the macOS keychain.
 * Call this after receiving a 401 from the Anthropic API.
 *
 * Returns the new token, or an empty string if the keychain read fails.
 * In production this is a no-op that returns the env var.
 */
export function refreshAnthropicApiKey(): string {
  if (!isDev) {
    return process.env.ANTHROPIC_API_KEY ?? ''
  }

  console.log('[dev-api-key] Refreshing token from keychain after 401...')
  const keychainToken = readTokenFromKeychain()
  if (keychainToken) {
    cachedToken = keychainToken
    console.log('[dev-api-key] Token refreshed successfully')
    return cachedToken
  }

  // Keychain failed -- clear cache so next call tries env var
  cachedToken = null
  return process.env.ANTHROPIC_API_KEY ?? ''
}
