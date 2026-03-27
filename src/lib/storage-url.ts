/**
 * Build a full Supabase storage URL from a relative storage path.
 *
 * Handles both new relative paths (e.g. "item-images/abc/123.webp")
 * and legacy absolute URLs (e.g. "http://192.168.1.5:54341/storage/v1/object/public/item-images/abc/123.webp").
 *
 * For legacy absolute URLs, extracts the relative path and rebuilds using the
 * current NEXT_PUBLIC_SUPABASE_URL so IP changes are handled transparently.
 */
export function buildStorageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return ''

  // Already a relative path — build full URL
  if (!pathOrUrl.startsWith('http://') && !pathOrUrl.startsWith('https://')) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return pathOrUrl
    return `${base}/storage/v1/object/public/${pathOrUrl}`
  }

  // Legacy absolute URL — extract relative path and rebuild with current base
  const storagePrefix = '/storage/v1/object/public/'
  const idx = pathOrUrl.indexOf(storagePrefix)
  if (idx === -1) return pathOrUrl // Not a storage URL, return as-is

  const relativePath = pathOrUrl.substring(idx + storagePrefix.length)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return pathOrUrl
  return `${base}/storage/v1/object/public/${relativePath}`
}

/**
 * Build a proxy URL for client-side image rendering.
 * Routes through /api/img to avoid CORS and IP issues on mobile.
 *
 * Handles both relative storage paths (new format) and legacy absolute URLs
 * (old format), so existing data in the DB continues to work.
 */
export function proxyImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return ''
  return `/api/img?url=${encodeURIComponent(pathOrUrl)}`
}
