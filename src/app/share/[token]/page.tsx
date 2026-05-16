import { notFound } from 'next/navigation'

import { getShipmentByShareToken, getManifest } from '@/mcp'
import styles from './share.module.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Shipment manifest',
  robots: { index: false, follow: false },
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const shipment = await getShipmentByShareToken(token)
  if (!shipment) notFound()

  const manifest = await getManifest(shipment.id)

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: manifest.totals.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(n)

  const flagLabel = (flag: string | null) => {
    if (!flag || flag === 'none') return null
    if (flag === 'declare') return 'Declare'
    if (flag === 'high_risk') return 'High risk'
    if (flag === 'prohibited') return 'Prohibited'
    return flag
  }

  const totalItems = manifest.boxes.reduce((sum, b) => sum + b.items.length, 0)
  const biosec = manifest.totals.biosecurity_counts

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Shipment manifest · Moving Fairy</p>
        <h1 className={styles.title}>{shipment.label}</h1>
        <dl className={styles.summary}>
          <div>
            <dt>Boxes</dt>
            <dd>{manifest.boxes.length}</dd>
          </div>
          <div>
            <dt>Items</dt>
            <dd>{totalItems}</dd>
          </div>
          <div>
            <dt>Total CBM</dt>
            <dd>{manifest.totals.cbm.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Declared value</dt>
            <dd>{fmtCurrency(manifest.totals.declared_value)}</dd>
          </div>
        </dl>
      </header>

      {(biosec.declare + biosec.high_risk + biosec.prohibited) > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Biosecurity declarations</h2>
          <ul className={styles.bioCounts}>
            {biosec.declare > 0 && <li><strong>{biosec.declare}</strong> to declare</li>}
            {biosec.high_risk > 0 && <li><strong>{biosec.high_risk}</strong> high risk</li>}
            {biosec.prohibited > 0 && <li><strong>{biosec.prohibited}</strong> prohibited</li>}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Boxes</h2>
        {manifest.boxes.length === 0 ? (
          <p className={styles.empty}>No boxes assigned to this leg yet.</p>
        ) : (
          manifest.boxes.map(({ box, items, cbm, declared_value }) => (
            <article key={box.id} className={styles.boxCard}>
              <header className={styles.boxHeader}>
                <h3>{box.label}</h3>
                <span className={styles.boxMeta}>
                  {items.length} item{items.length === 1 ? '' : 's'} ·
                  {' '}{cbm !== null ? `${cbm.toFixed(2)} CBM` : '—'} ·
                  {' '}{fmtCurrency(declared_value)}
                </span>
              </header>
              {items.length > 0 && (
                <table className={styles.itemTable}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Declared</th>
                      <th>Biosecurity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ box_item, item_assessment }) => {
                      const name = item_assessment?.item_name ?? box_item.item_name ?? '—'
                      const value = item_assessment?.estimated_replace_cost ?? null
                      const flag = flagLabel(item_assessment?.biosecurity_flag ?? null)
                      const note = item_assessment?.biosecurity_note
                      return (
                        <tr key={box_item.id}>
                          <td>{name}</td>
                          <td>{value !== null ? fmtCurrency(Number(value)) : '—'}</td>
                          <td>
                            {flag ? (
                              <span className={styles.bioChip}>
                                {flag}
                                {note ? <span className={styles.bioNote}> — {note}</span> : null}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </article>
          ))
        )}
      </section>

      <footer className={styles.footer}>
        <p>This is a read-only manifest. Share token rotates if the sender revokes.</p>
      </footer>
    </main>
  )
}
