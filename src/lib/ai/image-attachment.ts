/**
 * Shared image-attachment helpers for the AI runners.
 *
 * Two delivery mechanisms, matching the two executor modes:
 * - SDK mode: the image is fetched and attached as a base64 image block.
 * - CLI mode: the image is downloaded to a temp file and the prompt instructs
 *   the model to view it with the Read tool (vision-capable).
 *
 * Temp-file cleanup is best-effort and never throws (cleanupTmpImage).
 */

import { writeFile, unlink } from 'node:fs/promises'
import { buildStorageUrl } from '@/lib/storage-url'

export interface SdkImageBlock {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
}

export type ImageAttachment =
  | { kind: 'sdk'; block: SdkImageBlock }
  | { kind: 'cli'; tmpPath: string }

/**
 * Download an image from a URL and return base64-encoded data + media type.
 */
export async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ base64: string; mediaType: string }> {
  const resolvedUrl = buildStorageUrl(imageUrl)
  const response = await fetch(resolvedUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`
    )
  }

  const contentType = response.headers.get('content-type') ?? 'image/webp'
  // Normalise — Supabase Storage serves WebP but may return a generic MIME type
  const mediaType = contentType.startsWith('image/') ? contentType : 'image/webp'

  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  return { base64, mediaType }
}

/**
 * Fetch an image and wrap it as an SDK base64 image content block.
 */
export async function fetchSdkImageBlock(imageUrl: string): Promise<SdkImageBlock> {
  const { base64, mediaType } = await fetchImageAsBase64(imageUrl)
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: base64 },
  }
}

/**
 * Download an image to a temp file so the CLI's Read tool can view it.
 * Throws on fetch/write failure — the caller decides whether that is fatal.
 */
export async function downloadImageToTmp(
  imageUrl: string,
  tmpPath: string,
  logTag?: string
): Promise<string> {
  const response = await fetch(buildStorageUrl(imageUrl))
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(tmpPath, buffer)
  if (logTag) {
    console.log(`[${logTag}] Saved image for CLI to ${tmpPath} (${buffer.length} bytes)`)
  }
  return tmpPath
}

/**
 * Best-effort temp-file removal. Fire-and-forget — never throws.
 */
export function cleanupTmpImage(tmpPath: string): void {
  unlink(tmpPath).catch(() => {})
}

/**
 * Build the mode-appropriate attachment for an item image.
 * Throws on fetch failure — callers catch and degrade to text-only.
 */
export async function buildImageAttachment(
  imageUrl: string,
  cliMode: boolean,
  tmpPath: string,
  logTag?: string
): Promise<ImageAttachment> {
  if (cliMode) {
    return { kind: 'cli', tmpPath: await downloadImageToTmp(imageUrl, tmpPath, logTag) }
  }
  return { kind: 'sdk', block: await fetchSdkImageBlock(imageUrl) }
}
