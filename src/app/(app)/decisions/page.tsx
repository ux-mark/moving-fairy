'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ConfirmDialog } from '@thefairies/design-system/components'
import { AppLayout } from '@/components/layout/AppLayout'
import { DecisionsList } from '@/components/decisions/DecisionsList'
import { ItemDetailDrawer } from '@/components/items/ItemDetailDrawer'
import { useItems } from '@/lib/hooks/useItems'
import { useIsDesktop } from '@/lib/hooks/useIsDesktop'

export default function DecisionsPage() {
  // useSearchParams() requires a Suspense boundary to statically prerender.
  return (
    <Suspense fallback={<AppLayout>{null}</AppLayout>}>
      <DecisionsPageContent />
    </Suspense>
  )
}

function DecisionsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDesktop = useIsDesktop()
  const selectedItemId = searchParams.get('item')
  const [profileId, setProfileId] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data: { profile?: { id?: string } }) => {
        if (data.profile?.id) setProfileId(data.profile.id)
      })
      .catch(() => {
        // Profile fetch failure is non-fatal — subscription will be unfiltered
      })
  }, [])

  const { items, isLoading, error, refresh, addItemByPhoto, addItemByText, confirmItem, retryAssessment, updateVerdict } = useItems(profileId)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadingCount, setUploadingCount] = useState(0)

  const handleUploadPhotos = async (files: File[]) => {
    setUploadError(null)
    // Show skeleton placeholders immediately
    setUploadingCount(files.length)

    const uploads = files.map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const data = await uploadRes.json() as { url?: string }
      if (!data.url) throw new Error('No URL returned')
      const item = await addItemByPhoto(data.url)
      // Reduce skeleton count as each item is created
      setUploadingCount((prev) => Math.max(0, prev - 1))
      return item
    })

    const results = await Promise.allSettled(uploads)
    // Clear any remaining skeletons
    setUploadingCount(0)
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      setUploadError(
        `${failures.length} photo${failures.length > 1 ? 's' : ''} failed to upload. Please try again.`
      )
    }
  }

  const handleAddByText = async (name: string) => {
    try {
      await addItemByText(name)
      setUploadError(null)
    } catch {
      setUploadError('Failed to add item. Please try again.')
    }
  }

  const handleConfirm = (id: string) => {
    confirmItem(id).catch(console.error)
  }

  const handleRetry = (id: string) => {
    retryAssessment(id).catch(console.error)
  }

  const handleVerdictChange = async (id: string, verdict: string) => {
    await updateVerdict(id, verdict)
  }

  // Delete-from-list flow for items that can't be opened (pending/processing/failed)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteDialogTriggerRef = useRef<HTMLButtonElement>(null)

  const itemBeingDeleted = pendingDeleteId
    ? items.find((i) => i.id === pendingDeleteId)
    : undefined
  const deleteItemName = itemBeingDeleted?.item_name || 'this item'

  const handleRequestDelete = (id: string) => {
    setDeleteError(null)
    setPendingDeleteId(id)
  }

  const closeDrawer = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('item')
    const qs = params.toString()
    router.replace(qs ? `/decisions?${qs}` : '/decisions', { scroll: false })
  }, [router, searchParams])

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/items/${pendingDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to delete item')
      }
      setPendingDeleteId(null)
      refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete item. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AppLayout>
      <DecisionsList
        items={items}
        isLoading={isLoading}
        error={error}
        uploadError={uploadError}
        onDismissUploadError={() => setUploadError(null)}
        onUploadPhotos={handleUploadPhotos}
        onAddByText={handleAddByText}
        onConfirm={handleConfirm}
        onRetry={handleRetry}
        onRefresh={refresh}
        onItemClick={(id) => {
          if (isDesktop) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('item', id)
            router.replace(`/decisions?${params.toString()}`, { scroll: false })
          } else {
            router.push(`/decisions/${id}`)
          }
        }}
        onVerdictChange={handleVerdictChange}
        onDelete={handleRequestDelete}
        uploadingCount={uploadingCount}
      />
      {isDesktop && selectedItemId && (() => {
        const selected = items.find((i) => i.id === selectedItemId)
        if (!selected) return null
        return (
          <ItemDetailDrawer
            item={selected}
            onRetry={async (id) => { await retryAssessment(id) }}
            onItemUpdate={() => {
              refresh()
              // The just-decided beat lives inside DecisionsList — refresh
              // alone will cause the matching tile to re-render and the
              // verdict colour change is enough of a signal here.
            }}
            onClose={closeDrawer}
          />
        )
      })()}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => {
          if (!isDeleting) {
            setPendingDeleteId(null)
            setDeleteError(null)
          }
        }}
        title={`Delete "${deleteItemName}"?`}
        description={
          deleteError
            ? `${deleteError} Try again, or keep the item.`
            : "This removes the photo, any chat history, and stops the assessment if it's still queued. This can't be undone."
        }
        confirmLabel="Delete item"
        cancelLabel="Keep item"
        onConfirm={handleConfirmDelete}
        isConfirming={isDeleting}
        variant="danger"
        triggerRef={deleteDialogTriggerRef}
      />
    </AppLayout>
  )
}
