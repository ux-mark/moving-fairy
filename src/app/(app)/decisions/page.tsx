'use client'

import { AppLayout } from '@/components/layout/AppLayout'
import { DecisionsList } from '@/components/decisions/DecisionsList'
import { useItems } from '@/lib/hooks/useItems'

export default function DecisionsPage() {
  const { items, isLoading, error, addItemByPhoto, addItemByText, confirmItem, retryAssessment } = useItems()

  const handleUploadPhotos = async (files: File[]) => {
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const data = await uploadRes.json() as { url?: string }
          if (data.url) {
            await addItemByPhoto(data.url)
          }
        }
      } catch (err) {
        console.error('Failed to upload photo:', err)
      }
    }
  }

  const handleAddByText = async (name: string) => {
    try {
      await addItemByText(name)
    } catch (err) {
      console.error('Failed to add item by text:', err)
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
        onUploadPhotos={handleUploadPhotos}
        onAddByText={handleAddByText}
        onConfirm={handleConfirm}
        onRetry={handleRetry}
        onItemClick={() => {
          // Phase 2: navigate to /decisions/:id
        }}
      />
    </AppLayout>
  )
}
