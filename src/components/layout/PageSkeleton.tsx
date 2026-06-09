import styles from './PageSkeleton.module.css'

/**
 * Neutral content skeleton shown while a route's server data loads. Paired with
 * a `loading.tsx` boundary it gives navigation instant feedback instead of a
 * frozen UI while the page's Supabase round-trips complete.
 */
export function PageSkeleton() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>Loading…</span>
      <div className={styles.titleBar} />
      <div className={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.card} />
        ))}
      </div>
    </div>
  )
}
