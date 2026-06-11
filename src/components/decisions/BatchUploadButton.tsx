'use client'

import { useRef } from 'react'
import { Camera } from 'lucide-react'
import { Button } from '@thefairies/design-system/components'

interface BatchUploadButtonProps {
  /** Hands the files to the background upload queue and returns immediately. */
  onUpload: (files: File[]) => void
  disabled?: boolean
}

export function BatchUploadButton({ onUpload, disabled }: BatchUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    // Enqueue and return to idle immediately — progress, failures and
    // retries are reported by the docked upload progress card.
    onUpload(files)

    // Reset the input so the same file(s) can be re-selected if needed
    if (inputRef.current) {
      inputRef.current.value = ''
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
        variant="primary"
        size="lg"
        onClick={handleClick}
        disabled={disabled}
        aria-label="Upload photos of items"
      >
        <Camera style={{ width: 20, height: 20 }} aria-hidden="true" />
        Upload photos
      </Button>
    </>
  )
}
