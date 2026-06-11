import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buyerCopy } from '@/lib/copy/buyer'
import styles from './page.module.css'

export default function PublicListingNotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.info} style={{ textAlign: 'center', padding: '40px 24px' }}>
          <h1 className={styles.title}>Item not found</h1>
          <p className={styles.details}>
            This item may have been removed or the link could be out of date.
          </p>
          <div className={styles.actions}>
            <Link href="/" className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden />
              {buyerCopy.backToCollection}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
