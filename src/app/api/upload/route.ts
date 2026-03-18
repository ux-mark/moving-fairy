import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getAuthenticatedProfile } from '@/lib/auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_DIMENSION = 1024
const WEBP_QUALITY = 80
const BUCKET = 'item-images'

function getAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  // Authenticate
  const { user, profile } = await getAuthenticatedProfile()
  if (!user || !profile) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ ok: false, error: 'No file provided' }, { status: 400 })
  }

  // Validate MIME type
  if (!file.type.startsWith('image/')) {
    return Response.json({ ok: false, error: 'File must be an image' }, { status: 400 })
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { ok: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
      { status: 400 }
    )
  }

  try {
    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Optimise: resize to max 1024px on longest edge, convert to WebP
    const optimised = await sharp(inputBuffer)
      .rotate() // auto-rotate based on EXIF
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    // Generate unique filename
    const fileId = crypto.randomUUID()
    const storagePath = `${profile.id}/${fileId}.webp`

    // Upload to Supabase Storage
    const supabase = getAdminClient()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, optimised, {
        contentType: 'image/webp',
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload] Supabase storage error:', uploadError)
      return Response.json(
        { ok: false, error: 'Failed to store image. Please try again.' },
        { status: 500 }
      )
    }

    // Return the bucket-qualified relative path instead of a full absolute URL.
    // This avoids hardcoding the host IP into the DB — the full URL is constructed
    // at runtime via buildStorageUrl() / proxyImageUrl() from storage-url.ts.
    const url = `${BUCKET}/${storagePath}`

    return Response.json({ ok: true, url })
  } catch (err) {
    console.error('[upload] Processing error:', err)
    return Response.json(
      { ok: false, error: 'Failed to process image. Please try again.' },
      { status: 500 }
    )
  }
}
