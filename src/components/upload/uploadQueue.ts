/**
 * Background upload queue core (spec §5). Framework-free so the
 * concurrency/cap/retry/accounting logic is unit-testable; UploadProvider
 * adapts it to React via useSyncExternalStore.
 */

/** Max files accepted into one batch — the rest are rejected with a message. */
export const MAX_BATCH_SIZE = 50
/** Bounded concurrency: sharp on the server is CPU-heavy. */
export const MAX_CONCURRENT_UPLOADS = 3

export type QueuedFileStatus = 'queued' | 'uploading' | 'creating' | 'done' | 'failed'

export interface QueuedFile {
  id: string
  file: File
  status: QueuedFileStatus
  error: string | null
}

export interface UploadQueueSnapshot {
  files: readonly QueuedFile[]
  /**
   * idle — nothing tracked (card hidden);
   * active — work in flight;
   * settled — batch finished (all done and/or failed).
   */
  phase: 'idle' | 'active' | 'settled'
  total: number
  /** done + failed */
  finished: number
  doneCount: number
  failedCount: number
  /** queued + uploading + creating — drives the optimistic list skeletons. */
  pendingCount: number
}

export interface UploadTasks {
  /** Uploads one file (POST /api/upload) and resolves to its storage URL. */
  uploadFile: (file: File) => Promise<string>
  /** Creates the item from the uploaded URL (POST /api/items + assess kick-off). */
  createItem: (url: string) => Promise<void>
}

export interface EnqueueResult {
  accepted: number
  rejected: number
}

const EMPTY_SNAPSHOT: UploadQueueSnapshot = {
  files: [],
  phase: 'idle',
  total: 0,
  finished: 0,
  doneCount: 0,
  failedCount: 0,
  pendingCount: 0,
}

export class UploadQueue {
  private files: QueuedFile[] = []
  private listeners = new Set<() => void>()
  private snapshot: UploadQueueSnapshot = EMPTY_SNAPSHOT
  private inFlight = 0
  private nextId = 0

  constructor(private readonly tasks: UploadTasks) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): UploadQueueSnapshot => this.snapshot

  /**
   * Adds files to the current batch, capped at MAX_BATCH_SIZE. A settled
   * batch is cleared first so counts always describe one visible batch.
   */
  enqueue(input: File[]): EnqueueResult {
    if (this.snapshot.phase === 'settled') this.files = []
    const room = Math.max(0, MAX_BATCH_SIZE - this.files.length)
    const accepted = input.slice(0, room)
    for (const file of accepted) {
      this.files.push({ id: `upload-${++this.nextId}`, file, status: 'queued', error: null })
    }
    this.emit()
    this.pump()
    return { accepted: accepted.length, rejected: input.length - accepted.length }
  }

  /** Re-queues every failed file. */
  retryFailed(): void {
    for (const f of this.files) {
      if (f.status === 'failed') {
        f.status = 'queued'
        f.error = null
      }
    }
    this.emit()
    this.pump()
  }

  /** Re-queues a single failed file. */
  retryFile(id: string): void {
    const f = this.files.find((x) => x.id === id && x.status === 'failed')
    if (!f) return
    f.status = 'queued'
    f.error = null
    this.emit()
    this.pump()
  }

  /** Clears a settled batch (no-op while work is in flight). */
  dismiss(): void {
    if (this.snapshot.phase === 'active') return
    this.files = []
    this.emit()
  }

  private pump(): void {
    let started = false
    while (this.inFlight < MAX_CONCURRENT_UPLOADS) {
      const next = this.files.find((f) => f.status === 'queued')
      if (!next) break
      next.status = 'uploading'
      this.inFlight++
      started = true
      void this.run(next)
    }
    if (started) this.emit()
  }

  private async run(item: QueuedFile): Promise<void> {
    try {
      const url = await this.tasks.uploadFile(item.file)
      this.setStatus(item, 'creating')
      await this.tasks.createItem(url)
      this.setStatus(item, 'done')
    } catch (err) {
      item.error = err instanceof Error ? err.message : 'Upload failed'
      this.setStatus(item, 'failed')
    } finally {
      this.inFlight--
      this.pump()
      this.emit()
    }
  }

  private setStatus(item: QueuedFile, status: QueuedFileStatus): void {
    item.status = status
    this.emit()
  }

  private emit(): void {
    const files = this.files.map((f) => ({ ...f }))
    const doneCount = files.filter((f) => f.status === 'done').length
    const failedCount = files.filter((f) => f.status === 'failed').length
    const finished = doneCount + failedCount
    const total = files.length
    this.snapshot = {
      files,
      phase: total === 0 ? 'idle' : finished === total ? 'settled' : 'active',
      total,
      finished,
      doneCount,
      failedCount,
      pendingCount: total - finished,
    }
    for (const listener of this.listeners) listener()
  }
}
