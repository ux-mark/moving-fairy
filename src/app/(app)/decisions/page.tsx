'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { ConfirmDialog } from '@thefairies/design-system/components'
import { AppLayout } from '@/components/layout/AppLayout'
import { DecisionsList } from '@/components/decisions/DecisionsList'
import { originSideFromTrigger, usePanelDeepLink } from '@/components/panels'
import { useUploadQueue } from '@/components/upload'
import { useItems } from '@/lib/hooks/useItems'

export default function DecisionsPage() {
  // useSearchParams() requires a Suspense boundary to statically prerender.
  return (
    <Suspense fallback={<AppLayout>{null}</AppLayout>}>
      <DecisionsPageContent />
    </Suspense>
  )
}

function DecisionsPageContent() {
  // `?item=<id>` opens the item panel (deep link); the panel keeps the URL in
  // sync so links stay shareable and Back closes it.
  const itemPanel = usePanelDeepLink('item', 'item')
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

  const { items, isLoading, error, refresh, addItemByText, confirmItem, retryAssessment, updateVerdict } = useItems(profileId)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Background upload queue (mounted in the (app) layout): enqueue returns
  // immediately, uploads continue across navigation, and the progress card
  // reports failures/retries. Skeletons are driven by the queue's pending
  // count so they stay correct on return navigation; the created items
  // arrive in the list via Realtime.
  const uploadQueue = useUploadQueue()
  const uploadingCount = uploadQueue.snapshot.pendingCount

  const handleUploadPhotos = (files: File[]) => {
    uploadQueue.enqueue(files)
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
        onItemClick={(id) => itemPanel.open(id, originSideFromTrigger())}
        onVerdictChange={handleVerdictChange}
        onDelete={handleRequestDelete}
        uploadingCount={uploadingCount}
      />

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
