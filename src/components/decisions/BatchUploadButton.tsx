'use client'

import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@thefairies/design-system/components'

interface BatchUploadButtonProps {
  onUpload: (files: File[]) => Promise<void>
  disabled?: boolean
}

export function BatchUploadButton({ onUpload, disabled }: BatchUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  function handleClick() {
    inputRef.current?.click()
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setIsUploading(true)
    try {
      await onUpload(files)
    } catch {
      // Error handling is done by the parent
    } finally {
      setIsUploading(false)
      // Reset the input so the same file(s) can be re-selected if needed
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        id="batch-upload-trigger"
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={disabled || isUploading}
        aria-label="Upload photos of items"
      >
        <Camera style={{ width: 16, height: 16 }} aria-hidden="true" />
        {isUploading ? 'Uploading...' : 'Upload photos'}
      </Button>
    </>
  )
}
