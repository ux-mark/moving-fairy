import type { ReactNode } from 'react'

import styles from './Field.module.css'

interface FieldProps {
  label: string
  htmlFor?: string | undefined
  hint?: string | undefined
  className?: string | undefined
  children: ReactNode
}

/**
 * Lightweight label + control wrapper. Used across the owner UI's form views.
 * The Nós DS in this repo doesn't ship a FormField primitive, so this is the
 * one shared pattern for label-above-input layouts.
 */
export function Field({ label, htmlFor, hint, className, children }: FieldProps) {
  const root = className ? `${styles.field} ${className}` : styles.field
  return (
    <div className={root}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}
