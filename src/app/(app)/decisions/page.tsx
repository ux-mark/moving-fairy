'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { DecisionsList } from '@/components/decisions/DecisionsList'
import { useItems } from '@/lib/hooks/useItems'

export default function DecisionsPage() {
  const router = useRouter()
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

  const { items, isLoading, error, refresh, addItemByPhoto, addItemByText, confirmItem, retryAssessment } = useItems(profileId)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleUploadPhotos = async (files: File[]) => {
    setUploadError(null)
    const uploads = files.map(async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const data = await uploadRes.json() as { url?: string }
      if (!data.url) throw new Error('No URL returned')
      return addItemByPhoto(data.url)
    })

    const results = await Promise.allSettled(uploads)
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
        onItemClick={(id) => router.push(`/decisions/${id}`)}
      />
    </AppLayout>
  )
}
