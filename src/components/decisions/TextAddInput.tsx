'use client'

import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import styles from './TextAddInput.module.css'

interface TextAddInputProps {
  onSubmit: (name: string) => void
  disabled?: boolean
}

export function TextAddInput({ onSubmit, disabled }: TextAddInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue('')
    inputRef.current?.focus()
  }, [value, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className={styles.wrap}>
      <label htmlFor="text-add-item-input" className={styles.label}>
        Describe an item
      </label>
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          id="text-add-item-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. KitchenAid stand mixer"
          className={styles.input}
          disabled={disabled}
          aria-label="Describe an item to assess"
          autoComplete="off"
        />
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label="Add item"
        >
          <Plus style={{ width: 18, height: 18 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
