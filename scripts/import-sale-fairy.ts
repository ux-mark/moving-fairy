/**
 * import-sale-fairy.ts — one-off import of the legacy sale-fairy catalogue.
 *
 * Reads the embedded `ITEMS` array from /workspace/sale-fairy/index.html,
 * uploads each item's photos to the `item-images` Supabase Storage bucket,
 * and inserts paired `item_assessment` + `listing` rows for the target user.
 *
 * Usage:
 *   tsx scripts/import-sale-fairy.ts --user-profile <uuid> [--dry-run] \
 *                                     [--source /workspace/sale-fairy]
 *
 * Requires SERVICE_ROLE creds in .env (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY) so it can write under any user_profile.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { runInNewContext } from 'node:vm'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildSlug } from '../src/lib/utils'
import {
  Verdict,
  ListingVisibility,
  ListingCondition,
  ProcessingStatus,
  ItemSource,
  BiosecurityFlag,
  BiosecurityCategory,
  type ListingCondition as ListingConditionT,
  type BiosecurityFlag as BiosecurityFlagT,
  type BiosecurityCategory as BiosecurityCategoryT,
} from '../src/lib/constants'

const BUCKET = 'item-images'
const DEFAULT_SOURCE = '/workspace/sale-fairy'

/** Source ITEM shape — what the HTML embeds. All fields optional except id/name. */
interface SourceItem {
  id: string
  name: string
  price?: number
  category?: string
  kind?: string
  image?: string
  images?: string[]
  note?: string
  status?: string
  condition?: string
  brand?: string
  modelName?: string
  dims?: string
  included?: string
  details?: string
  care?: string
}

interface CliArgs {
  userProfileId: string
  dryRun: boolean
  sourceDir: string
}

function parseArgs(argv: string[]): CliArgs {
  let userProfileId = ''
  let dryRun = false
  let sourceDir = DEFAULT_SOURCE
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--user-profile') {
      userProfileId = argv[++i] ?? ''
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--source') {
      sourceDir = argv[++i] ?? DEFAULT_SOURCE
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: tsx scripts/import-sale-fairy.ts --user-profile <uuid> [--dry-run] [--source <dir>]'
      )
      process.exit(0)
    }
  }
  if (!userProfileId) {
    console.error('Error: --user-profile <uuid> is required.')
    process.exit(1)
  }
  return { userProfileId, dryRun, sourceDir }
}

/** Minimal .env loader: KEY=VALUE pairs, ignores comments / blank lines. */
function loadDotEnv(path: string): void {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

/** Extract the `const ITEMS = [ ... ];` block and eval it in a VM sandbox. */
function parseItemsFromHtml(htmlPath: string): SourceItem[] {
  const html = readFileSync(htmlPath, 'utf8')
  // Match: const ITEMS = [ ...balanced... ];
  // We can't do a proper JS parser here so we grab from `const ITEMS = [`
  // through the matching `];` followed by the normalise block.
  const startMarker = 'const ITEMS = ['
  const startIdx = html.indexOf(startMarker)
  if (startIdx === -1) {
    throw new Error(`Could not find "${startMarker}" in ${htmlPath}`)
  }
  // Walk forward, tracking bracket depth, ignoring brackets inside strings/comments.
  const arrStart = startIdx + startMarker.length - 1 // position of the opening [
  let depth = 0
  let i = arrStart
  let inStr: '"' | "'" | '`' | null = null
  let inLineComment = false
  let inBlockComment = false
  let endIdx = -1
  for (; i < html.length; i++) {
    const ch = html[i]
    const next = html[i + 1]
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (inStr) {
      if (ch === '\\') {
        i++ // skip escaped char
        continue
      }
      if (ch === inStr) inStr = null
      continue
    }
    if (ch === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        endIdx = i
        break
      }
    }
  }
  if (endIdx === -1) {
    throw new Error('Unterminated ITEMS array — could not find matching ].')
  }
  const arrayLiteral = html.slice(arrStart, endIdx + 1)
  const expr = `(${arrayLiteral})`
  const items = runInNewContext(expr, {}, { timeout: 1000 }) as SourceItem[]
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('ITEMS array parsed to zero items — aborting.')
  }
  // Normalise: every item gets an images[] and a kind, mirroring the HTML's
  // own normaliser pass (`if (!i.images) i.images = [i.image]`).
  return items.map((raw) => {
    const images =
      raw.images && raw.images.length > 0
        ? raw.images
        : raw.image
          ? [raw.image]
          : []
    return { ...raw, images, kind: raw.kind ?? 'plant' }
  })
}

/** Map the source `condition` free-text to a ListingCondition enum, if possible. */
function mapCondition(src: string | undefined): ListingConditionT | null {
  if (!src) return null
  const v = src.toLowerCase().trim()
  if (v.includes('like new')) return ListingCondition.LIKE_NEW
  if (v.includes('excellent')) return ListingCondition.EXCELLENT
  if (v.includes('good')) return ListingCondition.GOOD
  if (v.includes('fair')) return ListingCondition.FAIR
  return null
}

/** Plants (kind=plant) carry soil/plant_matter → biosecurity declare. */
function inferBiosecurity(item: SourceItem): {
  flag: BiosecurityFlagT | null
  category: BiosecurityCategoryT | null
} {
  if (item.kind === 'plant') {
    return {
      flag: BiosecurityFlag.DECLARE,
      category: BiosecurityCategory.PLANT_MATTER,
    }
  }
  return { flag: null, category: null }
}

/** Map the HTML `image: 'X.png'` filename to the actual on-disk `.jpg`. */
function diskFilename(srcName: string): string {
  return srcName.replace(/\.png$/i, '.jpg')
}

/** Storage path: <user_profile_id>/<slug>/<timestamp>-<file>. */
function storagePath(
  userProfileId: string,
  slug: string,
  ts: number,
  filename: string
): string {
  return `${userProfileId}/${slug}/${ts}-${filename}`
}

/** Upload one file. Returns its public URL. Tolerates "already exists". */
async function uploadImage(
  supabase: SupabaseClient,
  localPath: string,
  destPath: string
): Promise<string> {
  const bytes = readFileSync(localPath)
  const ext = localPath.split('.').pop()?.toLowerCase() ?? ''
  const contentType =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'heic' || ext === 'heif'
            ? 'image/heic'
            : 'image/jpeg'
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(destPath, bytes, { upsert: false, contentType })
  if (error) {
    const msg = error.message ?? ''
    const isAlreadyExists =
      msg.toLowerCase().includes('already exists') ||
      msg.toLowerCase().includes('duplicate') ||
      ('statusCode' in error && (error as { statusCode?: string }).statusCode === '409')
    if (!isAlreadyExists) throw error
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath)
  return data.publicUrl
}

interface PlannedItem {
  sourceId: string
  title: string
  slug: string
  imageFiles: string[]    // resolved on-disk paths
  imageNames: string[]    // basenames used in storage paths
  listingStatus: 'published' | 'sold'
  condition: ListingConditionT | null
  brand: string | null
  modelName: string | null
  dimensions: string | null
  included: string | null
  details: string | null
  askingPrice: number | null
  bio: ReturnType<typeof inferBiosecurity>
}

function planItem(item: SourceItem, sourceDir: string): PlannedItem | null {
  const images = item.images ?? []
  const resolvedFiles: string[] = []
  const resolvedNames: string[] = []
  for (const ref of images) {
    const onDisk = diskFilename(ref)
    const full = resolve(sourceDir, 'images', onDisk)
    if (!existsSync(full)) {
      console.warn(
        `  warn: missing image on disk for "${item.name}" (id=${item.id}): ${onDisk}`
      )
      continue
    }
    resolvedFiles.push(full)
    resolvedNames.push(basename(full))
  }
  if (resolvedFiles.length === 0) {
    console.warn(`  warn: no usable images for "${item.name}" (id=${item.id}) — skipping`)
    return null
  }
  const slug = buildSlug(item.name)
  const detailsParts: string[] = []
  if (item.details) detailsParts.push(item.details)
  if (item.note) detailsParts.push(item.note)
  return {
    sourceId: item.id,
    title: item.name,
    slug,
    imageFiles: resolvedFiles,
    imageNames: resolvedNames,
    listingStatus: item.status === 'sold' ? 'sold' : 'published',
    condition: mapCondition(item.condition),
    brand: item.brand ?? null,
    modelName: item.modelName ?? null,
    dimensions: item.dims ?? null,
    included: item.included ?? null,
    details: detailsParts.length > 0 ? detailsParts.join('\n\n') : null,
    askingPrice: typeof item.price === 'number' && item.price > 0 ? item.price : null,
    bio: inferBiosecurity(item),
  }
}

async function importItem(
  supabase: SupabaseClient,
  userProfileId: string,
  plan: PlannedItem,
  dryRun: boolean
): Promise<'imported' | 'skipped' | 'error'> {
  // Idempotency: skip if a listing for this user already uses an identical
  // base-slug stem (we use buildSlug which appends a random suffix per run,
  // so we compare on the leading stem before the final 4-char suffix).
  const stem = plan.slug.replace(/-[a-f0-9]{4}$/i, '')
  const { data: existingRows, error: existErr } = await supabase
    .from('listing')
    .select('id, slug')
    .eq('user_profile_id', userProfileId)
    .ilike('slug', `${stem}-%`)
  if (existErr) {
    console.error(`  error: idempotency check failed for "${plan.title}":`, existErr.message)
    return 'error'
  }
  if (existingRows && existingRows.length > 0) {
    console.log(`  skipped: "${plan.title}" — existing slug ${existingRows[0]?.slug}`)
    return 'skipped'
  }

  const ts = Date.now()
  const publicUrls: string[] = []
  for (let idx = 0; idx < plan.imageFiles.length; idx++) {
    const localPath = plan.imageFiles[idx]!
    const filename = plan.imageNames[idx]!
    const destPath = storagePath(userProfileId, plan.slug, ts, filename)
    if (dryRun) {
      console.log(`  [dry-run] would upload ${localPath} -> ${BUCKET}/${destPath}`)
      // Synthesise the URL we'd expect, so downstream insert plans show sane data.
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '<NEXT_PUBLIC_SUPABASE_URL>'
      publicUrls.push(`${base}/storage/v1/object/public/${BUCKET}/${destPath}`)
    } else {
      try {
        const url = await uploadImage(supabase, localPath, destPath)
        publicUrls.push(url)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  error: upload failed for ${localPath}: ${msg}`)
        return 'error'
      }
    }
  }

  if (dryRun) {
    console.log(`  [dry-run] would INSERT item_assessment:`, {
      user_profile_id: userProfileId,
      item_name: plan.title,
      verdict: Verdict.SELL,
      images: publicUrls,
      biosecurity_flag: plan.bio.flag,
      biosecurity_category: plan.bio.category,
    })
    console.log(`  [dry-run] would INSERT listing:`, {
      user_profile_id: userProfileId,
      slug: plan.slug,
      asking_price: plan.askingPrice,
      currency: 'USD',
      condition: plan.condition,
      brand: plan.brand,
      model_name: plan.modelName,
      dimensions: plan.dimensions,
      included: plan.included,
      details: plan.details,
      listing_status: plan.listingStatus,
      visibility: ListingVisibility.PUBLIC,
    })
    return 'imported'
  }

  const { data: assessment, error: assessErr } = await supabase
    .from('item_assessment')
    .insert({
      user_profile_id: userProfileId,
      item_name: plan.title,
      verdict: Verdict.SELL,
      images: publicUrls,
      image_url: publicUrls[0] ?? null,
      biosecurity_flag: plan.bio.flag,
      biosecurity_category: plan.bio.category,
      user_confirmed: true,
      processing_status: ProcessingStatus.COMPLETED,
      source: ItemSource.MANUAL,
    })
    .select('id')
    .single()
  if (assessErr || !assessment) {
    console.error(`  error: item_assessment insert failed for "${plan.title}":`, assessErr?.message)
    return 'error'
  }

  const { error: listErr } = await supabase.from('listing').insert({
    user_profile_id: userProfileId,
    item_assessment_id: assessment.id,
    slug: plan.slug,
    asking_price: plan.askingPrice,
    currency: 'USD',
    condition: plan.condition,
    brand: plan.brand,
    model_name: plan.modelName,
    dimensions: plan.dimensions,
    included: plan.included,
    details: plan.details,
    listing_status: plan.listingStatus,
    visibility: ListingVisibility.PUBLIC,
    published_at: new Date().toISOString(),
  })
  if (listErr) {
    console.error(`  error: listing insert failed for "${plan.title}":`, listErr.message)
    return 'error'
  }
  return 'imported'
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  loadDotEnv(resolve(process.cwd(), '.env'))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error(
      'Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env'
    )
    if (!args.dryRun) process.exit(1)
  }

  const supabase: SupabaseClient =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : createClient('http://localhost:54341', 'dry-run-no-key', {
          auth: { persistSession: false },
        })

  const htmlPath = resolve(args.sourceDir, 'index.html')
  if (!existsSync(htmlPath)) {
    console.error(`Error: source HTML not found at ${htmlPath}`)
    process.exit(1)
  }
  const imagesDir = resolve(args.sourceDir, 'images')
  if (!existsSync(imagesDir)) {
    console.error(`Error: source images directory not found at ${imagesDir}`)
    process.exit(1)
  }

  console.log(`Reading ITEMS from ${htmlPath}`)
  const items = parseItemsFromHtml(htmlPath)
  console.log(`Parsed ${items.length} items.`)
  console.log(`Image files on disk: ${readdirSync(imagesDir).length}`)
  console.log(
    args.dryRun
      ? '--- DRY RUN: no writes will be performed ---'
      : `--- LIVE: writing under user_profile ${args.userProfileId} ---`
  )

  let imported = 0
  let skipped = 0
  let errors = 0
  for (const item of items) {
    console.log(`\n[${item.id}] ${item.name}`)
    const plan = planItem(item, args.sourceDir)
    if (!plan) {
      errors++
      continue
    }
    const outcome = await importItem(supabase, args.userProfileId, plan, args.dryRun)
    if (outcome === 'imported') imported++
    else if (outcome === 'skipped') skipped++
    else errors++
  }

  console.log(`\n=== Summary ===`)
  console.log(`Imported ${imported}, skipped ${skipped}, errors ${errors}`)
  console.log(args.dryRun ? '(dry run — nothing was written)' : '(live run complete)')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
